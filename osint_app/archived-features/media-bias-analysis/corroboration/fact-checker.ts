/**
 * News Corroboration & Fact-Checking Module
 * Verifies news claims by cross-referencing multiple sources
 * and provides evidence-based validation
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

export interface FactCheckResult {
  overallVerification: 'verified' | 'partially-verified' | 'disputed' | 'unverified';
  verificationScore: number; // 0 to 1
  claims: ClaimVerification[];
  corroboratingSources: CorroboratingSource[];
  conflictingSources: ConflictingSource[];
  geographicCoverage: GeographicCoverage;
  confidence: number; // 0 to 1
  summary: string;
}

export interface ClaimVerification {
  claim: string;
  status: 'supported' | 'disputed' | 'unverified' | 'partially-supported';
  evidence: Evidence[];
  confidence: number;
}

export interface Evidence {
  source: string;
  url: string;
  snippet: string;
  relationship: 'supports' | 'disputes' | 'mentions';
  credibilityScore: number;
  publishedDate?: string;
}

export interface CorroboratingSource {
  source: string;
  url: string;
  credibilityScore: number;
  location?: string;
  keyPoints: string[];
}

export interface ConflictingSource {
  source: string;
  url: string;
  conflictingClaim: string;
  explanation: string;
}

export interface GeographicCoverage {
  countries: string[];
  regions: string[];
  globalReach: boolean;
  localOnly: boolean;
}

interface FactCheckerConfig {
  openaiApiKey: string;
  googleApiKey: string;
  googleSearchEngineId: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  model?: string;
}

export class FactChecker {
  private openai: OpenAI;
  private customSearch: any;
  private supabase: any;
  private model: string;

  // Source credibility ratings (can be expanded)
  private static readonly SOURCE_CREDIBILITY: Record<string, number> = {
    'bbc.com': 0.9,
    'reuters.com': 0.95,
    'apnews.com': 0.95,
    'theguardian.com': 0.85,
    'nytimes.com': 0.85,
    'washingtonpost.com': 0.85,
    'cnn.com': 0.8,
    'foxnews.com': 0.75,
    'aljazeera.com': 0.8,
    'dw.com': 0.85,
    'france24.com': 0.85,
    'nhk.or.jp': 0.9,
    'tass.ru': 0.6,
    'rt.com': 0.5,
    'xinhuanet.com': 0.6
  };

  private static readonly CLAIM_EXTRACTION_PROMPT = `Extract the key factual claims from this news article that can be verified. Focus on:
- Who, what, when, where claims
- Numerical claims (statistics, counts, amounts)
- Quotes and statements attributed to specific people
- Events that allegedly occurred

For each claim, make it self-contained with enough context to search for it independently.

Article:
{article}

Return a JSON array of claims:
[
  {
    "claim": "Full claim with context",
    "type": "event|statistic|quote|statement",
    "entities": ["relevant entities mentioned"],
    "searchQueries": ["query 1", "query 2"]
  }
]`;

  private static readonly EVIDENCE_ANALYSIS_PROMPT = `Compare this claim with the evidence and determine if the evidence supports, disputes, or is neutral about the claim.

Claim: {claim}

Evidence: {evidence}

Analyze and return:
{
  "relationship": "supports|disputes|mentions",
  "confidence": 0 to 1,
  "explanation": "brief explanation",
  "keyFacts": ["relevant facts from evidence"]
}`;

  constructor(config: FactCheckerConfig) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.customSearch = google.customsearch('v1');
    this.model = config.model || 'gpt-4o';

    if (config.supabaseUrl && config.supabaseKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    }
  }

  /**
   * Fact-check an article by verifying its claims
   */
  async checkArticle(article: {
    title: string;
    content: string;
    source?: string;
    url?: string;
    publishedDate?: string;
  }): Promise<FactCheckResult> {
    console.log(`[FactChecker] Starting fact-check for: ${article.title}`);

    // Step 1: Extract claims
    const claims = await this.extractClaims(article);
    console.log(`[FactChecker] Extracted ${claims.length} claims`);

    // Step 2: Search for evidence for each claim
    const claimVerifications: ClaimVerification[] = [];
    const allSources = new Map<string, CorroboratingSource>();
    const conflictingSources: ConflictingSource[] = [];

    for (const claim of claims) {
      const verification = await this.verifyClaim(claim, article);
      claimVerifications.push(verification);

      // Collect unique sources
      verification.evidence.forEach(ev => {
        if (ev.relationship === 'supports' && !allSources.has(ev.url)) {
          allSources.set(ev.url, {
            source: ev.source,
            url: ev.url,
            credibilityScore: ev.credibilityScore,
            keyPoints: []
          });
        } else if (ev.relationship === 'disputes') {
          conflictingSources.push({
            source: ev.source,
            url: ev.url,
            conflictingClaim: claim.claim,
            explanation: ev.snippet
          });
        }
      });
    }

    // Step 3: Calculate overall verification status
    const verificationResult = this.calculateOverallVerification(claimVerifications);

    // Step 4: Analyze geographic coverage
    const geographicCoverage = await this.analyzeGeographicCoverage(
      Array.from(allSources.values())
    );

    return {
      ...verificationResult,
      claims: claimVerifications,
      corroboratingSources: Array.from(allSources.values()),
      conflictingSources: conflictingSources,
      geographicCoverage: geographicCoverage
    };
  }

  /**
   * Extract verifiable claims from an article
   */
  private async extractClaims(article: {
    title: string;
    content: string;
  }): Promise<Array<{
    claim: string;
    type: string;
    entities: string[];
    searchQueries: string[];
  }>> {
    try {
      const articleText = `Title: ${article.title}\n\nContent: ${article.content}`;
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: FactChecker.CLAIM_EXTRACTION_PROMPT.replace('{article}', articleText)
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '[]');
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('[FactChecker] Failed to extract claims:', error);
      return [];
    }
  }

  /**
   * Verify a single claim by searching for evidence
   */
  private async verifyClaim(
    claim: {
      claim: string;
      searchQueries: string[];
    },
    originalArticle: {
      url?: string;
      publishedDate?: string;
    }
  ): Promise<ClaimVerification> {
    const evidence: Evidence[] = [];

    // Search for evidence using multiple queries
    for (const query of claim.searchQueries.slice(0, 2)) {
      try {
        const searchResults = await this.searchForEvidence(query, originalArticle);
        
        // Analyze each search result
        for (const result of searchResults.slice(0, 3)) {
          const analysis = await this.analyzeEvidence(claim.claim, result);
          
          evidence.push({
            source: result.source,
            url: result.url,
            snippet: result.snippet,
            relationship: analysis.relationship,
            credibilityScore: this.getSourceCredibility(result.source),
            publishedDate: result.publishedDate
          });
        }
      } catch (error) {
        console.error(`[FactChecker] Search failed for query: ${query}`, error);
      }
    }

    // Calculate claim verification status
    const supportingEvidence = evidence.filter(e => e.relationship === 'supports');
    const disputingEvidence = evidence.filter(e => e.relationship === 'disputes');

    let status: ClaimVerification['status'];
    let confidence: number;

    if (supportingEvidence.length >= 2 && disputingEvidence.length === 0) {
      status = 'supported';
      confidence = Math.min(0.9, supportingEvidence.reduce((sum, e) => 
        sum + e.credibilityScore, 0) / supportingEvidence.length);
    } else if (disputingEvidence.length > supportingEvidence.length) {
      status = 'disputed';
      confidence = 0.7;
    } else if (supportingEvidence.length > 0 && disputingEvidence.length > 0) {
      status = 'partially-supported';
      confidence = 0.5;
    } else {
      status = 'unverified';
      confidence = 0.3;
    }

    return {
      claim: claim.claim,
      status,
      evidence,
      confidence
    };
  }

  /**
   * Search for evidence using Google Custom Search
   */
  private async searchForEvidence(
    query: string,
    originalArticle: { url?: string; publishedDate?: string }
  ): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    publishedDate?: string;
  }>> {
    try {
      const response = await this.customSearch.cse.list({
        auth: process.env.GOOGLE_API_KEY,
        cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
        q: query,
        num: 5,
        // Exclude the original article
        excludeTerms: originalArticle.url,
        // Search for recent content if we have a date
        ...(originalArticle.publishedDate && {
          dateRestrict: 'd7' // Last 7 days
        })
      });

      if (!response.data.items) return [];

      return response.data.items.map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: new URL(item.link).hostname.replace('www.', ''),
        publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time']
      }));
    } catch (error) {
      console.error('[FactChecker] Search error:', error);
      return [];
    }
  }

  /**
   * Analyze if evidence supports or disputes a claim
   */
  private async analyzeEvidence(
    claim: string,
    evidence: { snippet: string; title: string }
  ): Promise<{
    relationship: 'supports' | 'disputes' | 'mentions';
    confidence: number;
  }> {
    try {
      const evidenceText = `Title: ${evidence.title}\nSnippet: ${evidence.snippet}`;
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: FactChecker.EVIDENCE_ANALYSIS_PROMPT
              .replace('{claim}', claim)
              .replace('{evidence}', evidenceText)
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        relationship: result.relationship || 'mentions',
        confidence: result.confidence || 0.5
      };
    } catch (error) {
      console.error('[FactChecker] Evidence analysis failed:', error);
      return { relationship: 'mentions', confidence: 0.3 };
    }
  }

  /**
   * Get credibility score for a source
   */
  private getSourceCredibility(source: string): number {
    const domain = source.toLowerCase();
    
    // Check known sources
    for (const [knownDomain, score] of Object.entries(FactChecker.SOURCE_CREDIBILITY)) {
      if (domain.includes(knownDomain)) {
        return score;
      }
    }

    // Default credibility for unknown sources
    if (domain.endsWith('.gov') || domain.endsWith('.edu')) {
      return 0.85;
    }
    
    return 0.6; // Default
  }

  /**
   * Calculate overall verification status
   */
  private calculateOverallVerification(
    claimVerifications: ClaimVerification[]
  ): Pick<FactCheckResult, 'overallVerification' | 'verificationScore' | 'confidence' | 'summary'> {
    if (claimVerifications.length === 0) {
      return {
        overallVerification: 'unverified',
        verificationScore: 0,
        confidence: 0,
        summary: 'No verifiable claims found'
      };
    }

    const supportedClaims = claimVerifications.filter(c => c.status === 'supported').length;
    const disputedClaims = claimVerifications.filter(c => c.status === 'disputed').length;
    const partialClaims = claimVerifications.filter(c => c.status === 'partially-supported').length;
    const totalClaims = claimVerifications.length;

    const verificationScore = (supportedClaims + partialClaims * 0.5) / totalClaims;
    const avgConfidence = claimVerifications.reduce((sum, c) => sum + c.confidence, 0) / totalClaims;

    let overallVerification: FactCheckResult['overallVerification'];
    let summary: string;

    if (disputedClaims > supportedClaims) {
      overallVerification = 'disputed';
      summary = `${disputedClaims} of ${totalClaims} key claims are disputed by other sources`;
    } else if (supportedClaims >= totalClaims * 0.8) {
      overallVerification = 'verified';
      summary = `${supportedClaims} of ${totalClaims} key claims are verified by multiple sources`;
    } else if (supportedClaims + partialClaims >= totalClaims * 0.5) {
      overallVerification = 'partially-verified';
      summary = `${supportedClaims} claims verified, ${partialClaims} partially verified, ${disputedClaims} disputed`;
    } else {
      overallVerification = 'unverified';
      summary = `Only ${supportedClaims} of ${totalClaims} claims could be independently verified`;
    }

    return {
      overallVerification,
      verificationScore,
      confidence: avgConfidence,
      summary
    };
  }

  /**
   * Analyze geographic coverage of sources
   */
  private async analyzeGeographicCoverage(
    sources: CorroboratingSource[]
  ): Promise<GeographicCoverage> {
    // Map domains to countries/regions
    const sourceLocations = sources.map(source => {
      const domain = source.source.toLowerCase();
      
      if (domain.includes('.uk') || domain.includes('bbc')) return { country: 'UK', region: 'Europe' };
      if (domain.includes('.fr') || domain.includes('france24')) return { country: 'France', region: 'Europe' };
      if (domain.includes('.de') || domain.includes('dw.com')) return { country: 'Germany', region: 'Europe' };
      if (domain.includes('.jp') || domain.includes('nhk')) return { country: 'Japan', region: 'Asia' };
      if (domain.includes('.cn') || domain.includes('xinhua')) return { country: 'China', region: 'Asia' };
      if (domain.includes('.ru') || domain.includes('tass')) return { country: 'Russia', region: 'Europe' };
      if (domain.includes('aljazeera')) return { country: 'Qatar', region: 'Middle East' };
      if (domain.includes('.com')) return { country: 'USA', region: 'Americas' };
      
      return { country: 'Unknown', region: 'Unknown' };
    });

    const countries = [...new Set(sourceLocations.map(s => s.country).filter(c => c !== 'Unknown'))];
    const regions = [...new Set(sourceLocations.map(s => s.region).filter(r => r !== 'Unknown'))];

    return {
      countries,
      regions,
      globalReach: regions.length >= 3,
      localOnly: regions.length === 1 && countries.length <= 2
    };
  }

  /**
   * Search for related articles in our database
   */
  async findRelatedArticles(
    article: { title: string; content: string },
    limit: number = 10
  ): Promise<Array<{
    title: string;
    url: string;
    source: string;
    similarity: number;
  }>> {
    if (!this.supabase) return [];

    try {
      // Extract key terms for search
      const keyTerms = await this.extractKeyTerms(article);
      
      // Search in our database
      const { data } = await this.supabase
        .from('news_with_sources')
        .select('title, url, source')
        .textSearch('title', keyTerms.join(' | '))
        .limit(limit);

      return (data || []).map((item: any) => ({
        ...item,
        similarity: 0.7 // Placeholder - could implement proper similarity scoring
      }));
    } catch (error) {
      console.error('[FactChecker] Failed to find related articles:', error);
      return [];
    }
  }

  /**
   * Extract key terms from an article for searching
   */
  private async extractKeyTerms(article: {
    title: string;
    content: string;
  }): Promise<string[]> {
    // Simple implementation - extract entities and important words
    const text = `${article.title} ${article.content}`;
    const words = text.split(/\s+/)
      .filter(word => word.length > 4)
      .filter(word => !['the', 'and', 'for', 'that', 'this', 'with'].includes(word.toLowerCase()));

    // Return top 5 most frequent words
    const frequency = new Map<string, number>();
    words.forEach(word => {
      const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
    });

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }
}