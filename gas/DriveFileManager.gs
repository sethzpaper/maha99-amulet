/**
 * Google Apps Script — DriveFileManager
 * =======================================
 * Web App endpoint สำหรับรับไฟล์ (ภาพลงเวลา, PDF รายงาน, ไฟล์แนบ)
 * แล้วบันทึกลง Google Drive แบบแยกโฟลเดอร์ตามสถานะงาน
 *
 * Deploy as: Web App → Execute as: Me → Who has access: Anyone (or Anyone with Google account)
 *
 * POST body (application/json):
 * {
 *   "fileData":   "<base64 string>",
 *   "fileName":   "checkin-1714000000.jpg",
 *   "mimeType":   "image/jpeg",           // image/jpeg | image/png | application/pdf
 *   "fileType":   "photo",                // "photo" | "report" | "attachment"
 *   "status":     "working",              // สถานะงาน (ดูตาราง STATUS_FOLDERS ด้านล่าง)
 *   "userId":     "uid_abc123",
 *   "userName":   "สมชาย ใจดี",
 *   "workDate":   "2026-04-25",           // YYYY-MM-DD
 *   "month":      "2026-04"              // YYYY-MM  (สำหรับ report เท่านั้น)
 * }
 *
 * Response:
 * {
 *   "ok": true,
 *   "fileId":       "1XxXxXxX...",
 *   "permanentUrl": "https://drive.google.com/file/d/1XxXx.../view",
 *   "downloadUrl":  "https://drive.google.com/uc?export=download&id=1XxXx...",
 *   "webContentLink": "...",   // signed-style direct download
 *   "folder":       "working"
 * }
 */

// ─────────────────────────────────────────────
// CONFIG — เปลี่ยนเฉพาะ ROOT_FOLDER_ID
// ─────────────────────────────────────────────
var ROOT_FOLDER_ID = '1C1Kej0lIHjW1N80RtwytIg6da_oGyEv8';

// โฟลเดอร์หลักแยกตามประเภทไฟล์
var TYPE_FOLDERS = {
  photo:      'รูปลงเวลา',
  report:     'รายงานประจำเดือน',
  attachment: 'ไฟล์แนบ'
};

// โฟลเดอร์ย่อยตามสถานะงาน (สำหรับ photo และ attachment)
var STATUS_FOLDERS = {
  'working':    'working',
  'out':        'out',
  'late':       'late',
  'leave':      'leave',
  'auto-leave': 'auto-leave',
  'auto-out':   'auto-out',
  'pending':    'pending',
  'approved':   'approved',
  'rejected':   'rejected',
  'cancelled':  'cancelled'
};

// ─────────────────────────────────────────────
// MAIN — Web App entry point
// ─────────────────────────────────────────────
function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    validateParams(params);

    var targetFolder = resolveTargetFolder(params);
    var fileBlob     = buildBlob(params);
    var saved        = targetFolder.createFile(fileBlob);

    // ทำให้ไฟล์อ่านได้โดยที่มี link (anyone with link can view)
    saved.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = saved.getId();

    return jsonResponse({
      ok:             true,
      fileId:         fileId,
      permanentUrl:   'https://drive.google.com/file/d/' + fileId + '/view',
      downloadUrl:    'https://drive.google.com/uc?export=download&id=' + fileId,
      webContentLink: saved.getDownloadUrl(),   // short-lived signed URL จาก Drive
      folder:         targetFolder.getName()
    });

  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 400);
  }
}

// GET: health check + โครงสร้างโฟลเดอร์ปัจจุบัน
function doGet(e) {
  try {
    var root    = DriveApp.getFolderById(ROOT_FOLDER_ID);
    var summary = buildFolderSummary(root);
    return jsonResponse({ ok: true, rootName: root.getName(), structure: summary });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 400);
  }
}

// ─────────────────────────────────────────────
// FOLDER HELPERS
// ─────────────────────────────────────────────

/**
 * หาโฟลเดอร์ที่ควรบันทึกไฟล์
 *
 * photo      → /รูปลงเวลา/<status>/
 * report     → /รายงานประจำเดือน/<YYYY-MM>/
 * attachment → /ไฟล์แนบ/<status>/
 */
function resolveTargetFolder(params) {
  var root     = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var typeName = TYPE_FOLDERS[params.fileType] || 'ไฟล์แนบ';
  var typeFolder = getOrCreateFolder(root, typeName);

  if (params.fileType === 'report') {
    // แยกตามเดือน เช่น 2026-04
    var monthLabel = params.month || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
    return getOrCreateFolder(typeFolder, monthLabel);
  }

  // photo และ attachment — แยกตามสถานะ
  var statusKey = (params.status || '').toLowerCase().replace(/\s+/g, '-');
  var folderName = STATUS_FOLDERS[statusKey] || statusKey || 'other';
  return getOrCreateFolder(typeFolder, folderName);
}

/** หาโฟลเดอร์ตามชื่อใน parent ถ้าไม่มีให้สร้าง */
function getOrCreateFolder(parent, name) {
  var iter = parent.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(name);
}

// ─────────────────────────────────────────────
// BLOB HELPERS
// ─────────────────────────────────────────────

function buildBlob(params) {
  var bytes = Utilities.base64Decode(params.fileData);
  return Utilities.newBlob(bytes, params.mimeType || 'application/octet-stream', params.fileName);
}

// ─────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────

function validateParams(p) {
  if (!p.fileData) throw new Error('fileData is required');
  if (!p.fileName) throw new Error('fileName is required');
  if (!p.fileType) throw new Error('fileType is required (photo|report|attachment)');
  if (!TYPE_FOLDERS[p.fileType]) throw new Error('unknown fileType: ' + p.fileType);
}

// ─────────────────────────────────────────────
// RESPONSE HELPER
// ─────────────────────────────────────────────

function jsonResponse(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─────────────────────────────────────────────
// FOLDER SUMMARY (สำหรับ doGet)
// ─────────────────────────────────────────────

function buildFolderSummary(folder) {
  var result = [];
  var subIter = folder.getFolders();
  while (subIter.hasNext()) {
    var sub = subIter.next();
    var fileCount = sub.getFiles();
    var count = 0;
    while (fileCount.hasNext()) { fileCount.next(); count++; }
    result.push({ name: sub.getName(), files: count, id: sub.getId() });
  }
  return result;
}
