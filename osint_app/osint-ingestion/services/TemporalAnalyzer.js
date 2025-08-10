/**
 * Temporal Analyzer Service
 * Extracts and analyzes temporal information with confidence intervals
 */

import { OpenAI } from 'openai';
import { config } from '../core/config.js';

export class TemporalAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.apis.openai.apiKey
    });
    
    // Temporal precision levels
    this.precisionLevels = {
      EXACT: 'exact',        // Specific date and time
      DAY: 'day',           // Specific day
      WEEK: 'week',         // Week precision
      MONTH: 'month',       // Month precision
      YEAR: 'year',         // Year only
      RELATIVE: 'relative', // "yesterday", "last week"
      UNCERTAIN: 'uncertain' // Vague references
    };
    
    // Relative time mappings
    this.relativeTimeMap = {
      'today': 0,
      'yesterday': -1,
      'tomorrow': 1,
      'this week': 0,
      'last week': -7,
      'next week': 7,
      'this month': 0,
      'last month': -30,
      'recently': -7,
      'soon': 7
    };
  }
  
  /**
   * Analyze temporal information in article
   */
  async analyze(article) {
    try {
      const text = `${article.title} ${article.snippet}`;
      const publishDate = new Date(article.publishedDate);
      
      // Extract temporal expressions using AI
      const temporalData = await this.extractTemporalExpressions(text, publishDate);
      
      // Calculate confidence intervals
      const intervals = this.calculateConfidenceIntervals(temporalData, publishDate);
      
      // Determine primary timestamp
      const primaryTimestamp = this.determinePrimaryTimestamp(temporalData, publishDate);
      
      return {
        timestamp: primaryTimestamp.timestamp,
        precision: primaryTimestamp.precision,
        confidence: primaryTimestamp.confidence,
        earliestPossible: intervals.earliest,
        latestPossible: intervals.latest,
        expressions: temporalData,
        publishDate: publishDate
      };
      
    } catch (error) {
      console.error('Temporal analysis error:', error);
      return this.getDefaultTemporal(article.publishedDate);
    }
  }
  
  /**
   * Extract temporal expressions using AI
   */
  async extractTemporalExpressions(text, referenceDate) {
    const prompt = `Extract all temporal expressions from this conflict news text.

Text: "${text}"
Reference date (article publish date): ${referenceDate.toISOString()}

For each temporal expression found, determine:
1. The exact text of the expression
2. The referenced date/time (as ISO string)
3. The precision level (exact, day, week, month, year, relative, uncertain)
4. Confidence score (0.0-1.0)

Return JSON: {
  "expressions": [
    {
      "text": "yesterday",
      "referencedDate": "2025-07-19T00:00:00Z",
      "precision": "day",
      "confidence": 0.9,
      "isEventTime": true
    }
  ]
}

Focus on when events actually occurred, not when they were reported.`;

    const response = await this.openai.chat.completions.create({
      model: config.apis.openai.model,
      messages: [
        {
          role: 'system',
          content: 'You are a temporal expression analyzer. Extract and interpret time references accurately.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    return result.expressions || [];
  }
  
  /**
   * Calculate confidence intervals for temporal data
   */
  calculateConfidenceIntervals(expressions, publishDate) {
    if (expressions.length === 0) {
      return {
        earliest: new Date(publishDate.getTime() - 72 * 60 * 60 * 1000), // 72 hours before
        latest: publishDate
      };
    }
    
    // Find the most confident event time
    const eventTimes = expressions.filter(e => e.isEventTime);
    if (eventTimes.length === 0) {
      return this.getDefaultInterval(publishDate);
    }
    
    // Sort by confidence
    eventTimes.sort((a, b) => b.confidence - a.confidence);
    const primary = eventTimes[0];
    
    // Calculate interval based on precision
    const baseTime = new Date(primary.referencedDate);
    const intervals = {
      'exact': { before: 0, after: 0 },
      'day': { before: 0, after: 24 * 60 * 60 * 1000 },
      'week': { before: 3 * 24 * 60 * 60 * 1000, after: 3 * 24 * 60 * 60 * 1000 },
      'month': { before: 15 * 24 * 60 * 60 * 1000, after: 15 * 24 * 60 * 60 * 1000 },
      'year': { before: 182 * 24 * 60 * 60 * 1000, after: 182 * 24 * 60 * 60 * 1000 },
      'relative': { before: 24 * 60 * 60 * 1000, after: 24 * 60 * 60 * 1000 },
      'uncertain': { before: 72 * 60 * 60 * 1000, after: 24 * 60 * 60 * 1000 }
    };
    
    const interval = intervals[primary.precision] || intervals.uncertain;
    
    return {
      earliest: new Date(baseTime.getTime() - interval.before),
      latest: new Date(baseTime.getTime() + interval.after)
    };
  }
  
  /**
   * Determine primary timestamp from expressions
   */
  determinePrimaryTimestamp(expressions, publishDate) {
    if (expressions.length === 0) {
      return {
        timestamp: publishDate,
        precision: this.precisionLevels.UNCERTAIN,
        confidence: 0.3
      };
    }
    
    // Find event times (not report times)
    const eventTimes = expressions.filter(e => e.isEventTime);
    
    if (eventTimes.length === 0) {
      // Use most confident expression
      const best = expressions.reduce((prev, curr) => 
        curr.confidence > prev.confidence ? curr : prev
      );
      
      return {
        timestamp: new Date(best.referencedDate),
        precision: best.precision,
        confidence: best.confidence * 0.8 // Reduce confidence if not explicitly event time
      };
    }
    
    // Use most confident event time
    const primary = eventTimes.reduce((prev, curr) => 
      curr.confidence > prev.confidence ? curr : prev
    );
    
    return {
      timestamp: new Date(primary.referencedDate),
      precision: primary.precision,
      confidence: primary.confidence
    };
  }
  
  /**
   * Parse relative time expressions
   */
  parseRelativeTime(expression, referenceDate) {
    const normalizedExpr = expression.toLowerCase().trim();
    
    // Check direct mappings
    if (this.relativeTimeMap[normalizedExpr] !== undefined) {
      const daysOffset = this.relativeTimeMap[normalizedExpr];
      const resultDate = new Date(referenceDate);
      resultDate.setDate(resultDate.getDate() + daysOffset);
      return {
        date: resultDate,
        precision: Math.abs(daysOffset) <= 1 ? 'day' : 'week',
        confidence: 0.8
      };
    }
    
    // Parse "X days ago" pattern
    const daysAgoMatch = normalizedExpr.match(/(\d+)\s*days?\s*ago/);
    if (daysAgoMatch) {
      const days = parseInt(daysAgoMatch[1]);
      const resultDate = new Date(referenceDate);
      resultDate.setDate(resultDate.getDate() - days);
      return {
        date: resultDate,
        precision: 'day',
        confidence: 0.9
      };
    }
    
    // Parse "last X" pattern
    const lastMatch = normalizedExpr.match(/last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (lastMatch) {
      return {
        date: this.getLastWeekday(lastMatch[1], referenceDate),
        precision: 'day',
        confidence: 0.85
      };
    }
    
    return null;
  }
  
  /**
   * Get last occurrence of a weekday
   */
  getLastWeekday(weekdayName, referenceDate) {
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = weekdays.indexOf(weekdayName.toLowerCase());
    const currentDay = referenceDate.getDay();
    
    let daysAgo = currentDay - targetDay;
    if (daysAgo <= 0) daysAgo += 7;
    
    const resultDate = new Date(referenceDate);
    resultDate.setDate(resultDate.getDate() - daysAgo);
    return resultDate;
  }
  
  /**
   * Get default temporal data
   */
  getDefaultTemporal(publishDate) {
    return {
      timestamp: publishDate,
      precision: this.precisionLevels.UNCERTAIN,
      confidence: 0.3,
      earliestPossible: new Date(publishDate.getTime() - 72 * 60 * 60 * 1000),
      latestPossible: publishDate,
      expressions: [],
      publishDate: publishDate
    };
  }
  
  /**
   * Get default interval
   */
  getDefaultInterval(publishDate) {
    return {
      earliest: new Date(publishDate.getTime() - 72 * 60 * 60 * 1000), // 72 hours before
      latest: publishDate
    };
  }
  
  /**
   * Compare temporal expressions for consistency
   */
  compareTemporalConsistency(expressions) {
    if (expressions.length < 2) return 1.0;
    
    const eventTimes = expressions
      .filter(e => e.isEventTime)
      .map(e => new Date(e.referencedDate).getTime());
    
    if (eventTimes.length < 2) return 1.0;
    
    // Calculate standard deviation
    const mean = eventTimes.reduce((a, b) => a + b) / eventTimes.length;
    const variance = eventTimes.reduce((sum, time) => 
      sum + Math.pow(time - mean, 2), 0
    ) / eventTimes.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to hours
    const stdDevHours = stdDev / (1000 * 60 * 60);
    
    // High consistency if events are within 24 hours
    if (stdDevHours < 24) return 0.9;
    if (stdDevHours < 48) return 0.7;
    if (stdDevHours < 72) return 0.5;
    return 0.3;
  }
}