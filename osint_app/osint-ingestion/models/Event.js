/**
 * Event Model
 * Represents conflict events extracted from news sources
 */

import crypto from 'crypto';

export class ConflictEvent {
  constructor(data = {}) {
    // Core identifiers
    this.id = data.id || crypto.randomUUID();
    this.articleId = data.articleId || null;
    this.externalId = data.externalId || null;
    
    // Event content
    this.channel = data.channel || 'news';
    this.title = data.title || '';
    this.summary = data.summary || '';
    this.enhancedHeadline = data.enhancedHeadline || data.title;
    
    // Temporal data
    this.timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    this.temporalExpression = data.temporalExpression || null;
    this.timestampConfidence = data.timestampConfidence || 0.5;
    this.confidenceInterval = data.confidenceInterval || null;
    
    // Geographic data
    this._location = data.location || null; // GEOGRAPHY type
    // Initial coordinate extraction if location is provided
    if (data.location) {
      this._extractCoordinatesFromWKT(data.location);
    } else {
      this.latitude = data.latitude || null;
      this.longitude = data.longitude || null;
    }
    this.locationName = data.locationName || '';
    this.country = data.country || '';
    this.region = data.region || '';
    this.adminLevel1 = data.adminLevel1 || null;
    this.adminLevel2 = data.adminLevel2 || null;
    
    // Event classification
    this.eventCategory = data.eventCategory || 'conflict';
    this.eventSubcategory = data.eventSubcategory || null;
    this.eventType = data.eventType || 'unknown';
    this.conflictType = data.conflictType || null;
    
    // Actors and participants
    this.participants = data.participants || [];
    this.primaryActors = data.primaryActors || [];
    this.secondaryActors = data.secondaryActors || [];
    
    // Impact data
    this.casualties = {
      killed: data.casualties?.killed || null,
      wounded: data.casualties?.wounded || null,
      missing: data.casualties?.missing || null,
      total: data.casualties?.total || null
    };
    this.infrastructureDamage = data.infrastructureDamage || [];
    
    // Verification and reliability
    this.reliability = data.reliability || 0.5;
    this.verificationStatus = data.verificationStatus || 'unverified';
    this.sentimentScore = data.sentimentScore || 0;
    this.extractionConfidence = data.extractionConfidence || 0.5;
    this.severity = data.severity || 'medium';
    this.escalationScore = data.escalationScore || 5;
    
    // Attribution
    this.attributionSource = data.attributionSource || null;
    this.attributionText = data.attributionText || null;
    this.source = data.source || null;
    this.sourceType = data.sourceType || 'news';
    
    // Metadata
    this.tags = data.tags || [];
    this.binaryFlags = data.binaryFlags || 0;
    this.processingVersion = data.processingVersion || '1.0';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    
    // Relationships
    this.relatedEvents = data.relatedEvents || [];
    this.parentConflict = data.parentConflict || null;
    this.eventGroupId = data.eventGroupId || null;
    
    // Vector embedding for similarity search
    this.embedding = data.embedding || null;
    
    // Translation metadata
    this.translated = data.translated || false;
    this.originalLanguage = data.originalLanguage || null;
    
    // Phase 2: Intelligence metadata
    this.bias = data.bias || {
      sourceBias: null,
      contentBiasScore: null,
      politicalAlignment: null,
      confidence: null
    };
    
    this.entityLinks = data.entityLinks || [];  // Array of { entity: string, qid: string, confidence: number }
    
    this.timelineSummary = data.timelineSummary || null;
    
    // Enhanced analytics metadata
    this.sentimentTrend = data.sentimentTrend || null;  // positive/negative/neutral trend
    this.impactScore = data.impactScore || null;  // 0-100 impact assessment
    this.verificationSources = data.verificationSources || [];  // Array of corroborating sources
  }
  
  /**
   * Convert to database format
   */
  /**
   * Getter for location
   */
  get location() {
    return this._location;
  }

  /**
   * Setter for location - extracts coordinates when location is set
   */
  set location(value) {
    this._location = value;
    if (value) {
      this._extractCoordinatesFromWKT(value);
    }
  }

  /**
   * Extract coordinates from WKT format
   */
  _extractCoordinatesFromWKT(wkt) {
    if (typeof wkt === 'string' && wkt.startsWith('POINT(')) {
      const match = wkt.match(/POINT\(([\d.-]+) ([\d.-]+)\)/);
      if (match) {
        this.longitude = parseFloat(match[1]);
        this.latitude = parseFloat(match[2]);
        console.log(`Event "${this.title}" - Extracted coordinates from WKT: lat=${this.latitude}, lng=${this.longitude}`);
      } else {
        console.log(`Event "${this.title}" - Failed to extract coordinates from WKT: ${wkt}`);
      }
    } else if (wkt) {
      console.log(`Event "${this.title}" - Location is not WKT format: ${wkt}`);
    }
  }

  toDatabaseFormat() {
    // Ensure timestamp is a valid Date object
    const timestamp = this.timestamp instanceof Date ? this.timestamp : new Date(this.timestamp);
    
    return {
      id: this.id,
      article_id: this.articleId,
      title: this.title,
      channel: this.channel || 'news',
      summary: this.summary,
      enhanced_headline: this.enhancedHeadline,
      timestamp: timestamp.toISOString(),
      temporal_expression: this.temporalExpression,
      confidence_interval: this.confidenceInterval,
      location: this._location, // PostGIS GEOGRAPHY
      // Use the extracted coordinates from constructor
      latitude: this.latitude,
      longitude: this.longitude,
      location_name: this.locationName,
      country: this.country,
      region: this.region,
      admin_level_1: this.adminLevel1,
      admin_level_2: this.adminLevel2,
      event_category: this.eventCategory,
      event_subcategory: this.eventSubcategory,
      event_type: this.eventType,
      participants: this.participants,
      casualties: this.casualties,
      reliability: Math.round((this.reliability || 0.8) * 10), // Convert 0-1 to 0-10 integer
      sentiment_score: this.sentimentScore,
      extraction_confidence: this.extractionConfidence,
      severity: this.severity,
      escalation_score: this.escalationScore,
      attribution_source: this.attributionSource,
      attribution_text: this.attributionText,
      source: this.source,
      source_type: this.sourceType,
      tags: this.tags,
      binary_flags: this.binaryFlags,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
      embedding: this.embedding,
      translated: this.translated,
      original_language: this.originalLanguage,
      bias: this.bias,
      entity_links: this.entityLinks,
      timeline_summary: this.timelineSummary,
      sentiment_trend: this.sentimentTrend,
      impact_score: this.impactScore,
      verification_sources: this.verificationSources
    };
  }
  
  /**
   * Create from database row
   */
  static fromDatabase(row) {
    return new ConflictEvent({
      id: row.id,
      articleId: row.article_id,
      title: row.title,
      summary: row.summary,
      enhancedHeadline: row.enhanced_headline,
      timestamp: new Date(row.timestamp),
      temporalExpression: row.temporal_expression,
      timestampConfidence: row.confidence_interval?.confidence || 0.5,
      confidenceInterval: row.confidence_interval,
      location: row.location,
      locationName: row.location_name,
      country: row.country,
      region: row.region,
      adminLevel1: row.admin_level_1,
      adminLevel2: row.admin_level_2,
      eventCategory: row.event_category,
      eventSubcategory: row.event_subcategory,
      eventType: row.event_type,
      participants: row.participants || [],
      casualties: row.casualties || {},
      reliability: row.reliability,
      sentimentScore: row.sentiment_score,
      extractionConfidence: row.extraction_confidence,
      severity: row.severity,
      escalationScore: row.escalation_score,
      attributionSource: row.attribution_source,
      attributionText: row.attribution_text,
      source: row.source,
      sourceType: row.source_type,
      tags: row.tags || [],
      binaryFlags: row.binary_flags,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
  
  /**
   * Calculate event similarity score
   */
  calculateSimilarity(otherEvent) {
    let score = 0;
    let weights = 0;
    
    // Temporal similarity (weight: 0.3)
    if (this.timestamp && otherEvent.timestamp) {
      const timeDiff = Math.abs(this.timestamp - otherEvent.timestamp) / (1000 * 60 * 60); // hours
      const temporalScore = Math.max(0, 1 - (timeDiff / 24)); // 24-hour window
      score += temporalScore * 0.3;
      weights += 0.3;
    }
    
    // Geographic similarity (weight: 0.4)
    if (this.locationName && otherEvent.locationName) {
      const locationScore = this.calculateStringSimilarity(
        this.locationName.toLowerCase(),
        otherEvent.locationName.toLowerCase()
      );
      score += locationScore * 0.4;
      weights += 0.4;
    }
    
    // Actor similarity (weight: 0.2)
    if (this.participants.length > 0 && otherEvent.participants.length > 0) {
      const actorOverlap = this.calculateArrayOverlap(this.participants, otherEvent.participants);
      score += actorOverlap * 0.2;
      weights += 0.2;
    }
    
    // Event type similarity (weight: 0.1)
    if (this.eventType === otherEvent.eventType) {
      score += 0.1;
      weights += 0.1;
    }
    
    return weights > 0 ? score / weights : 0;
  }
  
  /**
   * Calculate string similarity using Jaccard index
   */
  calculateStringSimilarity(str1, str2) {
    const set1 = new Set(str1.split(/\s+/));
    const set2 = new Set(str2.split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  /**
   * Calculate array overlap
   */
  calculateArrayOverlap(arr1, arr2) {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  /**
   * Merge with another event
   */
  mergeWith(otherEvent) {
    // Update reliability based on corroboration
    this.reliability = Math.min(1.0, (this.reliability + otherEvent.reliability) / 1.5);
    
    // Merge participants
    this.participants = [...new Set([...this.participants, ...otherEvent.participants])];
    this.primaryActors = [...new Set([...this.primaryActors, ...otherEvent.primaryActors])];
    
    // Update casualties (take maximum)
    if (otherEvent.casualties.killed > this.casualties.killed) {
      this.casualties.killed = otherEvent.casualties.killed;
    }
    if (otherEvent.casualties.wounded > this.casualties.wounded) {
      this.casualties.wounded = otherEvent.casualties.wounded;
    }
    
    // Update confidence
    this.extractionConfidence = Math.max(this.extractionConfidence, otherEvent.extractionConfidence);
    
    // Add related event
    this.relatedEvents.push(otherEvent.id);
    
    this.updatedAt = new Date();
  }
  
  /**
   * Check if event is breaking news
   */
  isBreaking() {
    const hoursSinceEvent = (new Date() - this.timestamp) / (1000 * 60 * 60);
    return hoursSinceEvent < 2 && this.severity !== 'low';
  }
  
  /**
   * Check if event requires alert
   */
  requiresAlert() {
    return this.escalationScore >= 7 || 
           this.severity === 'critical' ||
           (this.casualties.killed && this.casualties.killed > 10);
  }
  
  /**
   * Generate event fingerprint for deduplication
   */
  generateFingerprint() {
    const components = [
      this.eventType,
      this.locationName?.toLowerCase(),
      this.timestamp?.toISOString().split('T')[0], // Date only
      this.primaryActors.sort().join(',')
    ].filter(Boolean);
    
    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex')
      .substring(0, 16);
  }
}

export default ConflictEvent;