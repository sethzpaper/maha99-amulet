import cron, { ScheduledTask } from 'node-cron';
import { scrapeFacebookProfile } from '../scrapers/facebookScraper';
import { scrapeTikTokProfile } from '../scrapers/tikTokScraper';
import { scrapeCompetitors, CompetitorAccount } from '../scrapers/competitorScraper';
import { appendToSpreadsheet } from './sheetService';

export interface SchedulerConfig {
  facebookProfileId: string;
  tikTokUsername: string;
  competitorAccounts: CompetitorAccount[];
  cronSchedule?: string; // Default: every 6 hours "0 */6 * * *"
  enabled?: boolean;
}

export class ScraperScheduler {
  private config: SchedulerConfig;
  private tasks: ScheduledTask[] = [];
  private enabled: boolean;

  constructor(config: SchedulerConfig) {
    this.config = {
      ...config,
      cronSchedule: config.cronSchedule || '0 */6 * * *',
      enabled: config.enabled !== false,
    };
    this.enabled = this.config.enabled!;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async scrapeUserAccounts(): Promise<void> {
    console.log('[Scheduler] Starting user account scraping...');

    try {
      // Scrape Facebook
      console.log('[Scheduler] Scraping Facebook profile...');
      const facebookPosts = await scrapeFacebookProfile(this.config.facebookProfileId);
      if (facebookPosts.length > 0) {
        console.log(`[Scheduler] Scraped ${facebookPosts.length} Facebook posts`);
        await appendToSpreadsheet('FacebookPosts', facebookPosts);
      }

      await this.delay(3000);

      // Scrape TikTok
      console.log('[Scheduler] Scraping TikTok profile...');
      const tikTokPosts = await scrapeTikTokProfile(this.config.tikTokUsername);
      if (tikTokPosts.length > 0) {
        console.log(`[Scheduler] Scraped ${tikTokPosts.length} TikTok posts`);
        await appendToSpreadsheet('TikTokPosts', tikTokPosts);
      }

      console.log('[Scheduler] User account scraping completed successfully');
    } catch (error) {
      console.error('[Scheduler] Error during user account scraping:', error);
    }
  }

  private async scrapeCompetitorAccounts(): Promise<void> {
    console.log('[Scheduler] Starting competitor account scraping...');

    try {
      if (this.config.competitorAccounts.length === 0) {
        console.log('[Scheduler] No competitor accounts configured');
        return;
      }

      const competitorResults = await scrapeCompetitors(this.config.competitorAccounts);

      // Process Facebook competitors
      const facebookCompetitors = this.config.competitorAccounts.filter(a => a.platform === 'facebook');
      for (const competitor of facebookCompetitors) {
        const posts = competitorResults.get(competitor.id) || [];
        if (posts.length > 0) {
          console.log(`[Scheduler] Scraped ${posts.length} posts from competitor ${competitor.name}`);
          await appendToSpreadsheet('CompetitorFacebook', posts);
        }
      }

      // Process TikTok competitors
      const tikTokCompetitors = this.config.competitorAccounts.filter(a => a.platform === 'tiktok');
      for (const competitor of tikTokCompetitors) {
        const posts = competitorResults.get(competitor.id) || [];
        if (posts.length > 0) {
          console.log(`[Scheduler] Scraped ${posts.length} posts from competitor ${competitor.name}`);
          await appendToSpreadsheet('CompetitorTikTok', posts);
        }
      }

      console.log('[Scheduler] Competitor account scraping completed successfully');
    } catch (error) {
      console.error('[Scheduler] Error during competitor account scraping:', error);
    }
  }

  async runImmediately(): Promise<void> {
    console.log('[Scheduler] Running scraping tasks immediately...');
    await this.scrapeUserAccounts();
    await this.delay(5000);
    await this.scrapeCompetitorAccounts();
  }

  start(): void {
    if (!this.enabled) {
      console.log('[Scheduler] Scheduler is disabled');
      return;
    }

    console.log(`[Scheduler] Starting scheduler with cron: "${this.config.cronSchedule}"`);

    // Main scraping task
    const mainTask = cron.schedule(this.config.cronSchedule!, async () => {
      console.log('[Scheduler] Running scheduled scraping tasks');
      await this.scrapeUserAccounts();
      await this.delay(5000);
      await this.scrapeCompetitorAccounts();
    });

    this.tasks.push(mainTask);
    console.log('[Scheduler] Scheduler started successfully');
  }

  stop(): void {
    console.log('[Scheduler] Stopping scheduler...');
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    console.log('[Scheduler] Scheduler stopped');
  }

  isRunning(): boolean {
    return this.tasks.length > 0 && this.enabled;
  }
}

let schedulerInstance: ScraperScheduler | null = null;

export function initScheduler(config: SchedulerConfig): ScraperScheduler {
  if (schedulerInstance) {
    console.log('[Scheduler] Scheduler already initialized');
    return schedulerInstance;
  }

  schedulerInstance = new ScraperScheduler(config);
  return schedulerInstance;
}

export function getScheduler(): ScraperScheduler | null {
  return schedulerInstance;
}

export function stopScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
    schedulerInstance = null;
  }
}
