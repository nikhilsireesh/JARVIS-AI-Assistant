import { FunctionDeclaration, Type } from '@google/genai';
import { GmailService } from '../services/GmailService';
import { CalendarService } from '../services/CalendarService';
import { SheetsService } from '../services/SheetsService';

export const workspaceDeclarations: any[] = [

  {
    name: 'read_emails',
    description: 'Lists emails from the inbox with optional search queries and limits.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        q: {
          type: Type.STRING,
          description: 'Gmail search filter (e.g., "label:UNREAD", "from:John", "subject:invoice")'
        },
        maxResults: {
          type: Type.INTEGER,
          description: 'Maximum number of emails to return (default is 10)'
        }
      }
    }
  },
  {
    name: 'send_email',
    description: 'Sends an email to a recipient. Can be HTML format and reply to threads.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Email address of the recipient' },
        subject: { type: Type.STRING, description: 'Subject of the email' },
        body: { type: Type.STRING, description: 'Content of the email, HTML supported' },
        threadId: { type: Type.STRING, description: 'Optional Gmail thread ID to reply to' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'archive_email',
    description: 'Removes an email from the inbox (archives it).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        emailId: { type: Type.STRING, description: 'The unique Gmail message ID' }
      },
      required: ['emailId']
    }
  },
  {
    name: 'delete_email',
    description: 'Trashes an email message.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        emailId: { type: Type.STRING, description: 'The unique Gmail message ID' }
      },
      required: ['emailId']
    }
  },
  {
    name: 'summarize_email',
    description: 'Retrieves the complete content of a single email for detailing or summary purposes.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        emailId: { type: Type.STRING, description: 'The unique Gmail message ID' }
      },
      required: ['emailId']
    }
  },
  {
    name: 'list_events',
    description: 'Lists calendar events for the user within a time range.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        timeMin: { type: Type.STRING, description: 'ISO start date (e.g., "2026-06-29T00:00:00Z")' },
        timeMax: { type: Type.STRING, description: 'ISO end date (e.g., "2026-06-30T00:00:00Z")' },
        q: { type: Type.STRING, description: 'Free-text search query (e.g., "Rahul")' },
        maxResults: { type: Type.INTEGER, description: 'Max events to return' }
      }
    }
  },
  {
    name: 'create_calendar_event',
    description: 'Creates an event in the user primary Google Calendar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: 'Title of the calendar event' },
        startTime: { type: Type.STRING, description: 'ISO start datetime (e.g., "2026-06-29T16:00:00Z")' },
        endTime: { type: Type.STRING, description: 'ISO end datetime (e.g., "2026-06-29T17:00:00Z")' },
        description: { type: Type.STRING, description: 'Optional description/agenda details' },
        location: { type: Type.STRING, description: 'Optional meeting location or link' },
        attendees: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Optional list of attendee email addresses'
        }
      },
      required: ['summary', 'startTime', 'endTime']
    }
  },
  {
    name: 'delete_calendar_event',
    description: 'Deletes an event from the user calendar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventId: { type: Type.STRING, description: 'The unique Google Calendar Event ID' }
      },
      required: ['eventId']
    }
  },
  {
    name: 'create_sheet',
    description: 'Creates a brand new Google Spreadsheet and returns its details.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Title of the spreadsheet' }
      },
      required: ['title']
    }
  },
  {
    name: 'append_sheet',
    description: 'Appends rows of values to a Google Sheet.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        spreadsheetId: { type: Type.STRING, description: 'The Google Spreadsheet ID. Use the default sheet ID if not specified.' },
        range: { type: Type.STRING, description: 'Sheet tab name or range (e.g., "Sheet1!A1", "Expenses")' },
        values: {
          type: Type.ARRAY,
          items: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          description: 'A 2D array of strings representing rows and cells'
        }
      },
      required: ['range', 'values']
    }
  },
  {
    name: 'read_sheet_data',
    description: 'Reads data values from a Google Spreadsheet range.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        spreadsheetId: { type: Type.STRING, description: 'The Google Spreadsheet ID. Use the default sheet ID if not specified.' },
        range: { type: Type.STRING, description: 'Range to read (e.g., "Sheet1!A1:D10", "Expenses!A:E")' }
      },
      required: ['range']
    }
  }
];

export async function handleToolCall(userId: string, name: string, args: any): Promise<any> {
  const defaultSheetId = process.env.DEFAULT_SPREADSHEET_ID;

  switch (name) {
    case 'read_emails':
      return await GmailService.listEmails(userId, {
        q: args.q,
        maxResults: args.maxResults
      });
      
    case 'send_email':
      return await GmailService.sendEmail(userId, args.to, args.subject, args.body, args.threadId);
      
    case 'archive_email':
      await GmailService.archiveEmail(userId, args.emailId);
      return { success: true, message: `Email ${args.emailId} archived.` };
      
    case 'delete_email':
      await GmailService.deleteEmail(userId, args.emailId);
      return { success: true, message: `Email ${args.emailId} sent to trash.` };
      
    case 'summarize_email':
      return await GmailService.getEmail(userId, args.emailId);
      
    case 'list_events':
      return await CalendarService.listEvents(userId, {
        timeMin: args.timeMin,
        timeMax: args.timeMax,
        q: args.q,
        maxResults: args.maxResults
      });
      
    case 'create_calendar_event':
      return await CalendarService.createEvent(userId, {
        summary: args.summary,
        startTime: args.startTime,
        endTime: args.endTime,
        description: args.description,
        location: args.location,
        attendees: args.attendees
      });
      
    case 'delete_calendar_event':
      await CalendarService.deleteEvent(userId, args.eventId);
      return { success: true, message: `Calendar event ${args.eventId} deleted.` };
      
    case 'create_sheet':
      return await SheetsService.createSpreadsheet(userId, args.title);
      
    case 'append_sheet':
      return await SheetsService.appendRows(
        userId,
        args.spreadsheetId || defaultSheetId,
        args.range,
        args.values
      );
      
    case 'read_sheet_data':
      return await SheetsService.readRange(
        userId,
        args.spreadsheetId || defaultSheetId,
        args.range
      );
      
    default:
      throw new Error(`Tool ${name} not implemented`);
  }
}
