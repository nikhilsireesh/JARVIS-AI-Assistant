import { google } from 'googleapis';
import { GoogleAuthService } from './GoogleAuthService';

export interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  sheets: string[]; // List of sheet names/tabs
}

export class SheetsService {
  /**
   * Helper to retrieve Sheets API client.
   */
  private static async getSheetsClient(userId: string) {
    const auth = await GoogleAuthService.getAuthenticatedClient(userId);
    return google.sheets({ version: 'v4', auth });
  }

  /**
   * Creates a new Google Spreadsheet.
   */
  public static async createSpreadsheet(userId: string, title: string): Promise<SpreadsheetInfo> {
    const sheets = await this.getSheetsClient(userId);
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title
        }
      }
    });

    const data = response.data;
    return {
      spreadsheetId: data.spreadsheetId!,
      title: data.properties?.title || '',
      sheets: (data.sheets || []).map(s => s.properties?.title || '')
    };
  }

  /**
   * Retrieves spreadsheet metadata and list of sheet names.
   */
  public static async getSpreadsheetInfo(userId: string, spreadsheetId: string): Promise<SpreadsheetInfo> {
    const sheets = await this.getSheetsClient(userId);
    const response = await sheets.spreadsheets.get({
      spreadsheetId
    });

    const data = response.data;
    return {
      spreadsheetId: data.spreadsheetId!,
      title: data.properties?.title || '',
      sheets: (data.sheets || []).map(s => s.properties?.title || '')
    };
  }

  /**
   * Reads data from a specific range.
   */
  public static async readRange(userId: string, spreadsheetId: string, range: string): Promise<any[][]> {
    const sheets = await this.getSheetsClient(userId);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    return response.data.values || [];
  }

  /**
   * Writes data to a specific range (overwrites existing).
   */
  public static async writeRange(
    userId: string,
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<{ updatedRange: string; updatedRows: number; updatedColumns: number }> {
    const sheets = await this.getSheetsClient(userId);
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values
      }
    });

    const result = response.data;
    return {
      updatedRange: result.updatedRange || range,
      updatedRows: result.updatedRows || 0,
      updatedColumns: result.updatedColumns || 0
    };
  }

  /**
   * Appends data to a sheet (automatically finds the last row).
   */
  public static async appendRows(
    userId: string,
    spreadsheetId: string,
    range: string, // Sheet name or general range like "Sheet1!A:Z"
    values: any[][]
  ): Promise<{ updatedRange: string; updatedRows: number; updatedColumns: number }> {
    const sheets = await this.getSheetsClient(userId);
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values
      }
    });

    const result = response.data.updates || {};
    return {
      updatedRange: result.updatedRange || range,
      updatedRows: result.updatedRows || 0,
      updatedColumns: result.updatedColumns || 0
    };
  }

  /**
   * Clears all values from a range.
   */
  public static async clearRange(userId: string, spreadsheetId: string, range: string): Promise<void> {
    const sheets = await this.getSheetsClient(userId);
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range
    });
  }
}
