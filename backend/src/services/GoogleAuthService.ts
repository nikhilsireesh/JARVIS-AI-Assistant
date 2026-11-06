import { google } from 'googleapis';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { DatabaseService } from './DatabaseService';
import { EncryptionService } from './EncryptionService';

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  throw new Error('Missing Google OAuth environment variables in .env');
}

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

export class GoogleAuthService {
  private static createOAuth2Client() {
    return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  }

  /**
   * Generates Google OAuth Consent URL
   */
  public static getAuthUrl(): string {
    const oauth2Client = this.createOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline', // Requests refresh token
      scope: SCOPES,
      prompt: 'consent' // Forces consent screen to always get refresh token
    });
  }

  /**
   * Exchanges OAuth code for access and refresh tokens, registers/logs in the user,
   * and saves the encrypted credentials.
   */
  public static async handleCallback(code: string): Promise<{ userId: string; email: string; name: string }> {
    const oauth2Client = this.createOAuth2Client();
    
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfoRes = await oauth2.userinfo.get();
    
    const email = userInfoRes.data.email;
    const name = userInfoRes.data.name || '';
    const avatar = userInfoRes.data.picture || '';

    if (!email) {
      throw new Error('Google OAuth failed: Email not returned by Google');
    }

    // Check if user exists in database
    let user = await DatabaseService.queryOne(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    let userId: string;

    if (!user) {
      // Create new user
      userId = crypto.randomUUID();
      const defaultPrefs = JSON.stringify({ theme: 'dark', model: 'gemini-3.5-flash', notifications: true });
      await DatabaseService.query(
        'INSERT INTO users (id, email, name, avatar, preferences) VALUES ($1, $2, $3, $4, $5)',
        [userId, email, name, avatar, defaultPrefs]
      );
      console.log(`GoogleAuth: Registered new user: ${email}`);
    } else {
      userId = user.id;
      // Update name/avatar
      await DatabaseService.query(
        'UPDATE users SET name = $1, avatar = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [name, avatar, userId]
      );
      console.log(`GoogleAuth: Logged in existing user: ${email}`);
    }

    // Encrypt and save OAuth credentials
    const encAccessToken = EncryptionService.encrypt(tokens.access_token || '');
    const encRefreshToken = tokens.refresh_token ? EncryptionService.encrypt(tokens.refresh_token) : null;
    const expiryDate = tokens.expiry_date || (Date.now() + 3600 * 1000); // Default to 1 hour
    
    // Convert scopes array to format appropriate for DB
    // PostgreSQL can take text[] array, SQLite can take JSON/String. We will join by comma to be compatible with both.
    const scopesStr = SCOPES.join(',');

    // Check if credentials record exists
    const existingCreds = await DatabaseService.queryOne(
      'SELECT id, refresh_token FROM oauth_credentials WHERE user_id = $1',
      [userId]
    );

    if (existingCreds) {
      // If we got a new refresh token, update it. Otherwise keep the old one (Google only returns it on first consent)
      const finalEncRefreshToken = encRefreshToken || existingCreds.refresh_token;
      
      await DatabaseService.query(
        'UPDATE oauth_credentials SET access_token = $1, refresh_token = $2, expiry_date = $3, scopes = $4, updated_at = CURRENT_TIMESTAMP WHERE user_id = $5',
        [encAccessToken, finalEncRefreshToken, expiryDate, scopesStr, userId]
      );
    } else {
      const credsId = crypto.randomUUID();
      await DatabaseService.query(
        'INSERT INTO oauth_credentials (id, user_id, access_token, refresh_token, expiry_date, scopes) VALUES ($1, $2, $3, $4, $5, $6)',
        [credsId, userId, encAccessToken, encRefreshToken, expiryDate, scopesStr]
      );
    }

    // Log Activity
    await DatabaseService.query(
      'INSERT INTO activity_logs (id, user_id, action_type, details) VALUES ($1, $2, $3, $4)',
      [crypto.randomUUID(), userId, 'oauth_login', `Logged in via Google OAuth. Access Token expires at: ${new Date(expiryDate).toISOString()}`]
    );

    return { userId, email, name };
  }

  /**
   * Retrieves an authenticated OAuth2 Client for a specific user ID,
   * automatically refreshing the access token if it has expired.
   */
  public static async getAuthenticatedClient(userId: string) {
    const creds = await DatabaseService.queryOne(
      'SELECT access_token, refresh_token, expiry_date FROM oauth_credentials WHERE user_id = $1',
      [userId]
    );

    if (!creds) {
      throw new Error(`Google credentials not found for user: ${userId}`);
    }

    const oauth2Client = this.createOAuth2Client();
    const accessToken = EncryptionService.decrypt(creds.access_token);
    const refreshToken = creds.refresh_token ? EncryptionService.decrypt(creds.refresh_token) : undefined;
    const expiryDate = Number(creds.expiry_date);

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiryDate
    });

    // Check if access token is expired or expiring in next 60 seconds
    if (expiryDate <= Date.now() + 60000) {
      if (!refreshToken) {
        throw new Error(`OAuth access token expired for user ${userId} and no refresh token exists. Please re-authenticate.`);
      }

      console.log(`GoogleAuth: Access token expired for user ${userId}. Refreshing...`);
      
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);

        const newAccessTokenEnc = EncryptionService.encrypt(credentials.access_token || '');
        const newExpiryDate = credentials.expiry_date || (Date.now() + 3600 * 1000);

        // Update database with new access token
        await DatabaseService.query(
          'UPDATE oauth_credentials SET access_token = $1, expiry_date = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3',
          [newAccessTokenEnc, newExpiryDate, userId]
        );

        console.log(`GoogleAuth: Access token refreshed successfully for user: ${userId}`);
      } catch (err) {
        console.error(`GoogleAuth: Failed to refresh token for user ${userId}:`, err);
        throw new Error('OAuth token refresh failed. Please login again.');
      }
    }

    return oauth2Client;
  }
}
