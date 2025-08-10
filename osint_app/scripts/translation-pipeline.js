#!/usr/bin/env node

/**
 * Translation Pipeline for Multi-language News Content
 * Translates articles from various languages to English for processing
 * Supports batch processing and caching for efficiency
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

// Translation services configuration
const TRANSLATION_SERVICES = {
  GOOGLE: 'google',
  OPENAI: 'openai',
  AZURE: 'azure'
};

// Language mappings
const LANGUAGE_MAPPINGS = {
  'ru': 'Russian',
  'zh': 'Chinese',
  'ar': 'Arabic',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ja': 'Japanese'
};

class TranslationPipeline {
  constructor(options = {}) {
    this.service = options.service || TRANSLATION_SERVICES.OPENAI;
    this.cacheDir = options.cacheDir || path.join(__dirname, '..', 'data', 'translation-cache');
    this.batchSize = options.batchSize || 5;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000;
    
    // Statistics
    this.stats = {
      totalArticles: 0,
      translated: 0,
      cached: 0,
      failed: 0,
      totalCost: 0,
      languageBreakdown: {}
    };
    
    // Initialize cache directory
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  generateCacheKey(content, sourceLang, targetLang = 'en') {
    const hash = crypto.createHash('sha256');
    hash.update(`${content}|${sourceLang}|${targetLang}`);
    return hash.digest('hex');
  }

  async getCachedTranslation(content, sourceLang, targetLang = 'en') {
    const cacheKey = this.generateCacheKey(content, sourceLang, targetLang);
    const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
    
    try {
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        
        // Check if cache is still valid (30 days)
        const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
        if (cacheAge < 30 * 24 * 60 * 60 * 1000) {
          return cached.translation;
        }
      }
    } catch (error) {
      console.warn(`Cache read error for ${cacheKey}:`, error.message);
    }
    
    return null;
  }

  async setCachedTranslation(content, sourceLang, targetLang, translation) {
    const cacheKey = this.generateCacheKey(content, sourceLang, targetLang);
    const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
    
    try {
      const cacheData = {
        original: content,
        translation,
        sourceLang,
        targetLang,
        timestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.warn(`Cache write error for ${cacheKey}:`, error.message);
    }
  }

  async translateWithOpenAI(content, sourceLang, targetLang = 'en') {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    const sourceLanguage = LANGUAGE_MAPPINGS[sourceLang] || sourceLang;
    
    const prompt = `Translate the following ${sourceLanguage} text to English. Preserve the original meaning and context. If the text contains news content, maintain journalistic tone and accuracy. Only return the translation, no additional text:

${content}`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a professional translator specializing in news and intelligence content. Translate accurately while preserving meaning and context.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const translation = response.data.choices[0].message.content.trim();
      
      // Rough cost estimation (gpt-3.5-turbo pricing)
      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(translation.length / 4);
      const cost = (inputTokens * 0.001 + outputTokens * 0.002) / 1000;
      this.stats.totalCost += cost;
      
      return translation;
      
    } catch (error) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`OpenAI translation failed: ${error.message}`);
    }
  }

  async translateWithGoogle(content, sourceLang, targetLang = 'en') {
    const googleApiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!googleApiKey) {
      throw new Error('GOOGLE_TRANSLATE_API_KEY environment variable is required');
    }

    try {
      const response = await axios.post(
        'https://translation.googleapis.com/language/translate/v2',
        {
          q: content,
          source: sourceLang,
          target: targetLang,
          key: googleApiKey
        },
        {
          timeout: 30000
        }
      );

      return response.data.data.translations[0].translatedText;
      
    } catch (error) {
      throw new Error(`Google Translate failed: ${error.message}`);
    }
  }

  async translateContent(content, sourceLang, targetLang = 'en') {
    // Check cache first
    const cached = await this.getCachedTranslation(content, sourceLang, targetLang);
    if (cached) {
      this.stats.cached++;
      return cached;
    }

    // Translate based on service
    let translation;
    switch (this.service) {
      case TRANSLATION_SERVICES.OPENAI:
        translation = await this.translateWithOpenAI(content, sourceLang, targetLang);
        break;
      case TRANSLATION_SERVICES.GOOGLE:
        translation = await this.translateWithGoogle(content, sourceLang, targetLang);
        break;
      default:
        throw new Error(`Unsupported translation service: ${this.service}`);
    }

    // Cache the translation
    await this.setCachedTranslation(content, sourceLang, targetLang, translation);
    
    this.stats.translated++;
    return translation;
  }

  async translateArticle(article) {
    const { language, title, description, content } = article;
    
    if (language === 'en') {
      return article; // Already in English
    }

    this.stats.totalArticles++;
    this.stats.languageBreakdown[language] = (this.stats.languageBreakdown[language] || 0) + 1;

    try {
      console.log(`Translating article from ${language}: ${title.substring(0, 50)}...`);
      
      // Translate title and content
      const translatedTitle = await this.translateContent(title, language);
      const translatedDescription = description ? await this.translateContent(description, language) : '';
      const translatedContent = content ? await this.translateContent(content, language) : '';
      
      return {
        ...article,
        title: translatedTitle,
        description: translatedDescription,
        content: translatedContent,
        originalTitle: title,
        originalDescription: description,
        originalContent: content,
        originalLanguage: language,
        language: 'en',
        translated: true,
        translationService: this.service,
        translationTimestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`Translation failed for article: ${error.message}`);
      this.stats.failed++;
      
      // Return original article with error flag
      return {
        ...article,
        translationError: error.message,
        translationTimestamp: new Date().toISOString()
      };
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async translateBatch(articles) {
    const results = [];
    
    for (let i = 0; i < articles.length; i += this.batchSize) {
      const batch = articles.slice(i, i + this.batchSize);
      
      console.log(`Processing translation batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(articles.length / this.batchSize)}`);
      
      const batchPromises = batch.map(article => this.translateArticle(article));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Batch error for article ${i + index}:`, result.reason);
          results.push({
            ...batch[index],
            translationError: result.reason.message,
            translationTimestamp: new Date().toISOString()
          });
        }
      });
      
      // Rate limiting between batches
      if (i + this.batchSize < articles.length) {
        await this.sleep(1000);
      }
    }
    
    return results;
  }

  async processRSSFetchResults(resultsPath) {
    console.log(`📖 Loading RSS fetch results from: ${resultsPath}`);
    
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const articles = results.articles || [];
    
    console.log(`📄 Found ${articles.length} articles`);
    
    // Filter articles that need translation
    const articlesNeedingTranslation = articles.filter(article => 
      article.needsTranslation && article.language !== 'en'
    );
    
    console.log(`🔄 ${articlesNeedingTranslation.length} articles need translation`);
    
    if (articlesNeedingTranslation.length === 0) {
      console.log('✅ No articles need translation');
      return articles;
    }
    
    // Translate articles
    const startTime = Date.now();
    const translatedArticles = await this.translateBatch(articlesNeedingTranslation);
    const endTime = Date.now();
    
    // Combine translated articles with English ones
    const englishArticles = articles.filter(article => 
      !article.needsTranslation || article.language === 'en'
    );
    
    const allArticles = [...englishArticles, ...translatedArticles];
    
    // Statistics
    const duration = (endTime - startTime) / 1000;
    console.log('\n📊 TRANSLATION COMPLETE');
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📄 Total articles processed: ${this.stats.totalArticles}`);
    console.log(`✅ Successfully translated: ${this.stats.translated}`);
    console.log(`💾 Retrieved from cache: ${this.stats.cached}`);
    console.log(`❌ Failed translations: ${this.stats.failed}`);
    console.log(`💰 Estimated cost: $${this.stats.totalCost.toFixed(4)}`);
    
    if (Object.keys(this.stats.languageBreakdown).length > 0) {
      console.log('\n🌐 Language breakdown:');
      Object.entries(this.stats.languageBreakdown).forEach(([lang, count]) => {
        console.log(`  ${lang}: ${count} articles`);
      });
    }
    
    return allArticles;
  }

  async saveTranslatedResults(articles, outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `translated-articles-${timestamp}.json`;
    const fullPath = path.join(outputPath, filename);
    
    const output = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalArticles: articles.length,
        translatedArticles: articles.filter(a => a.translated).length,
        translationService: this.service,
        stats: this.stats
      },
      articles
    };
    
    fs.writeFileSync(fullPath, JSON.stringify(output, null, 2));
    console.log(`💾 Translated results saved to: ${fullPath}`);
    
    return fullPath;
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputFile = args[0];
  const service = args[1] || 'openai';
  
  if (!inputFile) {
    console.log('Translation Pipeline - Argos Intelligence Platform');
    console.log('');
    console.log('Usage:');
    console.log('  node translation-pipeline.js <input-file> [service]');
    console.log('');
    console.log('Arguments:');
    console.log('  input-file    Path to RSS fetch results JSON file');
    console.log('  service       Translation service: openai, google (default: openai)');
    console.log('');
    console.log('Environment Variables:');
    console.log('  OPENAI_API_KEY           Required for OpenAI service');
    console.log('  GOOGLE_TRANSLATE_API_KEY Required for Google service');
    process.exit(1);
  }
  
  async function main() {
    try {
      const pipeline = new TranslationPipeline({
        service: service.toLowerCase(),
        batchSize: 3 // Conservative batch size to avoid rate limits
      });
      
      // Process the articles
      const translatedArticles = await pipeline.processRSSFetchResults(inputFile);
      
      // Save results
      const outputDir = path.join(__dirname, '..', 'data', 'translated-articles');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      await pipeline.saveTranslatedResults(translatedArticles, outputDir);
      
      console.log('\n🎉 Translation pipeline completed successfully!');
      
    } catch (error) {
      console.error('Translation pipeline error:', error);
      process.exit(1);
    }
  }
  
  main();
}

module.exports = TranslationPipeline;