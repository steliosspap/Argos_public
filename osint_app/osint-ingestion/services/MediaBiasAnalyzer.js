/**
 * Media Bias Analyzer Service
 * Integrates multiple bias detection algorithms from open source projects
 */

import { OpenAI } from 'openai';
import { config } from '../core/config.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MediaBiasAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.apis.openai.apiKey
    });
    
    // Initialize Supabase client
    this.supabase = createClient(
      config.database.supabase.url,
      config.database.supabase.serviceKey
    );
    
    // Load AllSides bias ratings
    this.allSidesBiasRatings = new Map();
    this.loadAllSidesData();
    this.loadSourceBiasFromDB();
    
    // Bias indicators from research papers
    this.biasIndicators = {
      left: {
        terms: ['progressive', 'inequality', 'social justice', 'climate crisis', 'systemic racism', 
                'corporate greed', 'living wage', 'universal healthcare', 'gun control', 'undocumented'],
        sentiment: ['outraged', 'condemned', 'slammed', 'blasted', 'denounced'],
        sources: ['think progress', 'mother jones', 'huffpost', 'daily kos', 'msnbc']
      },
      right: {
        terms: ['conservative', 'traditional values', 'border security', 'illegal aliens', 'gun rights',
                'free market', 'limited government', 'religious freedom', 'law and order', 'radical left'],
        sentiment: ['patriotic', 'defended', 'stood firm', 'protected', 'upheld'],
        sources: ['fox news', 'breitbart', 'daily wire', 'newsmax', 'oann']
      },
      center: {
        terms: ['bipartisan', 'both sides', 'mixed views', 'debate continues', 'opinions differ'],
        sentiment: ['reported', 'stated', 'announced', 'said', 'according to'],
        sources: ['reuters', 'ap', 'bbc', 'npr', 'pbs']
      }
    };
    
    // Framing patterns
    this.framingPatterns = {
      spin: /claims|alleged|so-called|supposedly|purported/gi,
      loaded: /crisis|chaos|disaster|scandal|shocking|explosive/gi,
      euphemism: /enhanced interrogation|collateral damage|alternative facts/gi,
      attribution: /sources say|reportedly|according to|officials claim/gi
    };
  }
  
  /**
   * Load AllSides bias data
   */
  async loadAllSidesData() {
    try {
      const csvPath = path.join(__dirname, '../lib/bias-detection/AllSideR/data/allsides_data.csv');
      const csvData = await fs.readFile(csvPath, 'utf8');
      const lines = csvData.split('\n');
      const headers = lines[0].split(',');
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 3) {
          const source = values[0].toLowerCase().trim();
          const rating = values[1].trim();
          const numericRating = parseInt(values[2]) || 3;
          
          this.allSidesBiasRatings.set(source, {
            rating: rating,
            numeric: numericRating,
            confidence: values[12]?.trim() || 'Medium'
          });
        }
      }
      
      console.log(`Loaded ${this.allSidesBiasRatings.size} bias ratings from AllSides`);
    } catch (error) {
      console.error('Error loading AllSides data:', error.message);
    }
  }
  
  /**
   * Analyze media bias for an article
   */
  async analyzeArticleBias(article, verbose = false) {
    const startTime = Date.now();
    
    if (verbose) {
      console.log('\n' + '='.repeat(80));
      console.log(`📰 ANALYZING BIAS FOR: ${article.title}`);
      console.log(`   Source: ${article.source}`);
      console.log('='.repeat(80));
    }
    
    // Step 1: Source-level bias from AllSides
    const sourceBias = this.getSourceBias(article.source, verbose);
    
    // Step 2: Content analysis
    const contentBias = await this.analyzeContent(article, verbose);
    
    // Step 3: Linguistic analysis
    const linguisticBias = this.analyzeLinguisticBias(article, verbose);
    
    // Step 4: Framing analysis
    const framingBias = this.analyzeFraming(article, verbose);
    
    // Step 5: AI-powered bias detection
    const aiBias = await this.aiBasedBiasDetection(article, verbose);
    
    // Combine all analyses
    const overallBias = this.combineAnalyses({
      source: sourceBias,
      content: contentBias,
      linguistic: linguisticBias,
      framing: framingBias,
      ai: aiBias
    }, verbose);
    
    const analysisTime = Date.now() - startTime;
    
    if (verbose) {
      console.log('\n📊 FINAL BIAS ASSESSMENT:');
      console.log('─'.repeat(40));
      console.log(`Overall Bias: ${overallBias.label} (${overallBias.score.toFixed(2)})`);
      console.log(`Confidence: ${(overallBias.confidence * 100).toFixed(0)}%`);
      console.log(`Analysis Time: ${analysisTime}ms`);
      console.log('='.repeat(80) + '\n');
    }
    
    return {
      articleId: article.id || article.url,
      source: article.source,
      title: article.title,
      biasAnalysis: overallBias,
      detailedAnalysis: {
        source: sourceBias,
        content: contentBias,
        linguistic: linguisticBias,
        framing: framingBias,
        ai: aiBias
      },
      analysisTime: analysisTime,
      timestamp: new Date()
    };
  }
  
  /**
   * Get source-level bias from AllSides database
   */
  getSourceBias(sourceName, verbose) {
    const normalized = sourceName.toLowerCase().trim();
    const biasData = this.allSidesBiasRatings.get(normalized);
    
    if (verbose) {
      console.log('\n📌 Step 1: Source-Level Bias Analysis');
      console.log('─'.repeat(40));
    }
    
    if (biasData) {
      const score = (biasData.numeric - 3) / 2; // Convert 1-5 to -1 to 1
      
      if (verbose) {
        console.log(`✓ Found in AllSides database`);
        console.log(`  Rating: ${biasData.rating}`);
        console.log(`  Score: ${score.toFixed(2)} (${this.getLabel(score)})`);
        console.log(`  Confidence: ${biasData.confidence}`);
      }
      
      return {
        score: score,
        label: this.getLabel(score),
        confidence: biasData.confidence === 'High' ? 0.9 : 0.7,
        source: 'AllSides'
      };
    }
    
    if (verbose) {
      console.log(`✗ Not found in AllSides database`);
      console.log(`  Using content analysis only`);
    }
    
    return {
      score: 0,
      label: 'unknown',
      confidence: 0,
      source: 'not_found'
    };
  }
  
  /**
   * Analyze content for bias indicators
   */
  async analyzeContent(article, verbose) {
    const text = (article.title + ' ' + article.snippet + ' ' + (article.content || '')).toLowerCase();
    
    if (verbose) {
      console.log('\n🔍 Step 2: Content Bias Analysis');
      console.log('─'.repeat(40));
    }
    
    // Count bias indicators
    const counts = {
      left: 0,
      right: 0,
      center: 0
    };
    
    const foundTerms = {
      left: [],
      right: [],
      center: []
    };
    
    // Check terms
    for (const [bias, indicators] of Object.entries(this.biasIndicators)) {
      for (const term of indicators.terms) {
        if (text.includes(term)) {
          counts[bias]++;
          foundTerms[bias].push(term);
        }
      }
      
      // Check sentiment words
      for (const sentiment of indicators.sentiment) {
        if (text.includes(sentiment)) {
          counts[bias] += 0.5;
          foundTerms[bias].push(`[${sentiment}]`);
        }
      }
    }
    
    // Calculate score
    const total = counts.left + counts.right + counts.center;
    let score = 0;
    let label = 'center';
    
    if (total > 0) {
      const leftRatio = counts.left / total;
      const rightRatio = counts.right / total;
      score = rightRatio - leftRatio; // -1 (left) to 1 (right)
      label = this.getLabel(score);
    }
    
    if (verbose) {
      console.log(`Found bias indicators:`);
      console.log(`  Left: ${counts.left} terms ${foundTerms.left.length > 0 ? '(' + foundTerms.left.slice(0, 3).join(', ') + ')' : ''}`);
      console.log(`  Right: ${counts.right} terms ${foundTerms.right.length > 0 ? '(' + foundTerms.right.slice(0, 3).join(', ') + ')' : ''}`);
      console.log(`  Center: ${counts.center} terms`);
      console.log(`  Score: ${score.toFixed(2)} (${label})`);
    }
    
    return {
      score: score,
      label: label,
      confidence: Math.min(total / 10, 1), // More terms = higher confidence
      indicators: foundTerms,
      counts: counts
    };
  }
  
  /**
   * Analyze linguistic patterns for bias
   */
  analyzeLinguisticBias(article, verbose) {
    const text = article.title + ' ' + article.snippet;
    
    if (verbose) {
      console.log('\n📝 Step 3: Linguistic Bias Analysis');
      console.log('─'.repeat(40));
    }
    
    const patterns = {
      passive_voice: /was\s+\w+ed\s+by|were\s+\w+ed\s+by|been\s+\w+ed/gi,
      hedging: /might|could|possibly|perhaps|seems|appears/gi,
      certainty: /definitely|certainly|undoubtedly|clearly|obviously/gi,
      emotional: /outraged|furious|delighted|thrilled|disgusted|horrified/gi,
      attribution_bias: /liberals say|conservatives claim|democrats allege|republicans insist/gi
    };
    
    const results = {};
    let biasScore = 0;
    
    for (const [pattern, regex] of Object.entries(patterns)) {
      const matches = text.match(regex) || [];
      results[pattern] = matches.length;
      
      // Different patterns indicate different biases
      if (pattern === 'emotional' || pattern === 'certainty') {
        biasScore += matches.length * 0.1; // Slight right bias
      } else if (pattern === 'hedging') {
        biasScore -= matches.length * 0.05; // Slight left bias
      }
    }
    
    // Normalize score
    biasScore = Math.max(-1, Math.min(1, biasScore));
    
    if (verbose) {
      console.log(`Linguistic patterns detected:`);
      for (const [pattern, count] of Object.entries(results)) {
        if (count > 0) {
          console.log(`  ${pattern.replace(/_/g, ' ')}: ${count} instances`);
        }
      }
      console.log(`  Linguistic bias score: ${biasScore.toFixed(2)}`);
    }
    
    return {
      score: biasScore,
      label: this.getLabel(biasScore),
      confidence: 0.6,
      patterns: results
    };
  }
  
  /**
   * Analyze framing and spin
   */
  analyzeFraming(article, verbose) {
    const text = article.title + ' ' + article.snippet;
    
    if (verbose) {
      console.log('\n🎯 Step 4: Framing & Spin Analysis');
      console.log('─'.repeat(40));
    }
    
    const framingResults = {};
    let totalFraming = 0;
    
    for (const [type, pattern] of Object.entries(this.framingPatterns)) {
      const matches = text.match(pattern) || [];
      framingResults[type] = {
        count: matches.length,
        examples: matches.slice(0, 3)
      };
      totalFraming += matches.length;
    }
    
    // High framing generally indicates bias
    const framingScore = Math.min(totalFraming / 10, 1);
    
    if (verbose) {
      console.log(`Framing techniques detected:`);
      for (const [type, data] of Object.entries(framingResults)) {
        if (data.count > 0) {
          console.log(`  ${type}: ${data.count} instances`);
          if (data.examples.length > 0) {
            console.log(`    Examples: ${data.examples.join(', ')}`);
          }
        }
      }
      console.log(`  Framing intensity: ${(framingScore * 100).toFixed(0)}%`);
    }
    
    return {
      score: framingScore,
      label: framingScore > 0.7 ? 'high_spin' : framingScore > 0.3 ? 'moderate_spin' : 'low_spin',
      confidence: 0.7,
      techniques: framingResults
    };
  }
  
  /**
   * AI-based bias detection using GPT
   */
  async aiBasedBiasDetection(article, verbose) {
    if (verbose) {
      console.log('\n🤖 Step 5: AI-Powered Bias Detection');
      console.log('─'.repeat(40));
    }
    
    try {
      const prompt = `Analyze the following news article for political bias. Consider:
1. Word choice and framing
2. Sources cited and their political leanings
3. What information is emphasized vs downplayed
4. Emotional language and tone

Article Title: ${article.title}
Article Text: ${article.snippet}

Provide a bias assessment with:
- bias_direction: "left", "center", or "right"
- bias_score: -1.0 (far left) to 1.0 (far right)
- confidence: 0.0 to 1.0
- key_indicators: array of specific bias indicators found
- explanation: brief explanation of the bias

Return as JSON.`;

      const response = await this.openai.chat.completions.create({
        model: config.apis.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert media bias analyst. Analyze articles objectively for political bias.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });
      
      const aiAnalysis = JSON.parse(response.choices[0].message.content);
      
      if (verbose) {
        console.log(`AI Assessment:`);
        console.log(`  Direction: ${aiAnalysis.bias_direction}`);
        console.log(`  Score: ${aiAnalysis.bias_score}`);
        console.log(`  Confidence: ${(aiAnalysis.confidence * 100).toFixed(0)}%`);
        if (aiAnalysis.key_indicators?.length > 0) {
          console.log(`  Key indicators: ${aiAnalysis.key_indicators.slice(0, 3).join(', ')}`);
        }
      }
      
      return {
        score: aiAnalysis.bias_score || 0,
        label: aiAnalysis.bias_direction || 'unknown',
        confidence: aiAnalysis.confidence || 0.5,
        indicators: aiAnalysis.key_indicators || [],
        explanation: aiAnalysis.explanation
      };
      
    } catch (error) {
      console.error('AI bias detection error:', error.message);
      return {
        score: 0,
        label: 'error',
        confidence: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Combine all bias analyses
   */
  combineAnalyses(analyses, verbose) {
    if (verbose) {
      console.log('\n🔄 Combining All Analyses');
      console.log('─'.repeat(40));
    }
    
    // Weight different analyses
    const weights = {
      source: 0.3,    // AllSides rating
      content: 0.2,   // Term-based analysis
      linguistic: 0.1, // Linguistic patterns
      framing: 0.1,   // Framing techniques
      ai: 0.3        // AI analysis
    };
    
    let weightedScore = 0;
    let totalWeight = 0;
    let totalConfidence = 0;
    let confidenceWeight = 0;
    
    for (const [type, analysis] of Object.entries(analyses)) {
      if (analysis.score !== undefined && analysis.confidence > 0) {
        const weight = weights[type] || 0.1;
        weightedScore += analysis.score * weight * analysis.confidence;
        totalWeight += weight * analysis.confidence;
        totalConfidence += analysis.confidence * weight;
        confidenceWeight += weight;
        
        if (verbose) {
          console.log(`  ${type}: score=${analysis.score.toFixed(2)}, weight=${weight}, confidence=${analysis.confidence.toFixed(2)}`);
        }
      }
    }
    
    const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const finalConfidence = confidenceWeight > 0 ? totalConfidence / confidenceWeight : 0;
    
    return {
      score: finalScore,
      label: this.getLabel(finalScore),
      confidence: finalConfidence,
      components: analyses
    };
  }
  
  /**
   * Get bias label from score
   */
  getLabel(score) {
    if (score < -0.6) return 'far-left';
    if (score < -0.2) return 'left';
    if (score < 0.2) return 'center';
    if (score < 0.6) return 'right';
    return 'far-right';
  }
  
  /**
   * Analyze bias for multiple articles
   */
  async analyzeBatch(articles, verbose = false) {
    console.log(`\n🔍 Analyzing bias for ${articles.length} articles...\n`);
    
    const results = [];
    for (const article of articles) {
      const analysis = await this.analyzeArticleBias(article, verbose);
      results.push(analysis);
    }
    
    // Calculate aggregate statistics
    const stats = this.calculateAggregateStats(results);
    
    console.log('\n📊 AGGREGATE BIAS STATISTICS:');
    console.log('═'.repeat(60));
    console.log(`Total Articles: ${results.length}`);
    console.log(`Average Bias: ${stats.averageBias.toFixed(2)} (${this.getLabel(stats.averageBias)})`);
    console.log(`Distribution:`);
    for (const [label, count] of Object.entries(stats.distribution)) {
      const percentage = (count / results.length * 100).toFixed(1);
      console.log(`  ${label}: ${count} articles (${percentage}%)`);
    }
    console.log(`Average Confidence: ${(stats.averageConfidence * 100).toFixed(0)}%`);
    console.log('═'.repeat(60));
    
    return {
      articles: results,
      aggregateStats: stats
    };
  }
  
  /**
   * Calculate aggregate statistics
   */
  calculateAggregateStats(results) {
    const distribution = {
      'far-left': 0,
      'left': 0,
      'center': 0,
      'right': 0,
      'far-right': 0
    };
    
    let totalScore = 0;
    let totalConfidence = 0;
    
    for (const result of results) {
      const label = result.biasAnalysis.label;
      distribution[label] = (distribution[label] || 0) + 1;
      totalScore += result.biasAnalysis.score;
      totalConfidence += result.biasAnalysis.confidence;
    }
    
    return {
      averageBias: totalScore / results.length,
      averageConfidence: totalConfidence / results.length,
      distribution: distribution,
      totalArticles: results.length
    };
  }

  /**
   * Load source bias ratings from database
   */
  async loadSourceBiasFromDB() {
    try {
      const { data, error } = await this.supabase
        .from('source_bias_ratings')
        .select('*');
      
      if (error) {
        console.error('Error loading source bias from DB:', error);
        return;
      }
      
      // Merge with AllSides data
      data.forEach(source => {
        const normalized = source.source_name.toLowerCase().trim();
        const biasScore = this.convertBiasRatingToScore(source.bias_rating);
        
        this.allSidesBiasRatings.set(normalized, {
          rating: source.bias_rating,
          numeric: (biasScore + 1) * 2.5 + 0.5, // Convert to 1-5 scale
          confidence: source.reliability_score > 0.8 ? 'High' : 'Medium',
          dbId: source.id
        });
      });
      
      console.log(`Loaded ${data.length} additional bias ratings from database`);
    } catch (error) {
      console.error('Failed to load source bias from database:', error);
    }
  }

  /**
   * Convert bias rating string to numeric score
   */
  convertBiasRatingToScore(rating) {
    const ratingMap = {
      'far-left': -1.0,
      'left': -0.6,
      'center-left': -0.3,
      'center': 0,
      'center-right': 0.3,
      'right': 0.6,
      'far-right': 1.0
    };
    return ratingMap[rating] || 0;
  }

  /**
   * Enhanced analyze method that returns Phase 2 format
   */
  async analyzeBias(articleText, source) {
    // Create a minimal article object for the existing analyzer
    const article = {
      title: articleText.substring(0, 200),
      snippet: articleText,
      content: articleText,
      source: source
    };
    
    // Use existing comprehensive analysis
    const analysis = await this.analyzeArticleBias(article, false);
    
    // Format for Phase 2 requirements
    return {
      sourceBias: analysis.detailedAnalysis.source.label,
      contentBiasScore: analysis.biasAnalysis.score,
      politicalAlignment: analysis.biasAnalysis.label,
      confidence: analysis.biasAnalysis.confidence,
      // Additional metadata
      detailedAnalysis: analysis.detailedAnalysis,
      indicators: analysis.detailedAnalysis.content.indicators,
      framingTechniques: analysis.detailedAnalysis.framing.techniques
    };
  }

  /**
   * Save bias analysis to database
   */
  async saveBiasAnalysis(eventId, biasData) {
    try {
      const { error } = await this.supabase
        .from('events')
        .update({
          bias: biasData,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId);
      
      if (error) {
        console.error('Error saving bias analysis:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save bias analysis:', error);
      return false;
    }
  }

  /**
   * Get or create source bias rating
   */
  async getOrCreateSourceBias(sourceName) {
    const normalized = sourceName.toLowerCase().trim();
    
    // Check cache first
    if (this.allSidesBiasRatings.has(normalized)) {
      return this.allSidesBiasRatings.get(normalized);
    }
    
    // Check database
    const { data, error } = await this.supabase
      .from('source_bias_ratings')
      .select('*')
      .eq('source_name', sourceName)
      .single();
    
    if (data) {
      return {
        rating: data.bias_rating,
        reliability: data.reliability_score
      };
    }
    
    // Not found - analyze and create
    const articles = await this.fetchRecentArticlesFromSource(sourceName, 10);
    if (articles.length > 0) {
      const batchAnalysis = await this.analyzeBatch(articles, false);
      const avgBias = batchAnalysis.aggregateStats.averageBias;
      const biasRating = this.getLabel(avgBias);
      
      // Save to database
      await this.supabase
        .from('source_bias_ratings')
        .insert({
          source_name: sourceName,
          bias_rating: biasRating,
          reliability_score: batchAnalysis.aggregateStats.averageConfidence,
          metadata: {
            sample_size: articles.length,
            last_analysis: new Date().toISOString()
          }
        });
      
      return {
        rating: biasRating,
        reliability: batchAnalysis.aggregateStats.averageConfidence
      };
    }
    
    return null;
  }

  /**
   * Fetch recent articles from a source for analysis
   */
  async fetchRecentArticlesFromSource(sourceName, limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .select('id, title, summary, source')
        .eq('source', sourceName)
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching articles:', error);
        return [];
      }
      
      return data.map(event => ({
        id: event.id,
        title: event.title,
        snippet: event.summary,
        source: event.source
      }));
    } catch (error) {
      console.error('Failed to fetch articles from source:', error);
      return [];
    }
  }

  /**
   * Detect HuggingFace model fallback for content bias classification
   */
  async classifyBiasWithModel(text) {
    // Check if we have a local model or use HuggingFace API
    if (config.apis.huggingface?.apiKey) {
      try {
        const response = await fetch(
          "https://api-inference.huggingface.co/models/d4data/bias-detection-model",
          {
            headers: { Authorization: `Bearer ${config.apis.huggingface.apiKey}` },
            method: "POST",
            body: JSON.stringify({ inputs: text }),
          }
        );
        
        const result = await response.json();
        
        // Parse HuggingFace response
        if (result && result[0]) {
          const scores = result[0];
          const maxScore = Math.max(...scores.map(s => s.score));
          const prediction = scores.find(s => s.score === maxScore);
          
          return {
            score: this.convertBiasRatingToScore(prediction.label),
            label: prediction.label,
            confidence: prediction.score
          };
        }
      } catch (error) {
        console.error('HuggingFace bias detection failed:', error);
      }
    }
    
    // Fallback to existing content analysis
    return this.analyzeContent({ content: text }, false);
  }
}