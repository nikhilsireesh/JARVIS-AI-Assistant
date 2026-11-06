import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { DatabaseService } from '../services/DatabaseService';

export class SettingsController {
  /**
   * PUT /api/settings/preferences
   * Updates user preferences in the database (JSON column).
   */
  public static async updatePreferences(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { theme, model, notifications } = req.body;

      // Fetch existing preferences
      const user = await DatabaseService.queryOne(
        'SELECT preferences FROM users WHERE id = $1',
        [userId]
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Merge preferences
      const oldPrefs = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : (user.preferences || {});
      const newPrefs = {
        ...oldPrefs,
        ...(theme !== undefined && { theme }),
        ...(model !== undefined && { model }),
        ...(notifications !== undefined && { notifications })
      };

      await DatabaseService.query(
        'UPDATE users SET preferences = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(newPrefs), userId]
      );

      res.json({ success: true, preferences: newPrefs });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/settings/disconnect-google
   * Deletes Google OAuth credentials from database for the user.
   */
  public static async disconnectGoogle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;

      await DatabaseService.query(
        'DELETE FROM oauth_credentials WHERE user_id = $1',
        [userId]
      );

      // Log activity
      await DatabaseService.query(
        'INSERT INTO activity_logs (id, user_id, action_type, details) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID() as any, userId, 'oauth_disconnect', 'Disconnected Google Workspace account.']
      );

      res.json({ success: true, message: 'Google account disconnected successfully.' });
    } catch (err) {
      next(err);
    }
  }
}
