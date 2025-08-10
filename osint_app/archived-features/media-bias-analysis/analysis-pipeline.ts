/**
 * Unified Analysis Pipeline
 * Integrates bias detection and fact-checking for comprehensive news analysis
 */

import { BiasDetector, BiasAnalysis } from './bias-detection/bias-detector';
import { FactChecker, FactCheckResult } from './corroboration/fact-checker';
import { MultiLanguageAnalyzer } from './translation/multi-language-analyzer';
import { createClient } from '@supabase/supabase-js';

export interface NewsAnalysisResult {
  articleId?: string;
  articleUrl: string;
  articleTitle: string;
  articleSource: string;
  originalLanguage?: string;
  wasTranslated?: boolean;
  biasAnalysis: BiasAnalysis;
  factCheckResult: FactCheckResult;
  overallTrustScore: number; // 0 to 1
  summary: string;
  timestamp: string;
}

export interface AnalysisPipelineConfig {
  openaiApiKey: string;
  googleApiKey: string;
  googleSearchEngineId: string;
  supabaseUrl: string;
  supabaseKey: string;
  model?: string;
  enableCaching?: boolean;
}

export class AnalysisPipeline {
  private biasDetector: BiasDetector;
  private factChecker: FactChecker;
  private multiLanguageAnalyzer: MultiLanguageAnalyzer;
  private supabase: any;

  constructor(config: AnalysisPipelineConfig) {
    this.biasDetector = new BiasDetector({
      openaiApiKey: config.openaiApiKey,
      model: config.model,
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey,
      enableCaching: config.enableCaching
    });

    this.factChecker = new FactChecker({
      openaiApiKey: config.openaiApiKey,
      googleApiKey: config.googleApiKey,
      googleSearchEngineId: config.googleSearchEngineId,
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey,
      model: config.model
    });

    this.multiLanguageAnalyzer = new MultiLanguageAnalyzer({
      openaiApiKey: config.openaiApiKey,
      model: config.model,
      enableTranslation: true,
      targetLanguage: 'en'
    });

    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Analyze a single article for bias and factual accuracy
   */
  async analyzeArticle(article: {
    id?: string;
    title: string;
    content: string;
    source: string;
    url: string;
    publishedDate?: string;
    language?: string;
  }): Promise<NewsAnalysisResult> {
    console.log(`[AnalysisPipeline] Starting analysis for: ${article.title}`);

    // Prepare article for analysis (detect language and translate if needed)
    const prepared = await this.multiLanguageAnalyzer.prepareArticleForAnalysis({
      title: article.title,
      content: article.content,
      language: article.language
    });

    // Use translated version for analysis if available
    const articleForAnalysis = {
      ...article,
      title: prepared.title,
      content: prepared.content
    };

    // Run bias detection and fact-checking in parallel
    const [biasAnalysis, factCheckResult] = await Promise.all([
      this.biasDetector.analyzeArticle(articleForAnalysis),
      this.factChecker.checkArticle(articleForAnalysis)
    ]);

    // Calculate overall trust score
    const trustScore = this.calculateTrustScore(biasAnalysis, factCheckResult);

    // Generate summary
    const summary = this.generateSummary(biasAnalysis, factCheckResult);

    const result: NewsAnalysisResult = {
      articleId: article.id,
      articleUrl: article.url,
      articleTitle: article.title,
      articleSource: article.source,
      originalLanguage: prepared.originalLanguage,
      wasTranslated: prepared.isTranslated,
      biasAnalysis,
      factCheckResult,
      overallTrustScore: trustScore,
      summary,
      timestamp: new Date().toISOString()
    };

    // Store results in database
    await this.storeResults(result);

    return result;
  }

  /**
   * Analyze multiple articles from database
   */
  async analyzeNewsFromDatabase(limit: number = 10): Promise<NewsAnalysisResult[]> {
    try {
      // Fetch unanalyzed news articles
      const { data: articles, error } = await this.supabase
        .from('news_with_sources')
        .select('*')
        .is('bias_analysis_id', null)
        .limit(limit)
        .order('published_at', { ascending: false });

      if (error) throw error;

      console.log(`[AnalysisPipeline] Found ${articles?.length || 0} articles to analyze`);

      const results: NewsAnalysisResult[] = [];

      // Process articles in batches
      const batchSize = 3;
      for (let i = 0; i < (articles?.length || 0); i += batchSize) {
        const batch = articles.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map((article: any) => 
            this.analyzeArticle({
              id: article.id,
              title: article.title,
              content: article.summary || article.content || '',
              source: article.source,
              url: article.url,
              publishedDate: article.published_at
            }).catch(err => {
              console.error(`[AnalysisPipeline] Failed to analyze article ${article.id}:`, err);
              return null;
            })
          )
        );

        results.push(...batchResults.filter(r => r !== null) as NewsAnalysisResult[]);

        // Rate limiting
        if (i + batchSize < articles.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      return results;
    } catch (error) {
      console.error('[AnalysisPipeline] Database fetch failed:', error);
      return [];
    }
  }

  /**
   * Calculate overall trust score based on bias and fact-check results
   */
  private calculateTrustScore(
    biasAnalysis: BiasAnalysis,
    factCheckResult: FactCheckResult
  ): number {
    // Weight factors
    const weights = {
      biasScore: 0.3,
      factAccuracy: 0.5,
      sourceBalance: 0.2
    };

    // Normalize bias score (0 = most biased, 1 = least biased)
    const normalizedBias = 1 - (Math.abs(biasAnalysis.overallBias) / 5);

    // Calculate weighted score
    const trustScore = 
      normalizedBias * weights.biasScore +
      factCheckResult.verificationScore * weights.factAccuracy +
      biasAnalysis.biasTypes.sourceBalance * weights.sourceBalance;

    // Apply confidence penalty
    const avgConfidence = (biasAnalysis.confidence + factCheckResult.confidence) / 2;
    
    return Math.round(trustScore * avgConfidence * 100) / 100;
  }

  /**
   * Generate human-readable summary of analysis
   */
  private generateSummary(
    biasAnalysis: BiasAnalysis,
    factCheckResult: FactCheckResult
  ): string {
    const parts: string[] = [];

    // Bias summary
    if (Math.abs(biasAnalysis.overallBias) < 1) {
      parts.push('The article appears relatively balanced');
    } else {
      parts.push(`The article shows ${biasAnalysis.biasCategory} bias`);
    }

    // Fact-check summary
    parts.push(factCheckResult.summary);

    // Key concerns
    const concerns: string[] = [];
    
    if (biasAnalysis.biasTypes.sensationalism > 0.7) {
      concerns.push('uses sensationalist language');
    }
    
    if (biasAnalysis.biasTypes.sourceBalance < 0.3) {
      concerns.push('lacks diverse sources');
    }

    if (factCheckResult.conflictingSources.length > 0) {
      concerns.push(`has ${factCheckResult.conflictingSources.length} conflicting reports`);
    }

    if (concerns.length > 0) {
      parts.push(`Concerns: ${concerns.join(', ')}`);
    }

    return parts.join('. ') + '.';
  }

  /**
   * Store analysis results in database
   */
  private async storeResults(result: NewsAnalysisResult): Promise<void> {
    try {
      // Store bias analysis
      const { data: biasData, error: biasError } = await this.supabase
        .from('bias_analyses')
        .upsert({
          article_url: result.articleUrl,
          article_title: result.articleTitle,
          article_source: result.articleSource,
          overall_bias: result.biasAnalysis.overallBias,
          bias_category: result.biasAnalysis.biasCategory,
          political_bias: result.biasAnalysis.biasTypes.political,
          sensationalism_score: result.biasAnalysis.biasTypes.sensationalism,
          emotional_language_score: result.biasAnalysis.biasTypes.emotionalLanguage,
          source_balance_score: result.biasAnalysis.biasTypes.sourceBalance,
          fact_selection_bias: result.biasAnalysis.biasTypes.factSelection,
          confidence: result.biasAnalysis.confidence,
          explanation: result.biasAnalysis.explanation,
          analysis: result.biasAnalysis
        })
        .select()
        .single();

      if (biasError) throw biasError;

      // Store fact-check results
      const { data: factData, error: factError } = await this.supabase
        .from('fact_check_results')
        .upsert({
          article_url: result.articleUrl,
          article_title: result.articleTitle,
          article_source: result.articleSource,
          overall_verification: result.factCheckResult.overallVerification,
          verification_score: result.factCheckResult.verificationScore,
          confidence: result.factCheckResult.confidence,
          summary: result.factCheckResult.summary,
          claims: result.factCheckResult.claims,
          corroborating_sources: result.factCheckResult.corroboratingSources,
          conflicting_sources: result.factCheckResult.conflictingSources,
          geographic_coverage: result.factCheckResult.geographicCoverage
        })
        .select()
        .single();

      if (factError) throw factError;

      // Update news article with analysis references
      if (result.articleId) {
        const { error: updateError } = await this.supabase
          .from('news_with_sources')
          .update({
            bias_analysis_id: biasData.id,
            fact_check_id: factData.id,
            bias_score: result.biasAnalysis.overallBias,
            verification_status: result.factCheckResult.overallVerification
          })
          .eq('id', result.articleId);

        if (updateError) {
          console.error('[AnalysisPipeline] Failed to update news article:', updateError);
        }
      }

    } catch (error) {
      console.error('[AnalysisPipeline] Failed to store results:', error);
    }
  }

  /**
   * Get analysis results for an article
   */
  async getAnalysisForArticle(articleUrl: string): Promise<NewsAnalysisResult | null> {
    try {
      const [biasResult, factResult] = await Promise.all([
        this.supabase
          .from('bias_analyses')
          .select('*')
          .eq('article_url', articleUrl)
          .single(),
        this.supabase
          .from('fact_check_results')
          .select('*')
          .eq('article_url', articleUrl)
          .single()
      ]);

      if (biasResult.data && factResult.data) {
        return {
          articleUrl,
          articleTitle: biasResult.data.article_title,
          articleSource: biasResult.data.article_source,
          biasAnalysis: biasResult.data.analysis,
          factCheckResult: {
            overallVerification: factResult.data.overall_verification,
            verificationScore: factResult.data.verification_score,
            claims: factResult.data.claims,
            corroboratingSources: factResult.data.corroborating_sources,
            conflictingSources: factResult.data.conflicting_sources,
            geographicCoverage: factResult.data.geographic_coverage,
            confidence: factResult.data.confidence,
            summary: factResult.data.summary
          },
          overallTrustScore: this.calculateTrustScore(
            biasResult.data.analysis,
            factResult.data
          ),
          summary: this.generateSummary(
            biasResult.data.analysis,
            factResult.data
          ),
          timestamp: biasResult.data.created_at
        };
      }

      return null;
    } catch (error) {
      console.error('[AnalysisPipeline] Failed to get analysis:', error);
      return null;
    }
  }
}