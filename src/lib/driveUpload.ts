/**
 * driveUpload.ts
 * ──────────────
 * ส่งไฟล์ไปยัง GAS Web App endpoint แล้วได้ Google Drive URL กลับมา
 *
 * ตั้งค่า env var:
 *   VITE_GAS_DRIVE_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
 */

const GAS_URL = import.meta.env.VITE_GAS_DRIVE_URL as string | undefined;

export type DriveFileType = 'photo' | 'report' | 'attachment';

export type AttendanceStatus =
  | 'working' | 'out' | 'late' | 'leave' | 'auto-leave' | 'auto-out'
  | 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface DriveUploadParams {
  file: Blob | File;
  fileName: string;
  fileType: DriveFileType;
  status?: AttendanceStatus;
  userId?: string;
  userName?: string;
  workDate?: string;  // YYYY-MM-DD
  month?: string;     // YYYY-MM  (สำหรับ report)
}

export interface DriveUploadResult {
  ok: true;
  fileId: string;
  permanentUrl: string;   // https://drive.google.com/file/d/.../view
  downloadUrl: string;    // direct download
  webContentLink: string; // signed-style URL
  folder: string;
}

/** แปลง Blob → base64 string */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // ตัด "data:...;base64," prefix ออก
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * อัปโหลดไฟล์ไปยัง Google Drive ผ่าน GAS Web App
 * คืนค่า DriveUploadResult ที่มี permanentUrl และ downloadUrl
 */
export async function uploadToDrive(params: DriveUploadParams): Promise<DriveUploadResult> {
  if (!GAS_URL) {
    throw new Error('VITE_GAS_DRIVE_URL is not set — ใส่ URL ของ GAS deployment ใน .env');
  }

  const base64 = await blobToBase64(params.file);
  const mimeType = params.file.type || 'application/octet-stream';

  const body = {
    fileData:  base64,
    fileName:  params.fileName,
    mimeType,
    fileType:  params.fileType,
    status:    params.status,
    userId:    params.userId,
    userName:  params.userName,
    workDate:  params.workDate,
    month:     params.month,
  };

  const res = await fetch(GAS_URL, {
    method: 'POST',
    // GAS Web App ต้องการ text/plain สำหรับ JSON payload (ไม่รับ application/json บน no-cors)
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`GAS responded ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'GAS upload failed');
  return data as DriveUploadResult;
}

// ─────────────────────────────────────────────
// Convenience wrappers
// ─────────────────────────────────────────────

/** อัปโหลดรูปลงเวลา (check-in / check-out) */
export async function uploadAttendancePhoto(
  photo: Blob,
  opts: { userId: string; userName: string; workDate: string; status: AttendanceStatus; kind: 'checkin' | 'checkout' }
): Promise<DriveUploadResult> {
  const ts = Date.now();
  return uploadToDrive({
    file:      photo,
    fileName:  `${opts.kind}-${opts.userId}-${opts.workDate}-${ts}.jpg`,
    fileType:  'photo',
    status:    opts.status,
    userId:    opts.userId,
    userName:  opts.userName,
    workDate:  opts.workDate,
  });
}

/** อัปโหลด PDF รายงานประจำเดือน */
export async function uploadMonthlyReport(
  pdfBlob: Blob,
  opts: { month: string; label?: string }
): Promise<DriveUploadResult> {
  const fileName = opts.label
    ? `${opts.label}-${opts.month}.pdf`
    : `monthly-report-${opts.month}.pdf`;
  return uploadToDrive({
    file:     pdfBlob,
    fileName,
    fileType: 'report',
    month:    opts.month,
  });
}

/** อัปโหลดไฟล์แนบทั่วไป (ใบลา, เอกสาร ฯลฯ) */
export async function uploadAttachment(
  file: File,
  opts: { status: AttendanceStatus; userId?: string }
): Promise<DriveUploadResult> {
  return uploadToDrive({
    file,
    fileName: file.name,
    fileType: 'attachment',
    status:   opts.status,
    userId:   opts.userId,
  });
}
