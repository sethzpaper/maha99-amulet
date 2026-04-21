import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

export function initEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log('⚠️  SMTP not configured — email notifications disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  console.log('✅ Email transporter initialized');
  return transporter;
}

export function getEmailTransporter() {
  return transporter;
}

export async function sendLeaveRequestEmail(params: {
  to: string;
  userName: string;
  userEmail: string;
  leaveDate: string;
  leaveType: string;
  reason: string;
  requestId: string;
}) {
  const t = getEmailTransporter();
  if (!t) {
    console.warn('Email not sent — SMTP not configured');
    return { sent: false, reason: 'smtp-not-configured' };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = `[ขออนุมัติลา] ${params.userName} — ${params.leaveDate}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b8860b;">คำขอลางานใหม่</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>พนักงาน:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${params.userName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>อีเมล:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${params.userEmail}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>วันที่ลา:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${params.leaveDate}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>ประเภทการลา:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${params.leaveType}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>เหตุผล:</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${params.reason || '-'}</td></tr>
        <tr><td style="padding: 8px;"><b>Request ID:</b></td><td style="padding: 8px;"><code>${params.requestId}</code></td></tr>
      </table>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">ข้อความนี้ส่งอัตโนมัติจากระบบ Maha99 Amulet</p>
    </div>
  `;

  await t.sendMail({ from, to: params.to, subject, html });
  return { sent: true };
}
