import { SocialPost } from '../../src/types';
import { scrapeFacebookProfile } from './facebookScraper';
import { scrapeTikTokProfile } from './tikTokScraper';

export interface CompetitorAccount {
  id: string;
  platform: 'facebook' | 'tiktok';
  identifier: string; // Facebook ID or TikTok username
  name: string;
}

export interface CompetitorScraperOptions {
  accounts: CompetitorAccount[];
  delayBetweenRequests?: number;
}

export class CompetitorScraper {
  private accounts: CompetitorAccount[];
  private delayBetweenRequests: number;

  constructor(options: CompetitorScraperOptions) {
    this.accounts = options.accounts;
    this.delayBetweenRequests = options.delayBetweenRequests || 5000;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrapeAll(): Promise<Map<string, SocialPost[]>> {
    const results = new Map<string, SocialPost[]>();

    for (const account of this.accounts) {
      try {
        console.log(`Scraping competitor: ${account.name} (${account.platform})`);

        let posts: SocialPost[] = [];

        if (account.platform === 'facebook') {
          posts = await scrapeFacebookProfile(account.identifier);
        } else if (account.platform === 'tiktok') {
          posts = await scrapeTikTokProfile(account.identifier);
        }

        // Tag posts with competitor name
        const taggedPosts = posts.map(post => ({
          ...post,
          id: `${account.id}-${post.id}`,
        }));

        results.set(account.id, taggedPosts);

        // Add delay before next request
        await this.delay(this.delayBetweenRequests);
      } catch (error) {
        console.error(`Error scraping competitor ${account.name}:`, error);
        results.set(account.id, []);
      }
    }

    return results;
  }
}

export async function scrapeCompetitors(
  accounts: CompetitorAccount[]
): Promise<Map<string, SocialPost[]>> {
  const scraper = new CompetitorScraper({
    accounts,
    delayBetweenRequests: 5000,
  });

  try {
    return await scraper.scrapeAll();
  } catch (error) {
    console.error('Competitor scraping error:', error);
    return new Map();
  }
}
