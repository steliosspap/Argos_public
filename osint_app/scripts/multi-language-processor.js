#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

/**
 * Multi-language Processing for OSINT Pipeline
 * Supports translation and language-aware processing
 */

// Language detection patterns
const LANGUAGE_PATTERNS = {
  ar: /[\u0600-\u06FF\u0750-\u077F]/,  // Arabic
  he: /[\u0590-\u05FF]/,                // Hebrew
  ru: /[\u0400-\u04FF]/,                // Cyrillic
  zh: /[\u4E00-\u9FFF]/,                // Chinese
  ja: /[\u3040-\u309F\u30A0-\u30FF]/,   // Japanese
  ko: /[\uAC00-\uD7AF]/,                // Korean
  fa: /[\u06F0-\u06F9]/,                // Persian
};

/**
 * Detect language from text
 * @param {string} text - Text to analyze
 * @returns {string} - ISO language code
 */
function detectLanguage(text) {
  if (!text) return 'en';
  
  // Check for non-Latin scripts
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    if (pattern.test(text)) {
      return lang;
    }
  }
  
  // Default to English for Latin scripts
  return 'en';
}

/**
 * Translate text using LibreTranslate API (self-hosted option)
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @returns {string} - Translated text
 */
async function translateWithLibre(text, sourceLang, targetLang = 'en') {
  const libreUrl = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com/translate';
  const apiKey = process.env.LIBRETRANSLATE_API_KEY;
  
  try {
    const response = await fetch(libreUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
      },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Translation failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.translatedText;
  } catch (error) {
    console.error('LibreTranslate error:', error.message);
    return text; // Return original text on error
  }
}

/**
 * Translate text using Google Translate API (requires API key)
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @returns {string} - Translated text
 */
async function translateWithGoogle(text, targetLang = 'en') {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  
  if (!apiKey) {
    return text; // Skip if no API key
  }
  
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: targetLang,
        format: 'text'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Google Translate failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data.translations[0].translatedText;
  } catch (error) {
    console.error('Google Translate error:', error.message);
    return text;
  }
}

/**
 * Process multi-language article
 * @param {Object} article - Article to process
 * @returns {Object} - Processed article with translations
 */
async function processMultiLanguageArticle(article) {
  const detectedLang = detectLanguage(article.title + ' ' + article.summary);
  
  // Skip if already in English
  if (detectedLang === 'en') {
    return {
      ...article,
      language: 'en',
      original_language: 'en'
    };
  }
  
  console.log(`🌐 Translating ${detectedLang} article: ${article.title.substring(0, 50)}...`);
  
  // Preserve original text
  const processed = {
    ...article,
    language: 'en',
    original_language: detectedLang,
    original_title: article.title,
    original_summary: article.summary
  };
  
  // Translate based on available services
  if (process.env.GOOGLE_TRANSLATE_API_KEY) {
    processed.title = await translateWithGoogle(article.title);
    processed.summary = await translateWithGoogle(article.summary);
  } else if (process.env.LIBRETRANSLATE_URL) {
    processed.title = await translateWithLibre(article.title, detectedLang);
    processed.summary = await translateWithLibre(article.summary, detectedLang);
  }
  
  return processed;
}

/**
 * Extract location names in multiple languages
 * @param {string} text - Text to analyze
 * @param {string} language - Language code
 * @returns {Array} - Extracted locations
 */
function extractMultilingualLocations(text, language) {
  const locations = [];
  
  // Language-specific location patterns
  const patterns = {
    ar: {
      in: /في\s+([^\s,]+)/g,
      near: /قرب\s+([^\s,]+)/g
    },
    ru: {
      in: /в\s+([А-Яа-я]+)/g,
      near: /около\s+([А-Яа-я]+)/g
    },
    zh: {
      in: /在(.+?)(?:。|，|、)/g,
      near: /靠近(.+?)(?:。|，|、)/g
    }
  };
  
  const langPatterns = patterns[language] || patterns.en;
  
  if (langPatterns) {
    Object.values(langPatterns).forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        locations.push(match[1]);
      }
    });
  }
  
  return [...new Set(locations)];
}

/**
 * Create language-aware SITREP prompt
 * @param {string} language - Primary language of articles
 * @returns {string} - Enhanced prompt
 */
function createMultilingualSITREPPrompt(language) {
  const basePrompt = `You are a multilingual geopolitical intelligence analyst for Argos OSINT platform.

IMPORTANT: You are processing articles that may be in multiple languages including ${language}.

When processing non-English content:
1. Translate all content to English for the SITREP output
2. Preserve original location names when possible
3. Be aware of cultural context in translations
4. Maintain accuracy of military/technical terms

${SITREP_PROMPT}

Additional multilingual guidelines:
- If location names are in non-Latin scripts, provide romanization
- Be careful with proper nouns and organization names
- Consider regional naming conventions (e.g., Kyiv vs Kiev)
- Preserve original meaning without Western bias`;

  return basePrompt;
}

/**
 * Batch process articles with language detection
 * @param {Array} articles - Articles to process
 * @returns {Array} - Processed articles
 */
async function batchProcessMultilingual(articles) {
  console.log(`🌍 Processing ${articles.length} articles for language detection...`);
  
  const languageGroups = {};
  
  // Group by language
  for (const article of articles) {
    const lang = detectLanguage(article.title + ' ' + article.summary);
    if (!languageGroups[lang]) {
      languageGroups[lang] = [];
    }
    languageGroups[lang].push(article);
  }
  
  console.log('Language distribution:', Object.entries(languageGroups).map(([lang, items]) => 
    `${lang}: ${items.length}`
  ).join(', '));
  
  const processedArticles = [];
  
  // Process each language group
  for (const [lang, langArticles] of Object.entries(languageGroups)) {
    if (lang !== 'en') {
      // Translate non-English articles
      for (const article of langArticles) {
        const processed = await processMultiLanguageArticle(article);
        processedArticles.push(processed);
      }
    } else {
      // Keep English articles as-is
      processedArticles.push(...langArticles.map(a => ({
        ...a,
        language: 'en',
        original_language: 'en'
      })));
    }
  }
  
  return processedArticles;
}

export {
  detectLanguage,
  translateWithLibre,
  translateWithGoogle,
  processMultiLanguageArticle,
  extractMultilingualLocations,
  createMultilingualSITREPPrompt,
  batchProcessMultilingual
};