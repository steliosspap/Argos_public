/**
 * Multi-Language Support Module
 * Handles translation and cross-lingual analysis for bias detection and fact-checking
 */

import OpenAI from 'openai';

export interface TranslationResult {
  originalLanguage: string;
  translatedText: string;
  confidence: number;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  script: string;
}

export interface CrossLingualAnalysis {
  primaryLanguage: string;
  languages: string[];
  crossLingualCorroboration: boolean;
  translationQuality: number;
}

interface MultiLanguageConfig {
  openaiApiKey: string;
  model?: string;
  enableTranslation?: boolean;
  targetLanguage?: string;
}

export class MultiLanguageAnalyzer {
  private openai: OpenAI;
  private model: string;
  private enableTranslation: boolean;
  private targetLanguage: string;

  // ISO 639-1 language codes mapping
  private static readonly LANGUAGE_NAMES: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'tr': 'Turkish',
    'pl': 'Polish',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
    'he': 'Hebrew',
    'uk': 'Ukrainian',
    'fa': 'Persian',
    'ur': 'Urdu'
  };

  // Language-specific bias indicators
  private static readonly LANGUAGE_BIAS_INDICATORS: Record<string, {
    left: string[],
    right: string[],
    sensational: string[]
  }> = {
    'es': {
      left: ['fascista', 'opresivo', 'desigualdad', 'sistémico', 'marginalizado'],
      right: ['radical', 'socialista', 'libertad', 'patriota', 'valores tradicionales'],
      sensational: ['impactante', 'explosivo', 'devastador', 'crisis', 'sin precedentes']
    },
    'fr': {
      left: ['fasciste', 'oppressif', 'inégalité', 'systémique', 'marginalisé'],
      right: ['radical', 'socialiste', 'liberté', 'patriote', 'valeurs traditionnelles'],
      sensational: ['choquant', 'explosif', 'dévastateur', 'crise', 'sans précédent']
    },
    'de': {
      left: ['faschistisch', 'unterdrückend', 'Ungleichheit', 'systemisch', 'marginalisiert'],
      right: ['radikal', 'sozialistisch', 'Freiheit', 'Patriot', 'traditionelle Werte'],
      sensational: ['schockierend', 'explosiv', 'verheerend', 'Krise', 'beispiellos']
    },
    'ar': {
      left: ['فاشي', 'قمعي', 'عدم المساواة', 'نظامي', 'مهمش'],
      right: ['راديكالي', 'اشتراكي', 'حرية', 'وطني', 'قيم تقليدية'],
      sensational: ['صادم', 'انفجاري', 'مدمر', 'أزمة', 'غير مسبوق']
    }
  };

  private static readonly LANGUAGE_DETECTION_PROMPT = `Detect the language of this text and provide:
1. The primary language (ISO 639-1 code)
2. Confidence level (0-1)
3. Script type (Latin, Cyrillic, Arabic, etc.)
4. Any secondary languages detected

Text: {text}

Return JSON:
{
  "language": "ISO 639-1 code",
  "confidence": 0.0-1.0,
  "script": "script name",
  "secondaryLanguages": ["codes"]
}`;

  private static readonly TRANSLATION_PROMPT = `Translate the following text to {targetLanguage}. 
Maintain the original meaning and tone as closely as possible.
If the text contains biased language, preserve the bias in translation.

Original text ({sourceLanguage}):
{text}

Provide:
1. The translation
2. Translation quality score (0-1)
3. Any challenging phrases or cultural concepts

Return JSON:
{
  "translation": "translated text",
  "quality": 0.0-1.0,
  "notes": ["any translation challenges"]
}`;

  private static readonly MULTILINGUAL_BIAS_PROMPT = `Analyze this text for bias in its original language ({language}).
Consider language-specific cultural context and expressions.

Text: {text}

Identify:
1. Culturally-specific bias indicators
2. Language-specific loaded terms
3. Regional political context
4. Idiomatic expressions that indicate bias

Return JSON with bias analysis adapted for the source language and culture.`;

  constructor(config: MultiLanguageConfig) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.model || 'gpt-4o';
    this.enableTranslation = config.enableTranslation ?? true;
    this.targetLanguage = config.targetLanguage || 'en';
  }

  /**
   * Detect the language of a text
   */
  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    try {
      // Quick heuristic check for common languages
      const heuristicResult = this.heuristicLanguageDetection(text);
      if (heuristicResult.confidence > 0.8) {
        return heuristicResult;
      }

      // Use LLM for more accurate detection
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: MultiLanguageAnalyzer.LANGUAGE_DETECTION_PROMPT.replace('{text}', text.substring(0, 500))
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        language: result.language || 'unknown',
        confidence: result.confidence || 0.5,
        script: result.script || 'Unknown'
      };
    } catch (error) {
      console.error('[MultiLanguage] Language detection failed:', error);
      return {
        language: 'unknown',
        confidence: 0,
        script: 'Unknown'
      };
    }
  }

  /**
   * Heuristic language detection based on character patterns
   */
  private heuristicLanguageDetection(text: string): LanguageDetectionResult {
    // Check for script-based detection
    if (/[\u0600-\u06FF]/.test(text)) {
      return { language: 'ar', confidence: 0.9, script: 'Arabic' };
    }
    if (/[\u4E00-\u9FFF]/.test(text)) {
      return { language: 'zh', confidence: 0.9, script: 'Chinese' };
    }
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
      return { language: 'ja', confidence: 0.9, script: 'Japanese' };
    }
    if (/[\u0400-\u04FF]/.test(text)) {
      return { language: 'ru', confidence: 0.8, script: 'Cyrillic' };
    }
    if (/[\u0590-\u05FF]/.test(text)) {
      return { language: 'he', confidence: 0.9, script: 'Hebrew' };
    }

    // For Latin script, check common words
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes(' the ') || lowerText.includes(' and ') || lowerText.includes(' is ')) {
      return { language: 'en', confidence: 0.7, script: 'Latin' };
    }
    if (lowerText.includes(' de ') || lowerText.includes(' la ') || lowerText.includes(' el ')) {
      return { language: 'es', confidence: 0.6, script: 'Latin' };
    }
    if (lowerText.includes(' le ') || lowerText.includes(' et ') || lowerText.includes(' est ')) {
      return { language: 'fr', confidence: 0.6, script: 'Latin' };
    }
    if (lowerText.includes(' der ') || lowerText.includes(' die ') || lowerText.includes(' und ')) {
      return { language: 'de', confidence: 0.6, script: 'Latin' };
    }

    return { language: 'unknown', confidence: 0.3, script: 'Latin' };
  }

  /**
   * Translate text to target language
   */
  async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage?: string
  ): Promise<TranslationResult> {
    const target = targetLanguage || this.targetLanguage;

    // Skip if already in target language
    if (sourceLanguage === target) {
      return {
        originalLanguage: sourceLanguage,
        translatedText: text,
        confidence: 1.0
      };
    }

    try {
      const sourceLangName = MultiLanguageAnalyzer.LANGUAGE_NAMES[sourceLanguage] || sourceLanguage;
      const targetLangName = MultiLanguageAnalyzer.LANGUAGE_NAMES[target] || target;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: MultiLanguageAnalyzer.TRANSLATION_PROMPT
              .replace('{targetLanguage}', targetLangName)
              .replace('{sourceLanguage}', sourceLangName)
              .replace('{text}', text)
          }
        ],
        temperature: 0.3,
        max_tokens: Math.min(4000, text.length * 2),
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        originalLanguage: sourceLanguage,
        translatedText: result.translation || text,
        confidence: result.quality || 0.7
      };
    } catch (error) {
      console.error('[MultiLanguage] Translation failed:', error);
      return {
        originalLanguage: sourceLanguage,
        translatedText: text,
        confidence: 0
      };
    }
  }

  /**
   * Analyze bias in original language with cultural context
   */
  async analyzeMultilingualBias(
    text: string,
    language: string
  ): Promise<{
    languageSpecificIndicators: string[];
    culturalContext: string;
    biasPatterns: any;
  }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: MultiLanguageAnalyzer.MULTILINGUAL_BIAS_PROMPT
              .replace('{language}', MultiLanguageAnalyzer.LANGUAGE_NAMES[language] || language)
              .replace('{text}', text)
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('[MultiLanguage] Multilingual bias analysis failed:', error);
      return {
        languageSpecificIndicators: [],
        culturalContext: '',
        biasPatterns: {}
      };
    }
  }

  /**
   * Get language-specific bias indicators
   */
  getLanguageBiasIndicators(language: string): {
    left: string[],
    right: string[],
    sensational: string[]
  } {
    return MultiLanguageAnalyzer.LANGUAGE_BIAS_INDICATORS[language] || {
      left: [],
      right: [],
      sensational: []
    };
  }

  /**
   * Cross-lingual fact verification
   */
  async crossLingualSearch(
    claim: string,
    sourceLanguage: string,
    targetLanguages: string[]
  ): Promise<{
    language: string;
    query: string;
  }[]> {
    const queries: { language: string; query: string }[] = [
      { language: sourceLanguage, query: claim }
    ];

    // Translate claim to other languages for cross-lingual search
    for (const targetLang of targetLanguages) {
      if (targetLang !== sourceLanguage) {
        const translation = await this.translateText(claim, sourceLanguage, targetLang);
        if (translation.confidence > 0.7) {
          queries.push({
            language: targetLang,
            query: translation.translatedText
          });
        }
      }
    }

    return queries;
  }

  /**
   * Analyze if article content appears in multiple languages
   */
  async analyzeCrossLingualCoverage(
    articles: Array<{
      text: string;
      language?: string;
      source: string;
    }>
  ): Promise<CrossLingualAnalysis> {
    // Detect languages for all articles
    const languageResults = await Promise.all(
      articles.map(async (article) => {
        if (article.language) return article.language;
        const detected = await this.detectLanguage(article.text);
        return detected.language;
      })
    );

    const uniqueLanguages = [...new Set(languageResults)];
    const primaryLanguage = this.getMostFrequent(languageResults);

    return {
      primaryLanguage,
      languages: uniqueLanguages,
      crossLingualCorroboration: uniqueLanguages.length > 1,
      translationQuality: uniqueLanguages.length > 1 ? 0.8 : 1.0
    };
  }

  /**
   * Helper to get most frequent element
   */
  private getMostFrequent(arr: string[]): string {
    const frequency = new Map<string, number>();
    arr.forEach(item => {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    });

    let maxFreq = 0;
    let mostFrequent = arr[0];
    
    frequency.forEach((freq, item) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mostFrequent = item;
      }
    });

    return mostFrequent;
  }

  /**
   * Prepare article for analysis (detect language and optionally translate)
   */
  async prepareArticleForAnalysis(article: {
    title: string;
    content: string;
    language?: string;
  }): Promise<{
    originalLanguage: string;
    isTranslated: boolean;
    title: string;
    content: string;
    translationConfidence: number;
  }> {
    // Detect language if not provided
    const language = article.language || 
      (await this.detectLanguage(`${article.title} ${article.content}`)).language;

    // If translation is disabled or already in target language, return as-is
    if (!this.enableTranslation || language === this.targetLanguage) {
      return {
        originalLanguage: language,
        isTranslated: false,
        title: article.title,
        content: article.content,
        translationConfidence: 1.0
      };
    }

    // Translate both title and content
    const [titleTranslation, contentTranslation] = await Promise.all([
      this.translateText(article.title, language, this.targetLanguage),
      this.translateText(article.content, language, this.targetLanguage)
    ]);

    return {
      originalLanguage: language,
      isTranslated: true,
      title: titleTranslation.translatedText,
      content: contentTranslation.translatedText,
      translationConfidence: (titleTranslation.confidence + contentTranslation.confidence) / 2
    };
  }
}