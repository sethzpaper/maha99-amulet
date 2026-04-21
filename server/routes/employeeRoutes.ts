import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '../services/supabaseAdmin';

const router = Router();

// GET /api/employees  — list all (public fields only, no password_hash)
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('employees')
      .select('id, employee_code, nickname, full_name, avatar_url, birthday, email, phone, position, start_date, role, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('nickname');
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/:id  — with badges
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: emp, error } = await supabase
      .from('employees')
      .select('id, employee_code, nickname, full_name, avatar_url, birthday, email, phone, position, start_date, role, is_active')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;

    const { data: badges } = await supabase
      .from('employee_badges')
      .select('id, awarded_at, note, badge:badges(id, name, description, icon, color)')
      .eq('employee_id', req.params.id);

    res.json({ ...emp, badges: badges || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees/login  body: { employeeId, password }
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { employeeId, password } = req.body;
    if (!employeeId || !password) return res.status(400).json({ error: 'ต้องระบุพนักงานและรหัสผ่าน' });

    const supabase = getSupabaseAdmin();
    const { data: emp, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .eq('is_active', true)
      .single();
    if (error || !emp) return res.status(401).json({ error: 'ไม่พบพนักงาน' });

    if (!emp.password_hash) {
      return res.status(401).json({ error: 'ยังไม่ได้ตั้งรหัสผ่าน — กรุณาติดต่อผู้ดูแล' });
    }

    const ok = await bcrypt.compare(password, emp.password_hash);
    if (!ok) return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });

    // ตัด password_hash ออกก่อนส่ง
    const { password_hash, ...safe } = emp;
    res.json({ success: true, employee: safe });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees  — create (super_admin only — ตรวจผ่าน header x-role)
router.post('/', async (req: Request, res: Response) => {
  try {
    if (req.headers['x-role'] !== 'super_admin') {
      return res.status(403).json({ error: 'เฉพาะ super admin เท่านั้น' });
    }

    const body = req.body;
    if (!body.nickname) return res.status(400).json({ error: 'nickname required' });

    const supabase = getSupabaseAdmin();
    const password_hash = body.password ? await bcrypt.hash(body.password, 10) : null;

    const { data, error } = await supabase
      .from('employees')
      .insert({
        employee_code: body.employee_code,
        nickname: body.nickname,
        full_name: body.full_name,
        avatar_url: body.avatar_url,
        birthday: body.birthday || null,
        email: body.email,
        phone: body.phone,
        position: body.position,
        start_date: body.start_date || null,
        role: body.role || 'user',
        password_hash,
      })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, employee: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/employees/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (req.headers['x-role'] !== 'super_admin') {
      return res.status(403).json({ error: 'เฉพาะ super admin เท่านั้น' });
    }

    const body = req.body;
    const update: any = {};
    const fields = ['employee_code', 'nickname', 'full_name', 'avatar_url', 'birthday', 'email', 'phone', 'position', 'start_date', 'role', 'is_active'];
    fields.forEach((f) => {
      if (f in body) update[f] = body[f] === '' ? null : body[f];
    });
    if (body.password) update.password_hash = await bcrypt.hash(body.password, 10);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('employees')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, employee: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/employees/:id  (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (req.headers['x-role'] !== 'super_admin') {
      return res.status(403).json({ error: 'เฉพาะ super admin เท่านั้น' });
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('employees').update({ is_active: false }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============== BADGES ==============
router.get('/badges/list', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('badges').select('*').order('name');
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/badges', async (req: Request, res: Response) => {
  try {
    if (req.headers['x-role'] !== 'super_admin') return res.status(403).json({ error: 'เฉพาะ super admin' });
    const { name, description, icon, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('badges').insert({ name, description, icon, color }).select().single();
    if (error) throw error;
    res.json({ success: true, badge: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/badges/:id', async (req: Request, res: Response) => {
  try {
    if (req.headers['x-role'] !== 'super_admin') return res.status(403).json({ error: 'เฉพาะ super admin' });
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('badges').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees/:id/badges  body: { badgeId, note }
router.post('/:id/badges', async (req: Request, res: Response) => {
  try {
    if (req.headers['x-role'] !== 'super_admin') return res.status(403).json({ error: 'เฉพาะ super admin' });
    const { badgeId, note } = req.body;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('employee_badges')
      .insert({ employee_id: req.params.id, badge_id: badgeId, note })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, award: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/badges/:awardId', async (req: Request, res: Response) => {
  try {
    if (req.headers['x-role'] !== 'super_admin') return res.status(403).json({ error: 'เฉพาะ super admin' });
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('employee_badges').delete().eq('id', req.params.awardId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
