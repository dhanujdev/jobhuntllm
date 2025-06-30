import { createLogger } from '@src/background/log';

const logger = createLogger('ResponseCache');

/**
 * Intelligent response caching system for job application questions
 */
export class ResponseCache {
  private static readonly CACHE_KEY = 'jobhuntllm_response_cache';
  private static readonly MAX_CACHE_SIZE = 1000;
  private static readonly CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

  private cache: Map<string, CachedResponse> = new Map();
  private questionPatterns: Map<string, string> = new Map();

  constructor() {
    this.loadCache();
    this.initializeCommonPatterns();
  }

  /**
   * Generate a smart hash for questions that accounts for variations
   */
  private generateQuestionHash(questionText: string): string {
    // Normalize the question text
    const normalized = questionText
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Extract key concepts for better matching
    const concepts = this.extractKeyConcepts(normalized);
    const conceptHash = concepts.sort().join('_');

    return btoa(conceptHash).substring(0, 16);
  }

  /**
   * Extract key concepts from questions for better caching
   */
  private extractKeyConcepts(text: string): string[] {
    const concepts: string[] = [];

    // Experience-related
    if (text.includes('experience') || text.includes('years')) {
      concepts.push('experience');
      if (text.includes('java') || text.includes('python') || text.includes('javascript')) {
        concepts.push('programming_experience');
      }
    }

    // Authorization/Legal
    if (text.includes('authorized') || text.includes('legal') || text.includes('work')) {
      concepts.push('work_authorization');
    }

    if (text.includes('sponsor') || text.includes('visa')) {
      concepts.push('visa_sponsorship');
    }

    // Education
    if (text.includes('degree') || text.includes('bachelor') || text.includes('education')) {
      concepts.push('education');
    }

    // Compensation
    if (text.includes('salary') || text.includes('compensation') || text.includes('pay')) {
      concepts.push('compensation');
    }

    // Availability
    if (text.includes('start') || text.includes('available') || text.includes('notice')) {
      concepts.push('availability');
    }

    // Location/Remote
    if (text.includes('remote') || text.includes('onsite') || text.includes('relocate')) {
      concepts.push('location_preference');
    }

    // Why questions
    if (text.includes('why') && (text.includes('interested') || text.includes('apply'))) {
      concepts.push('why_interested');
    }

    if (text.includes('why') && (text.includes('qualified') || text.includes('fit'))) {
      concepts.push('why_qualified');
    }

    return concepts.length > 0 ? concepts : ['general'];
  }

  /**
   * Get cached response for a question
   */
  async getCachedResponse(questionText: string, context?: any): Promise<string | null> {
    const hash = this.generateQuestionHash(questionText);
    const cached = this.cache.get(hash);

    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    if (Date.now() - cached.timestamp > ResponseCache.CACHE_EXPIRY) {
      this.cache.delete(hash);
      await this.saveCache();
      return null;
    }

    // Update last used timestamp
    cached.lastUsed = Date.now();
    cached.useCount++;

    logger.info(`Cache hit for question: ${questionText.substring(0, 50)}...`);

    // Personalize the cached response if needed
    return this.personalizeResponse(cached.response, context);
  }

  /**
   * Cache a response for a question
   */
  async cacheResponse(questionText: string, response: string, confidence: number = 1.0, context?: any): Promise<void> {
    const hash = this.generateQuestionHash(questionText);

    const cachedResponse: CachedResponse = {
      hash,
      questionText: questionText.substring(0, 200), // Store truncated version
      response,
      confidence,
      timestamp: Date.now(),
      lastUsed: Date.now(),
      useCount: 1,
      context: context ? this.sanitizeContext(context) : undefined,
    };

    this.cache.set(hash, cachedResponse);

    // Cleanup if cache is too large
    if (this.cache.size > ResponseCache.MAX_CACHE_SIZE) {
      await this.cleanupCache();
    }

    await this.saveCache();
    logger.info(`Cached response for: ${questionText.substring(0, 50)}...`);
  }

  /**
   * Check if a question matches known patterns
   */
  getPatternResponse(questionText: string, resumeData: any): string | null {
    const normalized = questionText.toLowerCase();

    for (const [pattern, responseTemplate] of this.questionPatterns.entries()) {
      if (normalized.includes(pattern)) {
        return this.fillTemplate(responseTemplate, resumeData);
      }
    }

    return null;
  }

  /**
   * Batch cache multiple responses
   */
  async batchCacheResponses(
    entries: Array<{
      question: string;
      response: string;
      confidence?: number;
      context?: any;
    }>,
  ): Promise<void> {
    for (const entry of entries) {
      const hash = this.generateQuestionHash(entry.question);

      const cachedResponse: CachedResponse = {
        hash,
        questionText: entry.question.substring(0, 200),
        response: entry.response,
        confidence: entry.confidence || 1.0,
        timestamp: Date.now(),
        lastUsed: Date.now(),
        useCount: 1,
        context: entry.context ? this.sanitizeContext(entry.context) : undefined,
      };

      this.cache.set(hash, cachedResponse);
    }

    await this.saveCache();
    logger.info(`Batch cached ${entries.length} responses`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const entries = Array.from(this.cache.values());

    return {
      totalEntries: entries.length,
      totalUses: entries.reduce((sum, entry) => sum + entry.useCount, 0),
      averageConfidence: entries.reduce((sum, entry) => sum + entry.confidence, 0) / entries.length,
      oldestEntry: Math.min(...entries.map(e => e.timestamp)),
      newestEntry: Math.max(...entries.map(e => e.timestamp)),
      mostUsedQuestion: entries.sort((a, b) => b.useCount - a.useCount)[0]?.questionText || 'None',
      cacheSize: this.cache.size,
    };
  }

  /**
   * Clear expired entries and least used entries
   */
  private async cleanupCache(): Promise<void> {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    // Remove expired entries
    const validEntries = entries.filter(([, entry]) => now - entry.timestamp < ResponseCache.CACHE_EXPIRY);

    // If still too many, remove least used entries
    if (validEntries.length > ResponseCache.MAX_CACHE_SIZE) {
      validEntries.sort((a, b) => {
        // Sort by use count and recency
        const aScore = a[1].useCount + (now - a[1].lastUsed) / 1000000;
        const bScore = b[1].useCount + (now - b[1].lastUsed) / 1000000;
        return bScore - aScore;
      });

      validEntries.splice(ResponseCache.MAX_CACHE_SIZE);
    }

    // Rebuild cache
    this.cache.clear();
    validEntries.forEach(([hash, entry]) => this.cache.set(hash, entry));

    logger.info(`Cache cleanup completed. Entries: ${this.cache.size}`);
  }

  /**
   * Initialize common question patterns with template responses
   */
  private initializeCommonPatterns(): void {
    this.questionPatterns.set('bachelor', 'Yes');
    this.questionPatterns.set('degree', 'Yes');
    this.questionPatterns.set('authorized to work', 'Yes');
    this.questionPatterns.set('require sponsorship', 'No');
    this.questionPatterns.set('need visa', 'No');
    this.questionPatterns.set('years of experience', '{experience_years}');
    this.questionPatterns.set('salary expectation', '{salary_expectation}');
    this.questionPatterns.set('compensation', '{salary_expectation}');
    this.questionPatterns.set('start date', '{start_date}');
    this.questionPatterns.set('available to start', '{start_date}');
    this.questionPatterns.set('notice period', '2 weeks');
    this.questionPatterns.set('willing to relocate', '{willing_to_relocate}');
    this.questionPatterns.set('remote work', '{remote_work}');
    this.questionPatterns.set('commute', 'Yes');
    this.questionPatterns.set('onsite', 'Yes');
    this.questionPatterns.set(
      'why interested',
      'I am excited about this opportunity because it aligns with my {experience_years} of experience in {technical_skills} and my career goals.',
    );
    this.questionPatterns.set(
      'why qualified',
      'My background in {technical_skills} and {experience_years} of professional experience make me well-suited for this role.',
    );
    this.questionPatterns.set('tell us about yourself', '{summary}');
  }

  /**
   * Fill template with resume data
   */
  private fillTemplate(template: string, resumeData: any): string {
    if (!resumeData) return template;

    return template
      .replace('{experience_years}', resumeData.experience_years || '5+ years')
      .replace('{salary_expectation}', resumeData.salary_expectation || 'Competitive')
      .replace('{start_date}', resumeData.start_date || 'Immediate')
      .replace('{willing_to_relocate}', resumeData.willing_to_relocate || 'Yes')
      .replace('{remote_work}', resumeData.remote_work || 'Yes')
      .replace('{technical_skills}', resumeData.technical_skills || 'software development')
      .replace('{summary}', resumeData.summary || 'I am a dedicated professional with strong technical skills.');
  }

  /**
   * Personalize cached response with current context
   */
  private personalizeResponse(response: string, context?: any): string {
    if (!context) return response;

    // Replace generic placeholders with context-specific information
    return response
      .replace(/\[Company Name\]/g, context.companyName || '[Company Name]')
      .replace(/\[Position\]/g, context.jobTitle || '[Position]')
      .replace(/\[Industry\]/g, context.industry || '[Industry]');
  }

  /**
   * Sanitize context to avoid storing sensitive data
   */
  private sanitizeContext(context: any): any {
    const sanitized: any = {};

    // Only store non-sensitive, useful context
    if (context.companyName) sanitized.companyName = context.companyName;
    if (context.jobTitle) sanitized.jobTitle = context.jobTitle;
    if (context.industry) sanitized.industry = context.industry;
    if (context.platform) sanitized.platform = context.platform;

    return sanitized;
  }

  /**
   * Load cache from storage
   */
  private async loadCache(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(ResponseCache.CACHE_KEY);
      const cached = result[ResponseCache.CACHE_KEY];

      if (cached && Array.isArray(cached)) {
        this.cache = new Map(cached);
        logger.info(`Loaded ${this.cache.size} cached responses`);
      }
    } catch (error) {
      logger.error('Failed to load response cache', error);
    }
  }

  /**
   * Save cache to storage
   */
  private async saveCache(): Promise<void> {
    try {
      const cacheArray = Array.from(this.cache.entries());
      await chrome.storage.local.set({
        [ResponseCache.CACHE_KEY]: cacheArray,
      });
    } catch (error) {
      logger.error('Failed to save response cache', error);
    }
  }

  /**
   * Export cache for backup
   */
  async exportCache(): Promise<string> {
    const cacheData = {
      version: '1.0',
      timestamp: Date.now(),
      entries: Array.from(this.cache.entries()),
      stats: this.getCacheStats(),
    };

    return JSON.stringify(cacheData, null, 2);
  }

  /**
   * Import cache from backup
   */
  async importCache(cacheData: string): Promise<boolean> {
    try {
      const data = JSON.parse(cacheData);

      if (data.entries && Array.isArray(data.entries)) {
        this.cache = new Map(data.entries);
        await this.saveCache();
        logger.info(`Imported ${this.cache.size} cached responses`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to import cache', error);
      return false;
    }
  }

  /**
   * Clear all cached responses
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    await chrome.storage.local.remove(ResponseCache.CACHE_KEY);
    logger.info('Response cache cleared');
  }
}

/**
 * Interfaces
 */
interface CachedResponse {
  hash: string;
  questionText: string;
  response: string;
  confidence: number;
  timestamp: number;
  lastUsed: number;
  useCount: number;
  context?: any;
}

interface CacheStats {
  totalEntries: number;
  totalUses: number;
  averageConfidence: number;
  oldestEntry: number;
  newestEntry: number;
  mostUsedQuestion: string;
  cacheSize: number;
}

/**
 * Global cache instance
 */
export const responseCache = new ResponseCache();
