import { Router, Request, Response } from 'express';
import { getSupabaseAdmin } from '../services/supabaseAdmin';

const router = Router();

const numberOrZero = (value: unknown) => Number(value) || 0;
const emptyToNull = (value: unknown) => value === '' ? null : value;

function toVideoRecord(row: any) {
  return {
    id: row.id,
    entryDate: row.entry_date || row.entryDate || '',
    fileName: row.file_name || row.fileName || '',
    productName: row.product_name || row.productName || '',
    productImage: row.product_image || row.productImage || '',
    driveLink: row.drive_link || row.driveLink || '',
    creator: row.creator || '',
    isPostedFB: Boolean(row.is_posted_fb ?? row.isPostedFB),
    isPostedTT: Boolean(row.is_posted_tt ?? row.isPostedTT),
    fbPostDate: row.fb_post_date || row.fbPostDate || '',
    ttPostDate: row.tt_post_date || row.ttPostDate || '',
    fbViews: numberOrZero(row.fb_views ?? row.fbViews),
    fbLikes: numberOrZero(row.fb_likes ?? row.fbLikes),
    ttViews: numberOrZero(row.tt_views ?? row.ttViews),
    ttLikes: numberOrZero(row.tt_likes ?? row.ttLikes),
  };
}

function toDbVideo(body: any) {
  const fields: Record<string, unknown> = {};
  const map: Record<string, string> = {
    entryDate: 'entry_date',
    fileName: 'file_name',
    productName: 'product_name',
    productImage: 'product_image',
    driveLink: 'drive_link',
    creator: 'creator',
    isPostedFB: 'is_posted_fb',
    isPostedTT: 'is_posted_tt',
    fbPostDate: 'fb_post_date',
    ttPostDate: 'tt_post_date',
    fbViews: 'fb_views',
    fbLikes: 'fb_likes',
    ttViews: 'tt_views',
    ttLikes: 'tt_likes',
  };

  Object.entries(map).forEach(([clientKey, dbKey]) => {
    if (clientKey in body) fields[dbKey] = emptyToNull(body[clientKey]);
    if (dbKey in body) fields[dbKey] = emptyToNull(body[dbKey]);
  });

  return fields;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('video_record')
      .select('*')
      .order('entry_date', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(toVideoRecord));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const record = toDbVideo(req.body);
    if (!record.entry_date) record.entry_date = new Date().toISOString().slice(0, 10);
    if (!record.file_name || !record.product_name) {
      return res.status(400).json({ error: 'fileName and productName are required' });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('video_record')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, video: toVideoRecord(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const record = toDbVideo(req.body);
    record.updated_at = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('video_record')
      .update(record)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, video: toVideoRecord(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('video_record').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
