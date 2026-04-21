import { sheets_v4 } from 'googleapis';
import { SocialPost } from '../../src/types';

// This will be injected from the server
let sheetsService: sheets_v4.Sheets | null = null;

export function setSheetsService(service: sheets_v4.Sheets): void {
  sheetsService = service;
}

export async function appendToSpreadsheet(
  sheetName: string,
  posts: SocialPost[]
): Promise<void> {
  if (!sheetsService) {
    console.warn('[SheetService] Sheets service not initialized');
    return;
  }

  try {
    const spreadsheetId = process.env.AMULETS_SHEET_ID;
    if (!spreadsheetId) {
      console.warn('[SheetService] AMULETS_SHEET_ID not configured');
      return;
    }

    // Convert posts to rows format: [id, content, link, engagement, timestamp]
    const rows = posts.map(post => [post.id, post.content, post.link, post.engagement.toString(), post.timestamp]);

    if (rows.length === 0) {
      console.log('[SheetService] No rows to append');
      return;
    }

    console.log(`[SheetService] Appending ${rows.length} rows to ${sheetName}`);

    const request = {
      spreadsheetId,
      range: `${sheetName}!A2`, // Start from row 2 to skip header
      valueInputOption: 'RAW' as const,
      insertDataOption: 'INSERT_ROWS' as const,
      requestBody: {
        values: rows,
      },
    };

    const response = await sheetsService.spreadsheets.values.append(request);

    console.log(`[SheetService] Successfully appended ${response.data.updates?.updatedRows} rows to ${sheetName}`);
  } catch (error) {
    console.error('[SheetService] Error appending to spreadsheet:', error);
  }
}

export async function createSheetIfNotExists(
  sheetName: string,
  headers: string[]
): Promise<void> {
  if (!sheetsService) {
    console.warn('[SheetService] Sheets service not initialized');
    return;
  }

  try {
    const spreadsheetId = process.env.AMULETS_SHEET_ID;
    if (!spreadsheetId) {
      console.warn('[SheetService] AMULETS_SHEET_ID not configured');
      return;
    }

    // Try to get spreadsheet metadata to check if sheet exists
    const spreadsheet = await sheetsService.spreadsheets.get({
      spreadsheetId,
    });

    const sheetExists = spreadsheet.data.sheets?.some(sheet => sheet.properties?.title === sheetName);

    if (!sheetExists) {
      console.log(`[SheetService] Creating new sheet: ${sheetName}`);

      // Add new sheet
      await sheetsService.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      // Add headers
      await sheetsService.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:E1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });

      console.log(`[SheetService] Sheet ${sheetName} created with headers`);
    } else {
      console.log(`[SheetService] Sheet ${sheetName} already exists`);
    }
  } catch (error) {
    console.error('[SheetService] Error creating sheet:', error);
  }
}
