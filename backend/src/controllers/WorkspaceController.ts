import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { GmailService, EmailMessage } from '../services/GmailService';
import { CalendarService, CalendarEvent } from '../services/CalendarService';
import { SheetsService } from '../services/SheetsService';
import { DatabaseService } from '../services/DatabaseService';

export class WorkspaceController {
  /**
   * GET /api/workspace/dashboard
   * Gathers dashboard summary metrics including recent unread emails, upcoming meetings, activity, and productivity metrics.
   */
  public static async getDashboardSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      
      // 1. Fetch unread emails
      let unreadCount = 0;
      let recentEmails: EmailMessage[] = [];
      try {
        const [{ emails }, count] = await Promise.all([
          GmailService.listEmails(userId, { q: 'label:UNREAD', maxResults: 5 }),
          GmailService.getUnreadCount(userId)
        ]);
        unreadCount = count;
        recentEmails = emails;
      } catch (err) {
        console.warn('Dashboard: Failed to fetch Gmail status:', (err as Error).message);
      }

      // 2. Fetch upcoming meetings (next 24 hours)
      let upcomingMeetings: CalendarEvent[] = [];

      try {
        const now = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        upcomingMeetings = await CalendarService.listEvents(userId, {
          timeMin: now.toISOString(),
          timeMax: tomorrow.toISOString(),
          maxResults: 5
        });
      } catch (err) {
        console.warn('Dashboard: Failed to fetch Calendar status:', (err as Error).message);
      }

      // 3. Fetch activity logs (last 5)
      const activityLogs = await DatabaseService.query(
        'SELECT action_type, details, created_at FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
        [userId]
      );

      // 4. Calculate dynamic productivity score
      // Score = Base (50) + (events * 10) + (emails read * 2) + (automations run * 5) capped at 100
      let productivityScore = 75; // Default standard base
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const actionsToday = await DatabaseService.query(
          'SELECT COUNT(*) as count FROM activity_logs WHERE user_id = $1 AND created_at >= $2',
          [userId, DatabaseService.toTimestamp(startOfDay)]
        );
        
        const count = Number(actionsToday[0]?.count || 0);
        productivityScore = Math.min(100, 60 + count * 5);
      } catch (err) {
        console.error('Failed to compute productivity score:', err);
      }

      res.json({
        unreadCount,
        recentEmails,
        upcomingMeetings,
        activityLogs,
        productivityScore,
        currentModel: 'gemini-3.5-flash',
        apiStatus: 'healthy'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/workspace/emails
   */
  public static async listEmails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const q = req.query.q as string || 'label:INBOX';
      const maxResults = req.query.maxResults ? Number(req.query.maxResults) : 20;

      const result = await GmailService.listEmails(userId, { q, maxResults });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/workspace/emails/:id
   */
  public static async getEmailDetail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const email = await GmailService.getEmail(userId, id);
      
      // Mark as read in background if unread
      if (!email.isRead) {
        try {
          await GmailService.modifyEmail(userId, id, { removeLabelIds: ['UNREAD'] });
        } catch (err) {
          console.error(`Workspace: Failed to mark email ${id} as read:`, err);
        }
      }

      res.json(email);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspace/emails/send
   */
  public static async sendEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { to, subject, body, threadId } = req.body;

      if (!to || !subject || !body) {
        return res.status(400).json({ error: 'to, subject, and body are required fields.' });
      }

      const result = await GmailService.sendEmail(userId, to, subject, body, threadId);
      
      // Log activity
      await DatabaseService.query(
        'INSERT INTO activity_logs (id, user_id, action_type, details) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), userId, 'gmail_send', `Emailed ${to}: "${subject}"`]
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspace/emails/:id/archive
   */
  public static async archiveEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      await GmailService.archiveEmail(userId, id);
      res.json({ success: true, message: 'Email archived successfully.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/workspace/emails/:id
   */
  public static async deleteEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      await GmailService.deleteEmail(userId, id);
      res.json({ success: true, message: 'Email deleted successfully.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/workspace/calendar/events
   */
  public static async listCalendarEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const timeMin = req.query.timeMin as string || new Date().toISOString();
      const timeMax = req.query.timeMax as string;
      const maxResults = req.query.maxResults ? Number(req.query.maxResults) : 30;

      const events = await CalendarService.listEvents(userId, { timeMin, timeMax, maxResults });
      res.json(events);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspace/calendar/events
   */
  public static async createCalendarEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { summary, description, startTime, endTime, location, attendees } = req.body;

      if (!summary || !startTime || !endTime) {
        return res.status(400).json({ error: 'summary, startTime, and endTime are required.' });
      }

      const event = await CalendarService.createEvent(userId, {
        summary,
        description,
        startTime,
        endTime,
        location,
        attendees
      });

      // Log activity
      await DatabaseService.query(
        'INSERT INTO activity_logs (id, user_id, action_type, details) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), userId, 'calendar_event_created', `Scheduled event "${summary}" at ${startTime}`]
      );

      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/workspace/calendar/events/:id
   */
  public static async deleteCalendarEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      await CalendarService.deleteEvent(userId, id);
      res.json({ success: true, message: 'Calendar event deleted.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/workspace/sheets/:id
   */
  public static async getSpreadsheetInfo(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const info = await SheetsService.getSpreadsheetInfo(userId, id);
      res.json(info);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspace/sheets/:id/read-range
   */
  public static async readSheetRange(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { range } = req.body;

      if (!range) {
        return res.status(400).json({ error: 'range is required in body' });
      }

      const data = await SheetsService.readRange(userId, id, range);
      res.json({ values: data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/workspace/sheets/:id/append
   */
  public static async appendSheetRows(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { range, values } = req.body;

      if (!range || !values) {
        return res.status(400).json({ error: 'range and values are required.' });
      }

      const result = await SheetsService.appendRows(userId, id, range, values);

      // Log activity
      await DatabaseService.query(
        'INSERT INTO activity_logs (id, user_id, action_type, details) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), userId, 'sheet_appended', `Appended ${values.length} rows to sheet range ${range}`]
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/workspace/activity
   */
  public static async listActivityLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const logs = await DatabaseService.query(
        'SELECT action_type, details, created_at FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        [userId]
      );
      res.json(logs);
    } catch (err) {
      next(err);
    }
  }
}
