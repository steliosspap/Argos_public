/**
 * Media Bias Detection Module
 * Analyzes news articles for various types of bias including political lean,
 * sensationalism, and framing techniques using NLP and LLMs
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export interface BiasAnalysis {
  overallBias: number; // -5 (far left) to +5 (far right)
  biasCategory: 'far-left' | 'left' | 'lean-left' | 'center' | 'lean-right' | 'right' | 'far-right';
  biasTypes: {
    political: number; // -1 to 1
    sensationalism: number; // 0 to 1
    emotionalLanguage: number; // 0 to 1
    sourceBalance: number; // 0 to 1 (1 = well balanced)
    factSelection: number; // -1 to 1 (negative = cherry-picked facts)
  };
  indicators: BiasIndicator[];
  confidence: number; // 0 to 1
  explanation: string;
  highlightedPhrases: HighlightedPhrase[];
}

export interface BiasIndicator {
  type: 'loaded-language' | 'missing-context' | 'one-sided' | 'emotional-appeal' | 'cherry-picking';
  severity: 'low' | 'medium' | 'high';
  description: string;
  textSnippet?: string;
}

export interface HighlightedPhrase {
  text: string;
  startIndex: number;
  endIndex: number;
  biasType: string;
  explanation: string;
}

interface BiasDetectorConfig {
  openaiApiKey: string;
  model?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  enableCaching?: boolean;
}

export class BiasDetector {
  private openai: OpenAI;
  private supabase: any;
  private model: string;
  private enableCaching: boolean;

  // Lexicons for rule-based detection
  private static readonly LOADED_WORDS = {
    left: ['fascist', 'oppressive', 'corporate greed', 'inequality', 'systemic', 'marginalized'],
    right: ['radical', 'socialist', 'big government', 'freedom', 'patriot', 'traditional values'],
    sensational: ['shocking', 'explosive', 'devastating', 'crisis', 'bombshell', 'unprecedented']
  };

  private static readonly BIAS_DETECTION_PROMPT = `Analyze this news article for media bias. Provide a comprehensive bias analysis including:

1. Political Bias Score: Rate from -5 (far left) to +5 (far right), with 0 being center
2. Identify specific bias types present:
   - Political bias (partisan language, one-sided coverage)
   - Sensationalism (exaggerated or shocking language)
   - Emotional manipulation (appeals to fear, anger, etc.)
   - Source imbalance (quoting only one side)
   - Fact selection bias (cherry-picking facts)

3. For each bias found, provide:
   - Specific text examples
   - Explanation of why it's biased
   - Severity (low/medium/high)

4. Highlight specific phrases that demonstrate bias with explanations

5. Overall confidence in the analysis (0-1)

Article to analyze:
{article}

Return a JSON object with this structure:
{
  "politicalBias": -5 to 5,
  "biasTypes": {
    "political": -1 to 1,
    "sensationalism": 0 to 1,
    "emotionalLanguage": 0 to 1,
    "sourceBalance": 0 to 1,
    "factSelection": -1 to 1
  },
  "indicators": [
    {
      "type": "loaded-language|missing-context|one-sided|emotional-appeal|cherry-picking",
      "severity": "low|medium|high",
      "description": "explanation",
      "textSnippet": "quoted text"
    }
  ],
  "highlightedPhrases": [
    {
      "text": "biased phrase",
      "biasType": "type of bias",
      "explanation": "why it's biased"
    }
  ],
  "confidence": 0 to 1,
  "explanation": "overall summary"
}`;

  constructor(config: BiasDetectorConfig) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.model || 'gpt-4o';
    this.enableCaching = config.enableCaching ?? true;

    if (config.supabaseUrl && config.supabaseKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    }
  }

  /**
   * Analyze an article for bias
   */
  async analyzeArticle(article: {
    title: string;
    content: string;
    source?: string;
    url?: string;
  }): Promise<BiasAnalysis> {
    // Check cache first
    if (this.enableCaching && this.supabase && article.url) {
      const cached = await this.getCachedAnalysis(article.url);
      if (cached) return cached;
    }

    // Combine rule-based and LLM analysis
    const ruleBasedAnalysis = this.performRuleBasedAnalysis(article);
    const llmAnalysis = await this.performLLMAnalysis(article);

    // Merge analyses with LLM taking precedence but incorporating rule-based findings
    const mergedAnalysis = this.mergeAnalyses(ruleBasedAnalysis, llmAnalysis);

    // Cache the result
    if (this.enableCaching && this.supabase && article.url) {
      await this.cacheAnalysis(article.url, mergedAnalysis);
    }

    return mergedAnalysis;
  }

  /**
   * Rule-based bias detection using lexicons and patterns
   */
  private performRuleBasedAnalysis(article: {
    title: string;
    content: string;
  }): Partial<BiasAnalysis> {
    const text = `${article.title} ${article.content}`.toLowerCase();
    const indicators: BiasIndicator[] = [];
    
    // Check for loaded language
    let leftBiasCount = 0;
    let rightBiasCount = 0;
    let sensationalCount = 0;

    // Count loaded words
    BiasDetector.LOADED_WORDS.left.forEach(word => {
      if (text.includes(word)) leftBiasCount++;
    });

    BiasDetector.LOADED_WORDS.right.forEach(word => {
      if (text.includes(word)) rightBiasCount++;
    });

    BiasDetector.LOADED_WORDS.sensational.forEach(word => {
      if (text.includes(word)) sensationalCount++;
    });

    // Calculate preliminary scores
    const politicalLean = (rightBiasCount - leftBiasCount) / 
      Math.max(1, rightBiasCount + leftBiasCount);
    
    const sensationalismScore = Math.min(1, sensationalCount / 5);

    // Check for source diversity
    const sourcePatterns = /according to|said|stated|reported|claims/gi;
    const sourceMentions = text.match(sourcePatterns) || [];
    const sourceBalance = sourceMentions.length > 3 ? 0.8 : 0.3;

    // Add indicators
    if (sensationalismScore > 0.5) {
      indicators.push({
        type: 'emotional-appeal',
        severity: 'medium',
        description: 'Article uses sensationalist language'
      });
    }

    return {
      biasTypes: {
        political: politicalLean,
        sensationalism: sensationalismScore,
        emotionalLanguage: sensationalismScore * 0.8,
        sourceBalance: sourceBalance,
        factSelection: 0 // Cannot determine from lexicon alone
      },
      indicators
    };
  }

  /**
   * LLM-based bias detection using GPT-4
   */
  private async performLLMAnalysis(article: {
    title: string;
    content: string;
  }): Promise<BiasAnalysis> {
    try {
      const articleText = `Title: ${article.title}\n\nContent: ${article.content}`;
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: BiasDetector.BIAS_DETECTION_PROMPT.replace('{article}', articleText)
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      // Transform LLM response to our format
      return {
        overallBias: analysis.politicalBias || 0,
        biasCategory: this.categorizeBias(analysis.politicalBias || 0),
        biasTypes: analysis.biasTypes || {},
        indicators: analysis.indicators || [],
        confidence: analysis.confidence || 0.7,
        explanation: analysis.explanation || '',
        highlightedPhrases: analysis.highlightedPhrases || []
      };
    } catch (error) {
      console.error('LLM analysis failed:', error);
      // Return neutral analysis on error
      return {
        overallBias: 0,
        biasCategory: 'center',
        biasTypes: {
          political: 0,
          sensationalism: 0,
          emotionalLanguage: 0,
          sourceBalance: 0.5,
          factSelection: 0
        },
        indicators: [],
        confidence: 0.3,
        explanation: 'Analysis failed - returning neutral assessment',
        highlightedPhrases: []
      };
    }
  }

  /**
   * Merge rule-based and LLM analyses
   */
  private mergeAnalyses(
    ruleBasedAnalysis: Partial<BiasAnalysis>,
    llmAnalysis: BiasAnalysis
  ): BiasAnalysis {
    // Use LLM as primary but boost confidence if rule-based agrees
    const ruleBasedPolitical = ruleBasedAnalysis.biasTypes?.political || 0;
    const llmPolitical = llmAnalysis.biasTypes.political;
    
    const agreementBonus = Math.sign(ruleBasedPolitical) === Math.sign(llmPolitical) ? 0.1 : 0;

    return {
      ...llmAnalysis,
      confidence: Math.min(1, llmAnalysis.confidence + agreementBonus),
      indicators: [
        ...llmAnalysis.indicators,
        ...(ruleBasedAnalysis.indicators || [])
      ]
    };
  }

  /**
   * Categorize numerical bias score into categories
   */
  private categorizeBias(score: number): BiasAnalysis['biasCategory'] {
    if (score <= -4) return 'far-left';
    if (score <= -2) return 'left';
    if (score <= -0.5) return 'lean-left';
    if (score <= 0.5) return 'center';
    if (score <= 2) return 'lean-right';
    if (score <= 4) return 'right';
    return 'far-right';
  }

  /**
   * Get cached analysis from database
   */
  private async getCachedAnalysis(url: string): Promise<BiasAnalysis | null> {
    try {
      const { data } = await this.supabase
        .from('bias_analyses')
        .select('*')
        .eq('article_url', url)
        .single();

      if (data && data.analysis) {
        // Check if cache is recent (within 7 days)
        const cacheAge = Date.now() - new Date(data.created_at).getTime();
        if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
          return data.analysis;
        }
      }
    } catch (error) {
      // Cache miss is not an error
    }
    return null;
  }

  /**
   * Cache analysis in database
   */
  private async cacheAnalysis(url: string, analysis: BiasAnalysis): Promise<void> {
    try {
      await this.supabase
        .from('bias_analyses')
        .upsert({
          article_url: url,
          analysis: analysis,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to cache analysis:', error);
    }
  }

  /**
   * Batch analyze multiple articles
   */
  async analyzeArticles(articles: Array<{
    title: string;
    content: string;
    source?: string;
    url?: string;
  }>): Promise<BiasAnalysis[]> {
    // Process in batches to avoid rate limits
    const batchSize = 5;
    const results: BiasAnalysis[] = [];

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(article => this.analyzeArticle(article))
      );
      results.push(...batchResults);

      // Rate limiting
      if (i + batchSize < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}