// ============================================================
// Supabase Edge Function: auto-checkout
// ──────────────────────────────────────
// HTTP endpoint สำรองสำหรับ trigger auto-close ผ่าน external scheduler
// (ใช้กรณีที่ Supabase project ไม่มี pg_cron หรืออยู่บน Free tier)
//
// Deploy:
//   supabase functions deploy auto-checkout --no-verify-jwt
//
// Set secrets:
//   supabase secrets set AUTO_CHECKOUT_TOKEN=<random-strong-token>
//
// Schedule (เลือก 1):
//   - Cron-job.org / EasyCron / GitHub Actions cron
//     POST https://<PROJECT_REF>.supabase.co/functions/v1/auto-checkout
//     Header: x-auth-token: <AUTO_CHECKOUT_TOKEN>
//     เวลา: '1 17 * * *'  (= 00:01 ตามเวลาไทย)
//
//   - Supabase Cron (Beta) ถ้ามี
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const AUTH_TOKEN = Deno.env.get('AUTO_CHECKOUT_TOKEN') ?? '';

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-auth-token, content-type',
      },
    });
  }

  // ── auth ────────────────────────────────────────────────────────────────
  const presented = req.headers.get('x-auth-token') ?? '';
  if (!AUTH_TOKEN || presented !== AUTH_TOKEN) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // วิธีที่ 1 (แนะนำ): เรียก stored function ที่อยู่ใน DB
    const { data: rpcData, error: rpcErr } = await supabase.rpc('auto_close_stale_entries');

    if (!rpcErr) {
      const closed = Array.isArray(rpcData) ? (rpcData[0]?.closed_count ?? 0) : (rpcData ?? 0);
      return json({ ok: true, mode: 'rpc', closed_count: closed });
    }

    // วิธีที่ 2 (fallback): ทำใน TS เอง — ใช้ในกรณี migration ยังไม่ได้รัน
    console.warn('rpc auto_close_stale_entries failed, falling back:', rpcErr.message);

    const today = new Date();
    const todayDate = today.toISOString().slice(0, 10); // YYYY-MM-DD

    const { data: stale, error: selectErr } = await supabase
      .from('time_entries')
      .select('id, work_date, check_in_time, total_hours, overtime_hours, note')
      .eq('status', 'working')
      .lt('work_date', todayDate);

    if (selectErr) throw selectErr;

    let closed = 0;
    for (const row of stale ?? []) {
      const eod = new Date(`${row.work_date}T23:59:59+07:00`).toISOString();
      let total = row.total_hours ?? null;
      let overtime = row.overtime_hours ?? null;
      if (row.check_in_time) {
        const hrs = (new Date(eod).getTime() - new Date(row.check_in_time).getTime()) / 3_600_000;
        total = Math.max(0, Number(hrs.toFixed(2)));
        overtime = Math.max(0, Number((hrs - 8).toFixed(2)));
      }
      const stamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
      const newNote = (row.note ? `${row.note} | ` : '') + `[auto-out edge @ ${stamp}]`;

      const { error: updErr } = await supabase
        .from('time_entries')
        .update({
          status: 'auto-out',
          check_out_time: eod,
          total_hours: total,
          overtime_hours: overtime,
          note: newNote,
        })
        .eq('id', row.id);
      if (!updErr) closed += 1;
    }

    return json({ ok: true, mode: 'fallback', closed_count: closed });
  } catch (err) {
    return json(
      { ok: false, error: (err as Error).message ?? 'unknown' },
      500,
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
