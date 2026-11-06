import { google } from 'googleapis';
import { GoogleAuthService } from './GoogleAuthService';

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body?: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
}

export class GmailService {
  /**
   * Helper to initialize the Gmail API client for a user.
   */
  public static async getGmailClient(userId: string) {
    const auth = await GoogleAuthService.getAuthenticatedClient(userId);
    return google.gmail({ version: 'v1', auth });
  }

  /**
   * Helper to parse email headers
   */
  private static getHeader(headers: any[], name: string): string {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : '';
  }

  /**
   * Helper to decode body from Gmail parts
   */
  private static decodeBody(payload: any): string {
    if (!payload) return '';
    
    // Check if body data exists directly
    if (payload.body && payload.body.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf8');
    }
    
    // Check in parts recursively
    if (payload.parts) {
      // Look for text/html first, then text/plain
      const htmlPart = payload.parts.find((part: any) => part.mimeType === 'text/html');
      if (htmlPart && htmlPart.body && htmlPart.body.data) {
        return Buffer.from(htmlPart.body.data, 'base64').toString('utf8');
      }

      const textPart = payload.parts.find((part: any) => part.mimeType === 'text/plain');
      if (textPart && textPart.body && textPart.body.data) {
        return Buffer.from(textPart.body.data, 'base64').toString('utf8');
      }

      // Check nested parts
      for (const part of payload.parts) {
        const body = this.decodeBody(part);
        if (body) return body;
      }
    }
    
    return '';
  }

  /**
   * Retrieves user's inbox list, supporting search queries and pagination.
   */
  public static async listEmails(
    userId: string,
    options: { q?: string; maxResults?: number; pageToken?: string } = {}
  ): Promise<{ emails: EmailMessage[]; nextPageToken?: string }> {
    const gmail = await this.getGmailClient(userId);
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: options.q || 'label:INBOX',
      maxResults: options.maxResults || 10,
      pageToken: options.pageToken
    });

    const messages = response.data.messages || [];
    const emails: EmailMessage[] = [];

    // Fetch full detail for each message
    for (const msg of messages) {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date']
        });

        const headers = detail.data.payload?.headers || [];
        const labels = detail.data.labelIds || [];
        
        emails.push({
          id: detail.data.id!,
          threadId: detail.data.threadId!,
          from: this.getHeader(headers, 'From'),
          to: this.getHeader(headers, 'To'),
          subject: this.getHeader(headers, 'Subject'),
          date: this.getHeader(headers, 'Date'),
          snippet: detail.data.snippet || '',
          isRead: !labels.includes('UNREAD'),
          isStarred: labels.includes('STARRED'),
          labels
        });
      } catch (err) {
        console.error(`GmailService: Failed to fetch message metadata for ${msg.id}:`, err);
      }
    }

    return {
      emails,
      nextPageToken: response.data.nextPageToken || undefined
    };
  }

  /**
   * Returns the total number of unread messages (the UNREAD system label's message count).
   */
  public static async getUnreadCount(userId: string): Promise<number> {
    const gmail = await this.getGmailClient(userId);
    const label = await gmail.users.labels.get({ userId: 'me', id: 'UNREAD' });
    return label.data.messagesTotal || 0;
  }

  /**
   * Retrieves full details for a single email message, including decoded HTML body.
   */
  public static async getEmail(userId: string, emailId: string): Promise<EmailMessage> {
    const gmail = await this.getGmailClient(userId);
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: emailId
    });

    const headers = detail.data.payload?.headers || [];
    const labels = detail.data.labelIds || [];
    const body = this.decodeBody(detail.data.payload);

    return {
      id: detail.data.id!,
      threadId: detail.data.threadId!,
      from: this.getHeader(headers, 'From'),
      to: this.getHeader(headers, 'To'),
      subject: this.getHeader(headers, 'Subject'),
      date: this.getHeader(headers, 'Date'),
      snippet: detail.data.snippet || '',
      body,
      isRead: !labels.includes('UNREAD'),
      isStarred: labels.includes('STARRED'),
      labels
    };
  }

  /**
   * Modifies labels on an email (e.g. marking read, archive, toggle star)
   */
  public static async modifyEmail(
    userId: string,
    emailId: string,
    options: { addLabelIds?: string[]; removeLabelIds?: string[] }
  ): Promise<void> {
    const gmail = await this.getGmailClient(userId);
    await gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: {
        addLabelIds: options.addLabelIds,
        removeLabelIds: options.removeLabelIds
      }
    });
  }

  /**
   * Archives an email by removing it from INBOX.
   */
  public static async archiveEmail(userId: string, emailId: string): Promise<void> {
    await this.modifyEmail(userId, emailId, { removeLabelIds: ['INBOX'] });
  }

  /**
   * Deletes (trashes) an email.
   */
  public static async deleteEmail(userId: string, emailId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);
    await gmail.users.messages.trash({
      userId: 'me',
      id: emailId
    });
  }

  /**
   * Sends a new email. Supports HTML format.
   */
  public static async sendEmail(
    userId: string,
    to: string,
    subject: string,
    body: string,
    threadId?: string
  ): Promise<{ id: string; threadId: string }> {
    const gmail = await this.getGmailClient(userId);

    // Build raw email string matching RFC 2822
    const emailLines = [
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`
    ];

    if (threadId) {
      emailLines.push(`In-Reply-To: ${threadId}`);
      emailLines.push(`References: ${threadId}`);
    }

    emailLines.push('');
    emailLines.push(body);

    const email = emailLines.join('\r\n');
    const base64Safe = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: base64Safe,
        threadId: threadId
      }
    });

    return {
      id: response.data.id!,
      threadId: response.data.threadId!
    };
  }

  /**
   * Creates a draft email.
   */
  public static async createDraft(
    userId: string,
    to: string,
    subject: string,
    body: string,
    threadId?: string
  ): Promise<{ id: string }> {
    const gmail = await this.getGmailClient(userId);

    const emailLines = [
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`
    ];

    if (threadId) {
      emailLines.push(`In-Reply-To: ${threadId}`);
    }

    emailLines.push('');
    emailLines.push(body);

    const email = emailLines.join('\r\n');
    const base64Safe = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: base64Safe,
          threadId: threadId
        }
      }
    });

    return {
      id: response.data.id!
    };
  }
}
