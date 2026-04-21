import { Router, Request, Response } from 'express';
import { getSupabaseAdmin } from '../services/supabaseAdmin';

const router = Router();

const requireSuperAdmin = (req: Request, res: Response, next: any) => {
  if (req.headers['x-role'] !== 'super_admin') {
    return res.status(403).json({ error: 'เฉพาะ super admin' });
  }
  next();
};

// GET /api/tracked-accounts?platform=facebook|tiktok&competitor=true|false
router.get('/', async (req: Request, res: Response) => {
  try {
    const { platform, competitor } = req.query as { platform?: string; competitor?: string };
    const supabase = getSupabaseAdmin();
    let q = supabase.from('tracked_social_accounts').select('*').eq('is_active', true).order('account_name');
    if (platform) q = q.eq('platform', platform);
    if (competitor !== undefined) q = q.eq('is_competitor', competitor === 'true');
    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { platform, account_name, account_url, account_handle, is_competitor, note } = req.body;
    if (!platform || !account_name || !account_url) {
      return res.status(400).json({ error: 'platform, account_name, account_url required' });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tracked_social_accounts')
      .insert({ platform, account_name, account_url, account_handle, is_competitor: !!is_competitor, note })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, account: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tracked_social_accounts')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, account: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('tracked_social_accounts').update({ is_active: false }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
