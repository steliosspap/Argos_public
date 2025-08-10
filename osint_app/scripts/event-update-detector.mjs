/**
 * Event Update Detector
 * Identifies when new articles are updates to existing events
 * Uses similarity scoring and temporal proximity
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Configuration
const SIMILARITY_THRESHOLD = 0.7; // 70% similarity to consider an update
const TIME_WINDOW_HOURS = 72; // Look for events within 72 hours
const LOCATION_PROXIMITY_KM = 100; // Events within 100km could be related

class EventUpdateDetector {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Calculate Jaccard similarity between two text strings
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate distance between two coordinates in km
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Generate event signature for comparison
   */
  generateEventSignature(event) {
    // Key elements that identify an event
    const elements = [
      event.country?.toLowerCase(),
      event.city?.toLowerCase(),
      event.event_classifier?.join(','),
      // Extract key numbers (casualties, dates, etc)
      (event.summary.match(/\d+/g) || []).join(',')
    ].filter(Boolean);
    
    return elements.join('|');
  }

  /**
   * Find existing events that might be related
   */
  async findRelatedEvents(newEvent) {
    const startTime = new Date(newEvent.timestamp);
    startTime.setHours(startTime.getHours() - TIME_WINDOW_HOURS);
    
    // Query recent events from the same country
    const { data: recentEvents, error } = await supabase
      .from('events')
      .select('*')
      .eq('country', newEvent.country)
      .gte('timestamp', startTime.toISOString())
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('Error fetching recent events:', error);
      return [];
    }
    
    const related = [];
    
    for (const existingEvent of recentEvents) {
      const similarity = this.calculateEventSimilarity(newEvent, existingEvent);
      
      if (similarity.score >= SIMILARITY_THRESHOLD) {
        related.push({
          event: existingEvent,
          similarity: similarity.score,
          reasons: similarity.reasons
        });
      }
    }
    
    // Sort by similarity score
    return related.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Calculate comprehensive similarity between two events
   */
  calculateEventSimilarity(event1, event2) {
    const reasons = [];
    let totalScore = 0;
    let weights = 0;
    
    // Title similarity (weight: 0.3)
    const titleSim = this.calculateTextSimilarity(event1.title, event2.title);
    totalScore += titleSim * 0.3;
    weights += 0.3;
    if (titleSim > 0.5) reasons.push(`Title similarity: ${(titleSim * 100).toFixed(0)}%`);
    
    // Summary similarity (weight: 0.3)
    const summarySim = this.calculateTextSimilarity(event1.summary, event2.summary);
    totalScore += summarySim * 0.3;
    weights += 0.3;
    if (summarySim > 0.5) reasons.push(`Summary similarity: ${(summarySim * 100).toFixed(0)}%`);
    
    // Location proximity (weight: 0.2)
    if (event1.latitude && event1.longitude && event2.latitude && event2.longitude) {
      const distance = this.calculateDistance(
        event1.latitude, event1.longitude,
        event2.latitude, event2.longitude
      );
      const locationScore = Math.max(0, 1 - (distance / LOCATION_PROXIMITY_KM));
      totalScore += locationScore * 0.2;
      weights += 0.2;
      if (distance < LOCATION_PROXIMITY_KM) {
        reasons.push(`Location proximity: ${distance.toFixed(0)}km`);
      }
    } else if (event1.city === event2.city) {
      totalScore += 0.2;
      weights += 0.2;
      reasons.push('Same city');
    }
    
    // Event type similarity (weight: 0.1)
    if (event1.event_classifier && event2.event_classifier) {
      const tags1 = new Set(event1.event_classifier);
      const tags2 = new Set(event2.event_classifier);
      const commonTags = [...tags1].filter(tag => tags2.has(tag));
      if (commonTags.length > 0) {
        const tagScore = commonTags.length / Math.max(tags1.size, tags2.size);
        totalScore += tagScore * 0.1;
        weights += 0.1;
        reasons.push(`Common tags: ${commonTags.join(', ')}`);
      }
    }
    
    // Signature similarity (weight: 0.1)
    const sig1 = this.generateEventSignature(event1);
    const sig2 = this.generateEventSignature(event2);
    if (sig1 === sig2) {
      totalScore += 0.1;
      weights += 0.1;
      reasons.push('Matching event signature');
    }
    
    return {
      score: weights > 0 ? totalScore / weights : 0,
      reasons
    };
  }

  /**
   * Merge information from new event into existing event
   */
  async mergeEventUpdate(existingEvent, newEvent) {
    // Combine summaries if they contain different information
    let updatedSummary = existingEvent.summary;
    if (this.calculateTextSimilarity(existingEvent.summary, newEvent.summary) < 0.9) {
      updatedSummary = `${existingEvent.summary}\n\nUpdate (${new Date(newEvent.timestamp).toLocaleString()}): ${newEvent.summary}`;
    }
    
    // Update escalation score if higher
    const updatedEscalation = Math.max(
      existingEvent.escalation_score || 5,
      newEvent.escalation_score || 5
    );
    
    // Merge event classifiers
    const mergedTags = [...new Set([
      ...(existingEvent.event_classifier || []),
      ...(newEvent.event_classifier || [])
    ])];
    
    // Update the existing event
    const { data, error } = await supabase
      .from('events')
      .update({
        summary: updatedSummary,
        escalation_score: updatedEscalation,
        event_classifier: mergedTags,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingEvent.id);
    
    if (error) {
      console.error('Error updating event:', error);
      return false;
    }
    
    console.log(`✅ Merged update into event ${existingEvent.id}: "${existingEvent.title}"`);
    return true;
  }

  /**
   * Process a new event and check if it's an update
   */
  async processEvent(newEvent) {
    // Find potentially related events
    const relatedEvents = await this.findRelatedEvents(newEvent);
    
    if (relatedEvents.length === 0) {
      // No related events found, this is a new event
      return { isUpdate: false };
    }
    
    // Take the most similar event
    const bestMatch = relatedEvents[0];
    
    console.log(`\n🔍 Potential update detected:`);
    console.log(`New: "${newEvent.title}"`);
    console.log(`Existing: "${bestMatch.event.title}"`);
    console.log(`Similarity: ${(bestMatch.similarity * 100).toFixed(0)}%`);
    console.log(`Reasons: ${bestMatch.reasons.join(', ')}`);
    
    return {
      isUpdate: true,
      existingEvent: bestMatch.event,
      similarity: bestMatch.similarity,
      reasons: bestMatch.reasons
    };
  }
}

export default EventUpdateDetector;

// CLI interface for testing
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  const detector = new EventUpdateDetector();
  
  async function testDetector() {
    // Example events for testing
    const existingEvent = {
      id: '123',
      title: 'Airstrike hits residential area in Gaza City',
      summary: 'Israeli airstrike targeted a residential building in Gaza City, causing multiple casualties.',
      country: 'Palestine',
      city: 'Gaza City',
      latitude: 31.5, 
      longitude: 34.46,
      timestamp: new Date().toISOString(),
      event_classifier: ['military', 'airstrike'],
      escalation_score: 8
    };
    
    const newEvent = {
      title: 'Death toll rises from Gaza City airstrike',
      summary: 'The death toll from yesterday\'s Israeli airstrike on a residential area in Gaza City has risen to 15.',
      country: 'Palestine',
      city: 'Gaza City',
      latitude: 31.5,
      longitude: 34.46,
      timestamp: new Date().toISOString(),
      event_classifier: ['military', 'airstrike', 'casualties'],
      escalation_score: 9
    };
    
    const similarity = detector.calculateEventSimilarity(existingEvent, newEvent);
    console.log('Similarity:', similarity);
  }
  
  testDetector().catch(console.error);
}