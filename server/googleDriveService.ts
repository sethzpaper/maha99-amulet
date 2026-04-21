import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

let auth: GoogleAuth | null = null;

export async function getGoogleAuth() {
  if (auth) return auth;
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('Google credentials not found. Please set up credentials.json');
  }
  auth = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: SCOPES,
  });
  return auth;
}

export async function getSpreadsheetData(spreadsheetId: string, range: string) {
  const authClient = await getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return response.data.values || [];
}

export async function listDriveFiles(folderId: string) {
  const authClient = await getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth: authClient });
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    spaces: 'drive',
    fields: 'files(id, name, mimeType, createdTime, webViewLink)',
    pageSize: 1000,
  });
  return response.data.files || [];
}

export async function getFileDownloadUrl(fileId: string) {
  const authClient = await getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth: authClient });
  const response = await drive.files.get({
    fileId,
    fields: 'webViewLink, webContentLink, mimeType',
  });
  return response.data;
}

// ------- WRITE OPERATIONS (new) -------

/**
 * อัปโหลดรูปภาพไปยัง Google Drive folder
 * คืน { id, webViewLink }
 */
export async function uploadPhotoToDrive(
  folderId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<{ id: string; webViewLink: string }> {
  const authClient = await getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth: authClient });

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType,
    body: Readable.from(buffer),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, webViewLink',
  });

  // ตั้ง permission ให้เปิดดูได้ด้วย link (ใครมีลิงก์ก็เปิดได้)
  if (response.data.id) {
    try {
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: { role: 'reader', type: 'anyone' },
      });
    } catch (e) {
      console.warn('permission setup failed:', e);
    }
  }

  return {
    id: response.data.id || '',
    webViewLink: response.data.webViewLink || '',
  };
}

/**
 * สร้าง Google Sheet ใหม่ในโฟลเดอร์ที่ระบุ แล้วเขียนข้อมูล
 * rows[0] ควรเป็น header
 */
export async function createReportSheet(
  folderId: string,
  sheetTitle: string,
  rows: (string | number)[][]
): Promise<{ id: string; webViewLink: string }> {
  const authClient = await getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth: authClient });
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // 1) create blank sheet in target folder (create as native Google Sheet)
  const createRes = await drive.files.create({
    requestBody: {
      name: sheetTitle,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId],
    },
    fields: 'id, webViewLink',
  });
  const spreadsheetId = createRes.data.id!;

  // 2) write values
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });

  // 3) bold header row
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.95, green: 0.85, blue: 0.5 },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      },
    });
  } catch (e) {
    console.warn('format header failed:', e);
  }

  return {
    id: spreadsheetId,
    webViewLink: createRes.data.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}
