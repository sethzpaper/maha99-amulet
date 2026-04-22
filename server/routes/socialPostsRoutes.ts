import { Router, Request, Response } from 'express';
import { getSupabaseAdmin } from '../services/supabaseAdmin';

const router = Router();

const numberOrZero = (value: unknown) => Number(value) || 0;
const emptyToNull = (value: unknown) => value === '' ? null : value;

function toSocialPost(row: any) {
  return {
    id: row.id,
    platform: row.platform,
    videoId: row.video_id || row.videoId || '',
    content: row.content || row.caption || '',
    link: row.link || row.post_url || '',
    postUrl: row.post_url || row.link || '',
    engagement: numberOrZero(row.engagement ?? row.likes ?? row.views),
    timestamp: row.timestamp || row.posted_at || row.created_at || '',
    postedAt: row.posted_at || row.timestamp || '',
    creator: row.creator || '',
    views: numberOrZero(row.views),
    likes: numberOrZero(row.likes),
    shares: numberOrZero(row.shares),
    comments: numberOrZero(row.comments),
  };
}

function toDbSocialPost(body: any) {
  const fields: Record<string, unknown> = {};
  const map: Record<string, string> = {
    platform: 'platform',
    content: 'content',
    link: 'link',
    postUrl: 'post_url',
    engagement: 'engagement',
    timestamp: 'timestamp',
    postedAt: 'posted_at',
    videoId: 'video_id',
    creator: 'creator',
    views: 'views',
    likes: 'likes',
    shares: 'shares',
    comments: 'comments',
  };

  Object.entries(map).forEach(([clientKey, dbKey]) => {
    if (clientKey in body) fields[dbKey] = emptyToNull(body[clientKey]);
    if (dbKey in body) fields[dbKey] = emptyToNull(body[dbKey]);
  });

  return fields;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { platform } = req.query as { platform?: string };
    const supabase = getSupabaseAdmin();
    let query = supabase.from('social_posts').select('*').order('posted_at', { ascending: false });
    if (platform) query = query.eq('platform', platform);
    if (req.query.videoId) query = query.eq('video_id', req.query.videoId);

    const { data, error } = await query;
    if (error) throw error;
    res.json((data || []).map(toSocialPost));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const post = toDbSocialPost(req.body);
    if (!post.posted_at) post.posted_at = new Date().toISOString();
    if (!post.platform || !post.content) {
      return res.status(400).json({ error: 'platform and content are required' });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('social_posts')
      .insert(post)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, post: toSocialPost(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const post = toDbSocialPost(req.body);
    post.updated_at = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('social_posts')
      .update(post)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, post: toSocialPost(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('social_posts').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
