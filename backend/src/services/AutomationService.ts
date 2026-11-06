import cron from 'node-cron';
import crypto from 'crypto';
import { DatabaseService } from './DatabaseService';
import { GmailService } from './GmailService';
import { GoogleAuthService } from './GoogleAuthService';
import { CalendarService, CalendarEvent } from './CalendarService';
import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.GEMINI_API_KEY;


export class AutomationService {
  private static activeJobs: Map<string, cron.ScheduledTask> = new Map();
  private static ltmInterval: NodeJS.Timeout | null = null;

  /**
   * Initializes and schedules all active automations from the database.
   */
  public static async startAll(): Promise<void> {
    try {
      console.log('AutomationService: Loading scheduled automations from database...');
      const automations = await DatabaseService.query(
        'SELECT * FROM automations WHERE is_active = $1',
        [true]
      );

      console.log(`AutomationService: Found ${automations.length} active automations to schedule.`);
      
      // Stop any existing jobs just in case
      this.stopAll();

      for (const auto of automations) {
        this.scheduleJob(auto);
      }

      // Start LTM background monitoring
      this.startLtmMonitoring();
    } catch (err) {
      console.error('AutomationService: Failed to start automations:', err);
    }
  }

  /**
   * Stops all running cron jobs.
   */
  public static stopAll(): void {
    for (const [id, job] of this.activeJobs.entries()) {
      job.stop();
    }
    this.activeJobs.clear();

    if (this.ltmInterval) {
      clearInterval(this.ltmInterval);
      this.ltmInterval = null;
    }
    console.log('AutomationService: Stopped all active cron jobs and monitor loops.');
  }

  /**
   * Schedules a single automation job.
   */
  public static scheduleJob(automation: any): void {
    const { id, cron_expression, name, action_type, user_id } = automation;
    
    if (!cron.validate(cron_expression)) {
      console.error(`AutomationService: Invalid cron expression "${cron_expression}" for automation "${name}"`);
      return;
    }

    console.log(`AutomationService: Scheduling job "${name}" [ID: ${id}] with cron "${cron_expression}"`);

    const job = cron.schedule(cron_expression, async () => {
      console.log(`AutomationService: Running scheduled job "${name}"...`);
      const startTime = Date.now();
      let status = 'success';
      let output = '';

      try {
        output = await this.executeAction(user_id, action_type, automation.action_config);
        
        // Update last run time in DB
        await DatabaseService.query(
          'UPDATE automations SET last_run_at = CURRENT_TIMESTAMP WHERE id = $1',
          [id]
        );
      } catch (err) {
        status = 'failed';
        output = `Error executing action: ${(err as Error).message}\n${(err as Error).stack}`;
        console.error(`AutomationService: Job "${name}" failed:`, err);
      } finally {
        const duration = Date.now() - startTime;
        // Log job execution
        await DatabaseService.query(
          'INSERT INTO automation_logs (id, automation_id, status, output, run_duration_ms) VALUES ($1, $2, $3, $4, $5)',
          [crypto.randomUUID(), id, status, output, duration]
        );
      }
    });

    this.activeJobs.set(id, job);
  }

  /**
   * Executes the specific automation action type.
   */
  private static async executeAction(userId: string, actionType: string, config: any): Promise<string> {
    // 1. Load user profile
    const user = await DatabaseService.queryOne('SELECT email, name FROM users WHERE id = $1', [userId]);
    if (!user) throw new Error(`User ${userId} not found`);

    const userEmail = user.email;
    const userName = user.name || 'User';

    switch (actionType) {
      case 'email_summary': {
        // Fetch unread emails from Gmail
        const { emails } = await GmailService.listEmails(userId, { q: 'label:UNREAD', maxResults: 15 });
        if (emails.length === 0) {
          await GmailService.sendEmail(
            userId,
            userEmail,
            'JARVIS Daily Briefing: No Unread Emails',
            `<h3>Good morning, ${userName}.</h3><p>There are no unread emails in your inbox today.</p>`
          );
          return 'No unread emails. Sent empty briefing email.';
        }

        // Prepare email snippets for Gemini
        const emailListText = emails.map(e => `From: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet}\n---`).join('\n');
        
        // Summarize with Gemini
        if (!API_KEY) throw new Error('GEMINI_API_KEY missing');
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const prompt = `You are JARVIS. Below is a list of unread emails for ${userName}.
Please create a professional, structured executive summary in HTML format.
Use clean headings, bullet points, and bold text for important senders or action items.
At the end, list a few recommended quick replies or tasks.

Emails:
${emailListText}`;

        const genResult = await ai.models.generateContent({ model: 'gemini-3.5-flash', contents: prompt });
        const htmlSummary = genResult.text ?? '';

        // Send email to user
        await GmailService.sendEmail(
          userId,
          userEmail,
          `JARVIS Daily Briefing: ${emails.length} Unread Emails`,
          `<h2>JARVIS Daily Briefing</h2>
           <p>Good morning, ${userName}. Here is your unread email summary:</p>
           <hr/>
           ${htmlSummary}`
        );

        return `Processed and summarized ${emails.length} unread emails. Briefing emailed to ${userEmail}.`;
      }

      case 'meeting_notification': {
        // Fetch today's schedule
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const events = await CalendarService.listEvents(userId, {
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString()
        });

        if (events.length === 0) {
          return 'No meetings scheduled for today.';
        }

        const meetingsList = events.map(e => {
          const start = new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `<li><strong>${start}</strong>: ${e.summary} (${e.location || 'No Location'})</li>`;
        }).join('');

        await GmailService.sendEmail(
          userId,
          userEmail,
          'JARVIS Today\'s Schedule Alert',
          `<h2>JARVIS Workspace Schedule</h2>
           <p>Sir, you have ${events.length} meetings scheduled for today:</p>
           <ul>${meetingsList}</ul>
           <p>I will notify you before each event.</p>`
        );

        return `Sent meeting schedule overview. Total meetings today: ${events.length}`;
      }

      case 'end_of_day_report': {
        // Compile logs of actions taken today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const logs = await DatabaseService.query(
          'SELECT action_type, details, created_at FROM activity_logs WHERE user_id = $1 AND created_at >= $2 ORDER BY created_at ASC',
          [userId, DatabaseService.toTimestamp(startOfDay)]
        );

        const logsList = logs.map(l => {
          const time = new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `<li>[${time}] <strong>${l.action_type}</strong>: ${l.details}</li>`;
        }).join('');

        await GmailService.sendEmail(
          userId,
          userEmail,
          'JARVIS End-of-Day Activity Report',
          `<h2>JARVIS Daily Report</h2>
           <p>Here is a log of system activities and requests executed today, Sir:</p>
           ${logs.length > 0 ? `<ul>${logsList}</ul>` : '<p>No system activity logged today.</p>'}`
        );

        return `Emailed End-of-Day Report. Total actions logged: ${logs.length}`;
      }

      default:
        throw new Error(`Automation action ${actionType} is not supported.`);
    }
  }

  /**
   * Starts background check crawler looking for unread emails from "ltm".
   * Automatically publishes alerts into the activity console.
   */
  public static startLtmMonitoring(): void {
    if (this.ltmInterval) clearInterval(this.ltmInterval);

    console.log('AutomationService: Starting background LTM email monitor (30s interval)...');
    this.ltmInterval = setInterval(async () => {
      try {
        const credentials = await DatabaseService.query(
          'SELECT user_id FROM oauth_credentials'
        );

        for (const cred of credentials) {
          const userId = cred.user_id;

          try {
            const gmail = await GmailService.getGmailClient(userId);
            
            // Search for unread emails containing "ltm"
            const res = await gmail.users.messages.list({
              userId: 'me',
              q: 'label:UNREAD ltm',
              maxResults: 10
            });

            if (res.data.messages && res.data.messages.length > 0) {
              for (const msg of res.data.messages) {
                const messageId = msg.id!;

                // Check if we already logged this message ID
                const exists = await DatabaseService.queryOne(
                  "SELECT id FROM activity_logs WHERE user_id = $1 AND action_type = 'ltm_alert' AND details LIKE $2",
                  [userId, `%${messageId}%`]
                );

                if (!exists) {
                  // Fetch message details
                  const msgDetail = await gmail.users.messages.get({
                    userId: 'me',
                    id: messageId
                  });

                  const headers = msgDetail.data.payload?.headers || [];
                  const subjectHeader = headers.find(h => h.name?.toLowerCase() === 'subject');
                  const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from');
                  const subject = subjectHeader?.value || '(No Subject)';
                  const from = fromHeader?.value || 'Unknown Sender';

                  console.log(`AutomationService: Detected LTM email from ${from} regarding "${subject}". Logging alert.`);

                  // Log to activity logs
                  await DatabaseService.query(
                    'INSERT INTO activity_logs (id, user_id, action_type, details) VALUES ($1, $2, $3, $4)',
                    [
                      crypto.randomUUID(),
                      userId,
                      'ltm_alert',
                      `ALERT: New LTM email from "${from}" with subject: "${subject}" (ID: ${messageId})`
                    ]
                  );
                }
              }
            }
          } catch (err) {
            // Ignore individual credentials/token issues
          }
        }
      } catch (err) {
        console.error('AutomationService: LTM monitor loop failed:', err);
      }
    }, 30000);
  }
}
