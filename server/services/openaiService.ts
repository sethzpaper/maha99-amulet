import { OpenAI } from 'openai';
import { SocialPost } from '../../src/types';

export interface CompetitorAnalysis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  trends: string[];
  recommendations: string[];
  marketPosition: string;
}

export class OpenAIService {
  private client: OpenAI;
  private model: string;
  private cache: Map<string, { analysis: CompetitorAnalysis; timestamp: number }> = new Map();
  private cacheExpiry: number; // milliseconds

  constructor(apiKey: string, model: string = 'gpt-3.5-turbo', cacheExpiryMinutes: number = 30) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.cacheExpiry = cacheExpiryMinutes * 60 * 1000;
  }

  private getCacheKey(posts: SocialPost[]): string {
    const sortedIds = posts.map(p => p.id).sort().join('|');
    return `analysis_${sortedIds}`;
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheExpiry;
  }

  async analyzeCompetitors(posts: SocialPost[], competitorName: string = 'Unknown'): Promise<CompetitorAnalysis> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(posts);
      const cached = this.cache.get(cacheKey);

      if (cached && this.isCacheValid(cached.timestamp)) {
        console.log(`[OpenAI] Using cached analysis for ${competitorName}`);
        return cached.analysis;
      }

      if (posts.length === 0) {
        return this.getDefaultAnalysis('No posts available for analysis');
      }

      // Prepare posts summary for analysis
      const postsSummary = posts
        .slice(0, 10) // Use first 10 posts to avoid token limits
        .map(
          (p, i) => `Post ${i + 1} [${p.platform}]:
        Content: ${p.content.substring(0, 200)}
        Engagement: ${p.engagement} interactions
        Timestamp: ${p.timestamp}
      `
        )
        .join('\n\n');

      const prompt = `You are a social media market analyst. Analyze these competitor posts and provide insights.

Competitor: ${competitorName}
Posts Data:
${postsSummary}

Please provide analysis in the following JSON format:
{
  "summary": "Brief 1-2 sentence summary of their market strategy",
  "strengths": ["List of 3-5 competitor strengths based on posts"],
  "weaknesses": ["List of 3-5 competitor weaknesses or opportunities"],
  "trends": ["List of 3-5 observed content trends"],
  "recommendations": ["List of 3-5 recommendations for us"],
  "marketPosition": "Their estimated market position (e.g., 'Market Leader', 'Challenger', 'Niche Player')"
}

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no additional text.`;

      console.log(`[OpenAI] Sending analysis request for ${competitorName}...`);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '{}';

      // Parse response
      let analysis: CompetitorAnalysis;
      try {
        // Remove markdown code blocks if present
        const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanedContent);

        analysis = {
          summary: parsed.summary || 'Analysis completed',
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
          trends: Array.isArray(parsed.trends) ? parsed.trends : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          marketPosition: parsed.marketPosition || 'Unknown',
        };
      } catch (parseError) {
        console.warn('[OpenAI] Failed to parse response, using default analysis:', content);
        analysis = this.getDefaultAnalysis(competitorName);
      }

      // Cache the result
      this.cache.set(cacheKey, {
        analysis,
        timestamp: Date.now(),
      });

      return analysis;
    } catch (error) {
      console.error('[OpenAI] Error analyzing competitors:', error);
      throw error;
    }
  }

  private getDefaultAnalysis(competitorName: string): CompetitorAnalysis {
    return {
      summary: `Analysis of ${competitorName} market presence`,
      strengths: ['Established presence', 'Regular posting'],
      weaknesses: ['Limited engagement', 'Need for strategy improvement'],
      trends: ['Social media focus', 'Community engagement'],
      recommendations: ['Increase engagement', 'Diversify content', 'Focus on quality over quantity'],
      marketPosition: 'Active Competitor',
    };
  }

  clearCache(): void {
    this.cache.clear();
    console.log('[OpenAI] Cache cleared');
  }

  getCacheStats(): { size: number; expiryMinutes: number } {
    return {
      size: this.cache.size,
      expiryMinutes: this.cacheExpiry / 60000,
    };
  }
}

let openaiService: OpenAIService | null = null;

export function initOpenAI(apiKey: string, model?: string, cacheMinutes?: number): OpenAIService {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  if (!openaiService) {
    openaiService = new OpenAIService(apiKey, model, cacheMinutes);
    console.log('[OpenAI] Service initialized');
  }

  return openaiService;
}

export function getOpenAI(): OpenAIService | null {
  return openaiService;
}
