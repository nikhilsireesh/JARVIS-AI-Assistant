import { google } from 'googleapis';
import { GoogleAuthService } from './GoogleAuthService';

export interface CalendarEventInput {
  summary: string;
  description?: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
  location?: string;
  attendees?: string[]; // Array of emails
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  status: string;
  htmlLink: string;
  attendees: { email: string; responseStatus: string }[];
  organizer: string;
}

export class CalendarService {
  /**
   * Helper to retrieve Google Calendar API Client.
   */
  private static async getCalendarClient(userId: string) {
    const auth = await GoogleAuthService.getAuthenticatedClient(userId);
    return google.calendar({ version: 'v3', auth });
  }

  /**
   * Lists upcoming meetings and events.
   */
  public static async listEvents(
    userId: string,
    options: { timeMin?: string; timeMax?: string; q?: string; maxResults?: number } = {}
  ): Promise<CalendarEvent[]> {
    const calendar = await this.getCalendarClient(userId);
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: options.timeMin || new Date().toISOString(),
      timeMax: options.timeMax || undefined,
      q: options.q || undefined,
      maxResults: options.maxResults || 20,
      singleEvents: true, // Expand recurring events
      orderBy: 'startTime'
    });

    const items = response.data.items || [];
    return items.map(item => ({
      id: item.id!,
      summary: item.summary || 'No Title',
      description: item.description || '',
      startTime: item.start?.dateTime || item.start?.date || '',
      endTime: item.end?.dateTime || item.end?.date || '',
      location: item.location || '',
      status: item.status || '',
      htmlLink: item.htmlLink || '',
      attendees: (item.attendees || []).map(a => ({
        email: a.email || '',
        responseStatus: a.responseStatus || 'needsAction'
      })),
      organizer: item.organizer?.email || ''
    }));
  }

  /**
   * Creates a new calendar event.
   */
  public static async createEvent(userId: string, input: CalendarEventInput): Promise<CalendarEvent> {
    const calendar = await this.getCalendarClient(userId);

    const eventBody: any = {
      summary: input.summary,
      description: input.description,
      start: {
        dateTime: input.startTime,
        timeZone: 'UTC' // Store dates globally in UTC, UI resolves to browser timezone
      },
      end: {
        dateTime: input.endTime,
        timeZone: 'UTC'
      },
      location: input.location
    };

    if (input.attendees && input.attendees.length > 0) {
      eventBody.attendees = input.attendees.map(email => ({ email }));
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
      sendUpdates: 'all' // Notify attendees via email
    });

    const item = response.data;
    return {
      id: item.id!,
      summary: item.summary || 'No Title',
      description: item.description || '',
      startTime: item.start?.dateTime || item.start?.date || '',
      endTime: item.end?.dateTime || item.end?.date || '',
      location: item.location || '',
      status: item.status || '',
      htmlLink: item.htmlLink || '',
      attendees: (item.attendees || []).map(a => ({
        email: a.email || '',
        responseStatus: a.responseStatus || 'needsAction'
      })),
      organizer: item.organizer?.email || ''
    };
  }

  /**
   * Updates an existing calendar event.
   */
  public static async updateEvent(userId: string, eventId: string, input: Partial<CalendarEventInput>): Promise<CalendarEvent> {
    const calendar = await this.getCalendarClient(userId);
    
    // Fetch existing event
    const existing = await calendar.events.get({
      calendarId: 'primary',
      eventId
    });

    const eventBody: any = {
      ...existing.data,
      summary: input.summary !== undefined ? input.summary : existing.data.summary,
      description: input.description !== undefined ? input.description : existing.data.description,
      location: input.location !== undefined ? input.location : existing.data.location,
    };

    if (input.startTime) {
      eventBody.start = { dateTime: input.startTime, timeZone: 'UTC' };
    }
    if (input.endTime) {
      eventBody.end = { dateTime: input.endTime, timeZone: 'UTC' };
    }
    if (input.attendees !== undefined) {
      eventBody.attendees = input.attendees.map(email => ({ email }));
    }

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: eventBody,
      sendUpdates: 'all'
    });

    const item = response.data;
    return {
      id: item.id!,
      summary: item.summary || 'No Title',
      description: item.description || '',
      startTime: item.start?.dateTime || item.start?.date || '',
      endTime: item.end?.dateTime || item.end?.date || '',
      location: item.location || '',
      status: item.status || '',
      htmlLink: item.htmlLink || '',
      attendees: (item.attendees || []).map(a => ({
        email: a.email || '',
        responseStatus: a.responseStatus || 'needsAction'
      })),
      organizer: item.organizer?.email || ''
    };
  }

  /**
   * Deletes a calendar event.
   */
  public static async deleteEvent(userId: string, eventId: string): Promise<void> {
    const calendar = await this.getCalendarClient(userId);
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
      sendUpdates: 'all'
    });
  }

  /**
   * Queries free/busy intervals for schedule coordination.
   */
  public static async checkAvailability(
    userId: string,
    timeMin: string,
    timeMax: string,
    usersToCheck: string[] = ['primary']
  ): Promise<{ [key: string]: { busy: { start: string; end: string }[] } }> {
    const calendar = await this.getCalendarClient(userId);
    
    const items = usersToCheck.map(id => ({ id }));
    
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items
      }
    });

    const calendars = response.data.calendars || {};
    const result: { [key: string]: { busy: { start: string; end: string }[] } } = {};
    
    for (const key in calendars) {
      result[key] = {
        busy: (calendars[key].busy || []).map(b => ({
          start: b.start || '',
          end: b.end || ''
        }))
      };
    }

    return result;
  }
}
