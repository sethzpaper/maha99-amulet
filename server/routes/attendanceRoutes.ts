import { Router, Request, Response } from 'express';
import multer from 'multer';
import { getSupabaseAdmin } from '../services/supabaseAdmin';
import { uploadPhotoToDrive, createReportSheet } from '../googleDriveService';
import { sendLeaveRequestEmail } from '../services/emailService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ATTENDANCE_PHOTOS_FOLDER = process.env.ATTENDANCE_PHOTOS_FOLDER_ID || '1cc1Q2N1nMPEy3zorJuuV_hOPMsZ3qruu';
const MONTHLY_REPORTS_FOLDER = process.env.MONTHLY_REPORTS_FOLDER_ID || '1qRaXMQmw09QyqoHqFrFGe4u09bsa_YpX';

// =============================================
// POST /api/attendance/check-in
// body: multipart/form-data { userId, userName, userEmail, photo, note? }
// =============================================
router.post('/check-in', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    const { userId, userName, userEmail, note } = req.body;
    if (!userId || !userName) return res.status(400).json({ error: 'userId and userName are required' });

    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    // upload photo ถ้ามี
    let photoUrl = '', photoDriveId = '';
    if (req.file) {
      const fileName = `checkin_${userName}_${today}_${Date.now()}.jpg`;
      const uploaded = await uploadPhotoToDrive(ATTENDANCE_PHOTOS_FOLDER, fileName, req.file.buffer, req.file.mimetype);
      photoUrl = uploaded.webViewLink;
      photoDriveId = uploaded.id;
    }

    // late check (after 12:00)
    const status = now.getHours() >= 12 ? 'late' : 'working';

    // upsert — ถ้ามี record วันนี้อยู่แล้วให้ update, ไม่มีให้ insert
    const { data, error } = await supabase
      .from('time_entries')
      .upsert({
        user_id: userId,
        user_name: userName,
        user_email: userEmail,
        work_date: today,
        check_in_time: now.toISOString(),
        check_in_photo_url: photoUrl,
        check_in_photo_drive_id: photoDriveId,
        status,
        note,
      }, { onConflict: 'user_id,work_date' })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, entry: data, photoUrl });
  } catch (err: any) {
    console.error('check-in error:', err);
    res.status(500).json({ error: err.message || 'check-in failed' });
  }
});

// =============================================
// POST /api/attendance/check-out
// =============================================
router.post('/check-out', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    const { userId, userName, note } = req.body;
    if (!userId || !userName) return res.status(400).json({ error: 'userId and userName are required' });

    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    let photoUrl = '', photoDriveId = '';
    if (req.file) {
      const fileName = `checkout_${userName}_${today}_${Date.now()}.jpg`;
      const uploaded = await uploadPhotoToDrive(ATTENDANCE_PHOTOS_FOLDER, fileName, req.file.buffer, req.file.mimetype);
      photoUrl = uploaded.webViewLink;
      photoDriveId = uploaded.id;
    }

    // หา record ของวันนี้ก่อนเพื่อคำนวณชั่วโมง
    const { data: existing } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('work_date', today)
      .maybeSingle();

    let totalHours = 0, overtime = 0;
    if (existing?.check_in_time) {
      const ms = now.getTime() - new Date(existing.check_in_time).getTime();
      totalHours = Math.round((ms / 3600000) * 100) / 100;
      overtime = totalHours > 9 ? Math.round((totalHours - 9) * 100) / 100 : 0;
    }

    const { data, error } = await supabase
      .from('time_entries')
      .upsert({
        user_id: userId,
        user_name: userName,
        work_date: today,
        check_out_time: now.toISOString(),
        check_out_photo_url: photoUrl,
        check_out_photo_drive_id: photoDriveId,
        total_hours: totalHours,
        overtime_hours: overtime,
        status: 'out',
        note,
      }, { onConflict: 'user_id,work_date' })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, entry: data, totalHours, overtime });
  } catch (err: any) {
    console.error('check-out error:', err);
    res.status(500).json({ error: err.message || 'check-out failed' });
  }
});

// =============================================
// GET /api/attendance/entries?month=YYYY-MM&userId=...
// =============================================
router.get('/entries', async (req: Request, res: Response) => {
  try {
    const { userId, month } = req.query as { userId?: string; month?: string };
    const supabase = getSupabaseAdmin();
    let q = supabase.from('time_entries').select('*').order('work_date', { ascending: false });
    if (userId) q = q.eq('user_id', userId);
    if (month) {
      const start = `${month}-01`;
      const endDate = new Date(start);
      endDate.setMonth(endDate.getMonth() + 1);
      q = q.gte('work_date', start).lt('work_date', endDate.toISOString().slice(0, 10));
    }
    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// POST /api/leave/request
// body: { userId, userName, userEmail, leaveDate, leaveType, reason, managerEmail }
// =============================================
router.post('/leave/request', async (req: Request, res: Response) => {
  try {
    const { userId, userName, userEmail, leaveDate, leaveType, reason, managerEmail } = req.body;
    if (!userId || !userName || !leaveDate) {
      return res.status(400).json({ error: 'userId, userName, leaveDate are required' });
    }

    const supabase = getSupabaseAdmin();

    // ตรวจโควต้า 4 ครั้ง/เดือน
    const { data: quota, error: qErr } = await supabase.rpc('check_monthly_leave_quota', {
      p_user_id: userId,
      p_leave_date: leaveDate,
    });
    if (qErr) throw qErr;

    const qr = Array.isArray(quota) ? quota[0] : quota;
    if (qr && !qr.allowed) {
      return res.status(400).json({
        error: `ลาเต็มโควต้าเดือนนี้แล้ว (ใช้ไป ${qr.used_count}/4 ครั้ง)`,
        quota: qr,
      });
    }

    // สร้างคำขอลา
    const { data: leave, error } = await supabase
      .from('leave_requests')
      .insert({
        user_id: userId,
        user_name: userName,
        user_email: userEmail,
        leave_date: leaveDate,
        leave_type: leaveType || 'personal',
        reason,
        manager_email: managerEmail,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;

    // ส่งอีเมลแจ้งผู้จัดการ
    let emailResult: any = { sent: false };
    if (managerEmail) {
      try {
        emailResult = await sendLeaveRequestEmail({
          to: managerEmail,
          userName,
          userEmail: userEmail || '-',
          leaveDate,
          leaveType: leaveType || 'personal',
          reason: reason || '',
          requestId: leave.id,
        });
        if (emailResult.sent) {
          await supabase.from('leave_requests').update({ email_sent: true }).eq('id', leave.id);
        }
      } catch (mailErr) {
        console.error('email send failed:', mailErr);
      }
    }

    res.json({ success: true, leave, quota: qr, email: emailResult });
  } catch (err: any) {
    console.error('leave request error:', err);
    res.status(500).json({ error: err.message || 'leave request failed' });
  }
});

// =============================================
// GET /api/leave/quota?userId=...&month=YYYY-MM-DD
// =============================================
router.get('/leave/quota', async (req: Request, res: Response) => {
  try {
    const { userId, date } = req.query as { userId?: string; date?: string };
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const supabase = getSupabaseAdmin();
    const refDate = date || new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.rpc('check_monthly_leave_quota', {
      p_user_id: userId,
      p_leave_date: refDate,
    });
    if (error) throw error;
    res.json(Array.isArray(data) ? data[0] : data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// GET /api/leave/requests?userId=...&status=...
// =============================================
router.get('/leave/requests', async (req: Request, res: Response) => {
  try {
    const { userId, status } = req.query as { userId?: string; status?: string };
    const supabase = getSupabaseAdmin();
    let q = supabase.from('leave_requests').select('*').order('leave_date', { ascending: false });
    if (userId) q = q.eq('user_id', userId);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// POST /api/leave/:id/decision   body: { decision: 'approved'|'rejected', approverId, note }
// =============================================
router.post('/leave/:id/decision', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { decision, approverId, note } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be approved or rejected' });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: decision,
        approved_by: approverId,
        approved_at: new Date().toISOString(),
        manager_note: note,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, leave: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// POST /api/reports/monthly    body: { month: 'YYYY-MM' }
// สร้างไฟล์ Google Sheet ในโฟลเดอร์ MONTHLY_REPORTS_FOLDER
// =============================================
router.post('/reports/monthly', async (req: Request, res: Response) => {
  try {
    const { month } = req.body as { month?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month required (YYYY-MM)' });
    }
    const supabase = getSupabaseAdmin();
    const start = `${month}-01`;
    const endDate = new Date(start);
    endDate.setMonth(endDate.getMonth() + 1);
    const end = endDate.toISOString().slice(0, 10);

    // ดึงข้อมูลลงเวลา + ข้อมูลการลา
    const [{ data: entries }, { data: leaves }] = await Promise.all([
      supabase.from('time_entries').select('*').gte('work_date', start).lt('work_date', end).order('work_date'),
      supabase.from('leave_requests').select('*').gte('leave_date', start).lt('leave_date', end).order('leave_date'),
    ]);

    // build rows
    const header = ['วันที่', 'ชื่อพนักงาน', 'เข้างาน', 'ออกงาน', 'ชั่วโมงรวม', 'OT', 'สถานะ', 'รูปเข้า', 'รูปออก', 'หมายเหตุ'];
    const entryRows = (entries || []).map(e => [
      e.work_date,
      e.user_name,
      e.check_in_time ? new Date(e.check_in_time).toLocaleTimeString('th-TH') : '-',
      e.check_out_time ? new Date(e.check_out_time).toLocaleTimeString('th-TH') : '-',
      e.total_hours || 0,
      e.overtime_hours || 0,
      e.status,
      e.check_in_photo_url || '',
      e.check_out_photo_url || '',
      e.note || '',
    ]);
    const leaveHeader = ['', '', '', '', '', '', '', '', '', ''];
    const leaveSectionHeader = ['=== การลา ==='];
    const leaveCols = ['วันลา', 'ชื่อพนักงาน', 'ประเภท', 'เหตุผล', 'สถานะ', 'ผู้อนุมัติ', 'วันที่อนุมัติ'];
    const leaveRows = (leaves || []).map(l => [
      l.leave_date,
      l.user_name,
      l.leave_type,
      l.reason || '',
      l.status,
      l.approved_by || '',
      l.approved_at ? new Date(l.approved_at).toLocaleString('th-TH') : '',
    ]);

    const rows: (string | number)[][] = [
      header,
      ...entryRows,
      leaveHeader,
      leaveSectionHeader,
      leaveCols,
      ...leaveRows,
    ];

    const sheet = await createReportSheet(
      MONTHLY_REPORTS_FOLDER,
      `รายงานประจำเดือน ${month}`,
      rows
    );

    res.json({
      success: true,
      spreadsheetId: sheet.id,
      webViewLink: sheet.webViewLink,
      totalEntries: entryRows.length,
      totalLeaves: leaveRows.length,
    });
  } catch (err: any) {
    console.error('monthly report error:', err);
    res.status(500).json({ error: err.message || 'report failed' });
  }
});

export default router;
