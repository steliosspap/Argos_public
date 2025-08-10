/**
 * Source Model
 * Represents news sources and their reliability metrics
 */

export class Source {
  constructor(data = {}) {
    // Identifiers
    this.id = data.id || null;
    this.name = data.name || '';
    this.normalizedName = data.normalizedName || this.normalizeName(data.name);
    this.website = data.website || '';
    
    // Source metadata
    this.sourceType = data.sourceType || 'news'; // news, institutional, social, blog
    this.language = data.language || 'en';
    this.countryOfOrigin = data.countryOfOrigin || '';
    this.region = data.region || '';
    
    // Reliability metrics
    this.reliabilityScore = data.reliabilityScore || 50; // 0-100
    this.biasScore = data.biasScore || 0; // -1 (left) to 1 (right)
    this.biasSource = data.biasSource || null; // Where bias rating came from
    this.lastBiasUpdate = data.lastBiasUpdate || null;
    
    // Performance metrics
    this.historicalAccuracy = data.historicalAccuracy || 0.5;
    this.speedVsAccuracy = data.speedVsAccuracy || 0.5; // 0 = slow/accurate, 1 = fast/inaccurate
    this.updateFrequency = data.updateFrequency || 0; // Articles per day
    
    // Geographic expertise
    this.geographicExpertise = data.geographicExpertise || {}; // {region: score}
    this.conflictExpertise = data.conflictExpertise || 0.5;
    
    // Access information
    this.rssUrl = data.rssUrl || null;
    this.apiEndpoint = data.apiEndpoint || null;
    this.accessMethod = data.accessMethod || 'rss'; // rss, api, scrape
    this.rateLimit = data.rateLimit || null; // Requests per hour
    this.lastAccessed = data.lastAccessed || null;
    this.accessCountToday = data.accessCountToday || 0;
    
    // Health metrics
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.lastSuccessfulFetch = data.lastSuccessfulFetch || null;
    this.consecutiveFailures = data.consecutiveFailures || 0;
    this.healthScore = data.healthScore || 1.0;
    
    // Content characteristics
    this.typicalContentLength = data.typicalContentLength || 0;
    this.contentCategories = data.contentCategories || [];
    this.supportedLanguages = data.supportedLanguages || ['en'];
    
    // Metadata
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }
  
  /**
   * Normalize source name
   */
  normalizeName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
  
  /**
   * Convert to database format
   */
  toDatabaseFormat() {
    return {
      name: this.name,
      outlet_name: this.name, // Use name as outlet_name
      source_type: this.sourceType || 'news', // Add source_type at top level
      language: this.language || 'en', // Add language at top level
      normalized_name: this.normalizedName,
      website: this.website,
      country_of_origin: this.countryOfOrigin,
      bias_score: this.biasScore,
      reliability_score: this.reliabilityScore,
      bias_source: this.biasSource,
      last_bias_update: this.lastBiasUpdate,
      metadata: {
        sourceType: this.sourceType,
        language: this.language,
        region: this.region,
        historicalAccuracy: this.historicalAccuracy,
        speedVsAccuracy: this.speedVsAccuracy,
        updateFrequency: this.updateFrequency,
        geographicExpertise: this.geographicExpertise,
        conflictExpertise: this.conflictExpertise,
        rssUrl: this.rssUrl,
        apiEndpoint: this.apiEndpoint,
        accessMethod: this.accessMethod,
        rateLimit: this.rateLimit,
        lastAccessed: this.lastAccessed,
        accessCountToday: this.accessCountToday,
        isActive: this.isActive,
        lastSuccessfulFetch: this.lastSuccessfulFetch,
        consecutiveFailures: this.consecutiveFailures,
        healthScore: this.healthScore,
        typicalContentLength: this.typicalContentLength,
        contentCategories: this.contentCategories,
        supportedLanguages: this.supportedLanguages
      },
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString()
    
    };
  }
  
  /**
   * Create from database row
   */
  static fromDatabase(row) {
    const metadata = row.metadata || {};
    
    return new Source({
      id: row.id,
      name: row.name,
      normalizedName: row.normalized_name,
      website: row.website,
      countryOfOrigin: row.country_of_origin,
      biasScore: row.bias_score,
      reliabilityScore: row.reliability_score,
      biasSource: row.bias_source,
      lastBiasUpdate: row.last_bias_update ? new Date(row.last_bias_update) : null,
      sourceType: metadata.sourceType,
      language: metadata.language,
      region: metadata.region,
      historicalAccuracy: metadata.historicalAccuracy,
      speedVsAccuracy: metadata.speedVsAccuracy,
      updateFrequency: metadata.updateFrequency,
      geographicExpertise: metadata.geographicExpertise || {},
      conflictExpertise: metadata.conflictExpertise,
      rssUrl: metadata.rssUrl,
      apiEndpoint: metadata.apiEndpoint,
      accessMethod: metadata.accessMethod,
      rateLimit: metadata.rateLimit,
      lastAccessed: metadata.lastAccessed ? new Date(metadata.lastAccessed) : null,
      accessCountToday: metadata.accessCountToday || 0,
      isActive: metadata.isActive !== undefined ? metadata.isActive : true,
      lastSuccessfulFetch: metadata.lastSuccessfulFetch ? new Date(metadata.lastSuccessfulFetch) : null,
      consecutiveFailures: metadata.consecutiveFailures || 0,
      healthScore: metadata.healthScore || 1.0,
      typicalContentLength: metadata.typicalContentLength,
      contentCategories: metadata.contentCategories || [],
      supportedLanguages: metadata.supportedLanguages || ['en'],
      metadata: metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
  
  /**
   * Check if source should be fetched
   */
  shouldFetch() {
    // Check if source is healthy
    if (!this.isActive || this.consecutiveFailures > 5) {
      return false;
    }
    
    // Check rate limits
    if (this.rateLimit && this.accessCountToday >= this.rateLimit) {
      return false;
    }
    
    // Check last access time (minimum 1 hour between fetches)
    if (this.lastAccessed) {
      const timeSinceLastAccess = Date.now() - this.lastAccessed.getTime();
      if (timeSinceLastAccess < 60 * 60 * 1000) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Update reliability score based on accuracy
   */
  updateReliability(accurate) {
    const adjustment = accurate ? 0.02 : -0.05;
    this.reliabilityScore = Math.max(0, Math.min(100, this.reliabilityScore + adjustment));
    this.historicalAccuracy = (this.historicalAccuracy * 0.95) + (accurate ? 0.05 : 0);
    this.updatedAt = new Date();
  }
  
  /**
   * Update access metrics
   */
  updateAccessMetrics(success) {
    this.lastAccessed = new Date();
    this.accessCountToday++;
    
    if (success) {
      this.consecutiveFailures = 0;
      this.lastSuccessfulFetch = new Date();
      this.healthScore = Math.min(1.0, this.healthScore + 0.1);
    } else {
      this.consecutiveFailures++;
      this.healthScore = Math.max(0.0, this.healthScore - 0.2);
      
      // Deactivate source after too many failures
      if (this.consecutiveFailures > 10) {
        this.isActive = false;
      }
    }
    
    this.updatedAt = new Date();
  }
  
  /**
   * Get expertise score for a specific region
   */
  getRegionalExpertise(region) {
    return this.geographicExpertise[region] || 0.3;
  }
  
  /**
   * Calculate overall trustworthiness score
   */
  getTrustworthiness() {
    const weights = {
      reliability: 0.4,
      accuracy: 0.3,
      health: 0.2,
      bias: 0.1
    };
    
    // Normalize bias score (0 = most biased, 1 = least biased)
    const normalizedBias = 1 - Math.abs(this.biasScore);
    
    const score = (
      (this.reliabilityScore / 100) * weights.reliability +
      this.historicalAccuracy * weights.accuracy +
      this.healthScore * weights.health +
      normalizedBias * weights.bias
    );
    
    return Math.round(score * 100) / 100;
  }
  
  /**
   * Reset daily counters
   */
  resetDailyCounters() {
    this.accessCountToday = 0;
    this.updatedAt = new Date();
  }
}

/**
 * Predefined source configurations
 */
export const BASELINE_SOURCES = {
  institutional: [
    {
      name: 'United Nations News',
      normalizedName: 'un_news',
      website: 'https://news.un.org',
      sourceType: 'institutional',
      reliabilityScore: 90,
      biasScore: 0,
      rssUrl: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
      geographicExpertise: { global: 0.9 }
    },
    {
      name: 'NATO News',
      normalizedName: 'nato_news',
      website: 'https://www.nato.int',
      sourceType: 'institutional',
      reliabilityScore: 85,
      biasScore: 0.3,
      rssUrl: 'https://www.nato.int/cps/en/natohq/rss.xml',
      geographicExpertise: { europe: 0.9, 'north-america': 0.8 }
    },
    {
      name: 'OCHA ReliefWeb',
      normalizedName: 'reliefweb',
      website: 'https://reliefweb.int',
      sourceType: 'institutional',
      reliabilityScore: 85,
      biasScore: 0,
      apiEndpoint: 'https://api.reliefweb.int/v1/reports',
      accessMethod: 'api',
      geographicExpertise: { global: 0.8 }
    }
  ],
  
  conflictTrackers: [
    {
      name: 'ACLED',
      normalizedName: 'acled',
      website: 'https://acleddata.com',
      sourceType: 'institutional',
      reliabilityScore: 95,
      biasScore: 0,
      accessMethod: 'api',
      geographicExpertise: { global: 0.95 },
      conflictExpertise: 1.0
    },
    {
      name: 'Uppsala Conflict Data Program',
      normalizedName: 'ucdp',
      website: 'https://ucdp.uu.se',
      sourceType: 'institutional',
      reliabilityScore: 95,
      biasScore: 0,
      accessMethod: 'api',
      geographicExpertise: { global: 0.95 },
      conflictExpertise: 1.0
    },
    {
      name: 'CFR Global Conflict Tracker',
      normalizedName: 'cfr_tracker',
      website: 'https://cfr.org/global-conflict-tracker',
      sourceType: 'institutional',
      reliabilityScore: 85,
      biasScore: 0.1,
      accessMethod: 'scrape',
      geographicExpertise: { global: 0.8 },
      conflictExpertise: 0.9
    }
  ],
  
  news: [
    {
      name: 'Reuters',
      normalizedName: 'reuters',
      website: 'https://www.reuters.com',
      sourceType: 'news',
      reliabilityScore: 85,
      biasScore: 0,
      rssUrl: 'https://www.reutersagency.com/feed/',
      geographicExpertise: { global: 0.8 }
    },
    {
      name: 'Associated Press',
      normalizedName: 'ap',
      website: 'https://apnews.com',
      sourceType: 'news',
      reliabilityScore: 85,
      biasScore: 0,
      rssUrl: 'https://rsshub.app/apnews/topics/apf-topnews',
      geographicExpertise: { global: 0.8 }
    },
    {
      name: 'BBC News',
      normalizedName: 'bbc',
      website: 'https://www.bbc.com',
      sourceType: 'news',
      reliabilityScore: 80,
      biasScore: -0.1,
      rssUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml',
      geographicExpertise: { global: 0.7, europe: 0.9 }
    },
    {
      name: 'Al Jazeera',
      normalizedName: 'aljazeera',
      website: 'https://www.aljazeera.com',
      sourceType: 'news',
      reliabilityScore: 75,
      biasScore: -0.2,
      rssUrl: 'https://www.aljazeera.com/xml/rss/all.xml',
      geographicExpertise: { 'middle-east': 0.9, global: 0.6 }
    }
  ]
};

export default Source;