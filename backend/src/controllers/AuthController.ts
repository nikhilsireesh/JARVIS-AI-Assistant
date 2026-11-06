import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { DatabaseService } from '../services/DatabaseService';
import { AuthenticatedRequest, JWT_SECRET } from '../middleware/authMiddleware';

export class AuthController {
  /**
   * GET /api/auth/google
   * Redirects user to Google OAuth Concent screen.
   */
  public static getGoogleUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const url = GoogleAuthService.getAuthUrl();
      res.json({ url });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/google/callback
   * Receives authorization code from Google, exchanges it for tokens,
   * registers/logs in the user, and starts a session.
   */
  public static async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'OAuth authorization code is required' });
      }

      const { userId, email, name } = await GoogleAuthService.handleCallback(code);

      // Create JWT session
      const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });

      // Set cookie for browser clients
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        token,
        user: { id: userId, email, name }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/auth/me
   * Retrieves profile details and preferences of the authenticated user.
   */
  public static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      
      const user = await DatabaseService.queryOne(
        'SELECT id, email, name, avatar, preferences FROM users WHERE id = $1',
        [userId]
      );

      if (!user) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      // Check if OAuth credentials exist (connection status)
      const creds = await DatabaseService.queryOne(
        'SELECT id FROM oauth_credentials WHERE user_id = $1',
        [userId]
      );

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        preferences: user.preferences,
        isGoogleConnected: !!creds
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/logout
   * Destroys user session cookie.
   */
  public static logout(req: Request, res: Response) {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully.' });
  }
}
