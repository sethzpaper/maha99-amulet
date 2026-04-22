import { Router, Request, Response } from 'express';
import { getSupabaseAdmin } from '../services/supabaseAdmin';

const router = Router();

type LeaderboardRow = {
  rank: number;
  creator: string;
  name: string;
  value: number;
};

const numberOrZero = (value: unknown) => Number(value) || 0;

function sortAndRank(totals: Map<string, number>): LeaderboardRow[] {
  return Array.from(totals.entries())
    .map(([creator, value]) => ({ creator, name: creator, value }))
    .filter((item) => item.creator && item.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((item, index) => ({ rank: index + 1, ...item }));
}

async function videoLeaderboard(metric: 'views' | 'likes-fb' | 'likes-tt') {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('video_record').select('*');
  if (error) throw error;

  const totals = new Map<string, number>();
  (data || []).forEach((row: any) => {
    const creator = row.creator || 'ไม่ระบุ';
    const value =
      metric === 'views'
        ? numberOrZero(row.fb_views) + numberOrZero(row.tt_views)
        : metric === 'likes-fb'
        ? numberOrZero(row.fb_likes)
        : numberOrZero(row.tt_likes);
    totals.set(creator, (totals.get(creator) || 0) + value);
  });

  return sortAndRank(totals);
}

router.get('/views', async (_req: Request, res: Response) => {
  try {
    res.json(await videoLeaderboard('views'));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/likes-fb', async (_req: Request, res: Response) => {
  try {
    res.json(await videoLeaderboard('likes-fb'));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/likes-tt', async (_req: Request, res: Response) => {
  try {
    res.json(await videoLeaderboard('likes-tt'));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/hours', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('time_entries')
      .select('user_name,total_hours');
    if (error) throw error;

    const totals = new Map<string, number>();
    (data || []).forEach((row: any) => {
      const creator = row.user_name || 'ไม่ระบุ';
      totals.set(creator, (totals.get(creator) || 0) + numberOrZero(row.total_hours));
    });

    res.json(sortAndRank(totals));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
