import puppeteer, { Browser, Page } from 'puppeteer';
import { SocialPost } from '../../src/types';

export interface FacebookScraperOptions {
  profileId: string;
  headless?: boolean;
  timeout?: number;
}

export class FacebookScraper {
  private browser: Browser | null = null;
  private profileId: string;
  private headless: boolean;
  private timeout: number;

  constructor(options: FacebookScraperOptions) {
    this.profileId = options.profileId;
    this.headless = options.headless !== false;
    this.timeout = options.timeout || 30000;
  }

  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          headless: this.headless,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
          ],
        });
      } catch (error) {
        console.error('Failed to launch browser:', error);
        throw new Error('Browser initialization failed');
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrape(): Promise<SocialPost[]> {
    try {
      await this.initBrowser();
      if (!this.browser) throw new Error('Browser not initialized');

      const page = await this.browser.newPage();
      page.setDefaultTimeout(this.timeout);
      page.setViewport({ width: 1920, height: 1080 });

      // Set user agent to appear more like a normal browser
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      const facebookUrl = `https://www.facebook.com/${this.profileId}`;
      console.log(`Scraping Facebook profile: ${facebookUrl}`);

      try {
        await page.goto(facebookUrl, { waitUntil: 'networkidle2' });
      } catch (error) {
        console.warn('Navigation timeout, attempting to extract available content...');
      }

      // Wait a bit for content to load
      await this.delay(2000);

      // Extract posts data
      const posts: SocialPost[] = await page.evaluate(() => {
        const posts: any[] = [];
        const postElements = document.querySelectorAll('[data-ft]');

        postElements.forEach((element, index) => {
          try {
            // Extract post text
            const textElement = element.querySelector('[data-testid="post_message"]');
            const content = textElement?.textContent || '';

            // Extract engagement metrics (likes, comments, shares)
            const engagementElement = element.querySelector('[data-testid="UFI2ShareButton/Root"]');
            let engagement = 0;

            const engagementText = element.textContent || '';
            const likeMatch = engagementText.match(/(\d+)\s*(?:lượt thích|likes?)/i);
            if (likeMatch) {
              engagement = parseInt(likeMatch[1]) || 0;
            }

            // Extract timestamp
            let timestamp = new Date().toISOString();
            const timeElement = element.querySelector('abbr[data-utime]');
            if (timeElement?.getAttribute('data-utime')) {
              const utime = parseInt(timeElement.getAttribute('data-utime') || '0') * 1000;
              timestamp = new Date(utime).toISOString();
            }

            // Extract post link
            const linkElement = element.querySelector('a[href*="/posts/"]');
            const link = linkElement?.getAttribute('href') || '';

            if (content.trim()) {
              posts.push({
                id: `fb-${index}`,
                platform: 'facebook' as const,
                content: content.substring(0, 500),
                link: `https://facebook.com${link}`,
                engagement,
                timestamp,
              });
            }
          } catch (error) {
            console.warn('Error parsing post element:', error);
          }
        });

        return posts;
      });

      await page.close();

      console.log(`Successfully scraped ${posts.length} Facebook posts`);
      return posts;
    } catch (error) {
      console.error('Facebook scraping error:', error);
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export async function scrapeFacebookProfile(profileId: string): Promise<SocialPost[]> {
  const scraper = new FacebookScraper({
    profileId,
    headless: true,
    timeout: 30000,
  });

  try {
    return await scraper.scrape();
  } finally {
    await scraper.close();
  }
}
