import puppeteer, { Browser, Page } from 'puppeteer';
import { SocialPost } from '../../src/types';

export interface TikTokScraperOptions {
  username: string;
  headless?: boolean;
  timeout?: number;
}

export class TikTokScraper {
  private browser: Browser | null = null;
  private username: string;
  private headless: boolean;
  private timeout: number;

  constructor(options: TikTokScraperOptions) {
    this.username = options.username.replace('@', '');
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

      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      const tiktokUrl = `https://www.tiktok.com/@${this.username}`;
      console.log(`Scraping TikTok profile: ${tiktokUrl}`);

      try {
        await page.goto(tiktokUrl, { waitUntil: 'networkidle2' });
      } catch (error) {
        console.warn('Navigation timeout, attempting to extract available content...');
      }

      // Wait for content to load
      await this.delay(3000);

      // Scroll down to load more videos
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        await this.delay(1000);
      }

      // Extract videos data
      const videos: SocialPost[] = await page.evaluate(() => {
        const posts: any[] = [];
        const videoElements = document.querySelectorAll('[data-test-id="video-feed-item-wrapper"]');

        videoElements.forEach((element, index) => {
          try {
            // Extract video description
            const captionElement = element.querySelector('[data-test-id="video-desc-link"]');
            const caption = captionElement?.textContent || '';

            // Extract engagement metrics
            let engagement = 0;
            const engagementText = element.textContent || '';

            // Try to find view count
            const viewMatch = engagementText.match(/(\d+(?:\.\d+)?[KMB]?)\s*(?:lượt xem|views?)/i);
            if (viewMatch) {
              let count = viewMatch[1];
              if (count.includes('K')) engagement = parseFloat(count) * 1000;
              else if (count.includes('M')) engagement = parseFloat(count) * 1000000;
              else if (count.includes('B')) engagement = parseFloat(count) * 1000000000;
              else engagement = parseInt(count);
            }

            // Extract link
            const linkElement = element.querySelector('a[href*="/video/"]');
            const link = linkElement?.getAttribute('href') || '';

            // Extract timestamp (estimated based on current time)
            const timestamp = new Date().toISOString();

            if (caption.trim()) {
              posts.push({
                id: `tt-${index}`,
                platform: 'tiktok' as const,
                content: caption.substring(0, 500),
                link: `https://tiktok.com${link}`,
                engagement: Math.floor(engagement),
                timestamp,
              });
            }
          } catch (error) {
            console.warn('Error parsing video element:', error);
          }
        });

        return posts;
      });

      await page.close();

      console.log(`Successfully scraped ${videos.length} TikTok videos`);
      return videos;
    } catch (error) {
      console.error('TikTok scraping error:', error);
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

export async function scrapeTikTokProfile(username: string): Promise<SocialPost[]> {
  const scraper = new TikTokScraper({
    username,
    headless: true,
    timeout: 30000,
  });

  try {
    return await scraper.scrape();
  } finally {
    await scraper.close();
  }
}
