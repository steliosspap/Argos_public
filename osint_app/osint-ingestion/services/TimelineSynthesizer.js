/**
 * Timeline Synthesis Module
 * Generates human-readable timelines from clustered events
 * Uses LLM to create coherent narratives from event sequences
 */

import { OpenAI } from 'openai';
import { config } from '../core/config.js';
import { createClient } from '@supabase/supabase-js';

export class TimelineSynthesizer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.apis.openai.apiKey
    });
    
    // Initialize Supabase client
    this.supabase = createClient(
      config.database.supabase.url,
      config.database.supabase.serviceKey
    );
    
    // Timeline generation parameters
    this.maxEventsPerTimeline = 20;
    this.minEventsForTimeline = 3;
    
    // Summary styles - STRICTLY FACTUAL
    this.summaryStyles = {
      'executive': 'Concise factual summary listing only verified events and reported outcomes',
      'chronological': 'Strictly chronological listing of events as reported by sources',
      'analytical': 'Factual summary of reported events with source attribution',
      'humanitarian': 'Factual reporting of civilian impact as documented by sources'
    };
  }
  
  /**
   * Generate timeline from a cluster of events
   */
  async generateTimeline(events, style = 'chronological') {
    try {
      // Validate input
      if (!events || events.length < this.minEventsForTimeline) {
        console.log(`Insufficient events for timeline: ${events?.length || 0} events`);
        return null;
      }
      
      // Sort events chronologically
      const sortedEvents = this.sortEventsByTime(events);
      
      // Limit events if necessary
      const eventsToProcess = sortedEvents.slice(0, this.maxEventsPerTimeline);
      
      // Extract key information
      const timelineData = this.extractTimelineData(eventsToProcess);
      
      // Generate timeline summary
      const summary = await this.synthesizeTimeline(timelineData, style);
      
      // Extract key points
      const keyPoints = await this.extractKeyPoints(eventsToProcess);
      
      // Save to database
      const savedTimeline = await this.saveTimeline({
        events: eventsToProcess,
        summary: summary,
        keyPoints: keyPoints,
        style: style,
        metadata: {
          eventCount: eventsToProcess.length,
          timeRange: {
            start: eventsToProcess[0].timestamp,
            end: eventsToProcess[eventsToProcess.length - 1].timestamp
          },
          primaryLocation: this.extractPrimaryLocation(eventsToProcess),
          mainActors: this.extractMainActors(eventsToProcess)
        }
      });
      
      return savedTimeline;
    } catch (error) {
      console.error('Timeline generation error:', error);
      throw error;
    }
  }
  
  /**
   * Sort events by timestamp
   */
  sortEventsByTime(events) {
    return events.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at);
      const timeB = new Date(b.timestamp || b.created_at);
      return timeA - timeB;
    });
  }
  
  /**
   * Extract structured timeline data
   */
  extractTimelineData(events) {
    return events.map(event => ({
      id: event.id,
      timestamp: event.timestamp,
      headline: event.enhanced_headline || event.title,
      location: event.location_name || event.country,
      actors: event.primary_actors || event.participants || [],
      casualties: event.casualties,
      severity: event.severity,
      summary: event.summary,
      type: event.event_type,
      entityLinks: event.entity_links || []
    }));
  }
  
  /**
   * Synthesize timeline using LLM
   */
  async synthesizeTimeline(timelineData, style) {
    const styleDescription = this.summaryStyles[style] || this.summaryStyles.chronological;
    
    const prompt = `Create a STRICTLY FACTUAL ${style} timeline summary of the following conflict events. ${styleDescription}

CRITICAL REQUIREMENTS:
- Report ONLY what is explicitly stated in the source material
- Use phrases like "according to [source]", "reportedly", "sources indicate"
- DO NOT add interpretation, analysis, or speculation
- DO NOT imply causation unless explicitly stated by sources
- List events exactly as reported without editorial commentary

Events (in chronological order):
${timelineData.map((event, idx) => `
${idx + 1}. ${new Date(event.timestamp).toISOString().split('T')[0]} - ${event.location}
   Reported: ${event.headline}
   Named parties: ${event.actors.join(', ') || 'Not specified'}
   ${event.casualties?.killed ? `Reported casualties: ${event.casualties.killed} killed` : ''}
   Source summary: ${event.summary || 'No details provided'}
`).join('\n')}

Requirements:
1. List events in chronological order as reported by sources
2. Use attribution phrases: "according to reports", "sources state", "as reported"
3. DO NOT connect events with causal language unless sources explicitly do so
4. Use only factual, neutral language
5. Include uncertainty where it exists: "reportedly", "allegedly", "unconfirmed"
6. Keep the summary under 500 words
7. DO NOT add analysis, interpretation, or editorial commentary

Return a JSON object with:
{
  "summary": "Factual chronological listing of reported events",
  "title": "Chronology of Reported Events in [Location/Conflict]",
  "primaryTheme": "Type of events as categorized by sources",
  "trend": "reported-increase/reported-stable/reported-decrease/insufficient-data",
  "significance": "Summary of what sources report about these events"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: config.apis.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are a factual reporter creating strictly neutral, source-based timeline summaries. You MUST NOT add interpretation, speculation, or analysis. Report ONLY what sources explicitly state. Use attribution phrases like "according to", "reportedly", "sources indicate" throughout.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      
      return {
        narrative: result.summary,
        title: result.title,
        theme: result.primaryTheme,
        trend: result.trend,
        significance: result.significance,
        generatedAt: new Date().toISOString(),
        model: config.apis.openai.model
      };
    } catch (error) {
      console.error('LLM timeline synthesis error:', error);
      // Fallback to simple concatenation
      return this.createFallbackSummary(timelineData);
    }
  }
  
  /**
   * Extract key points from events
   */
  async extractKeyPoints(events) {
    const keyPoints = [];
    
    // Find events with highest severity
    const criticalEvents = events.filter(e => e.severity === 'critical' || e.severity === 'high');
    criticalEvents.forEach(event => {
      keyPoints.push({
        type: 'critical_event',
        timestamp: event.timestamp,
        description: `Reported: ${event.enhanced_headline || event.title}`,
        severity: event.severity,
        source: event.source || 'Unattributed'
      });
    });
    
    // Find events with significant casualties
    const casualtyEvents = events.filter(e => 
      e.casualties?.killed > 10 || e.casualties?.wounded > 50
    );
    casualtyEvents.forEach(event => {
      keyPoints.push({
        type: 'mass_casualty',
        timestamp: event.timestamp,
        description: `Reports indicate ${event.casualties.killed || 0} killed, ${event.casualties.wounded || 0} wounded in ${event.location_name}`,
        impact: event.casualties,
        source: event.source || 'Unattributed'
      });
    });
    
    // Find escalation points
    for (let i = 1; i < events.length; i++) {
      if (events[i].escalation_score > events[i-1].escalation_score + 2) {
        keyPoints.push({
          type: 'escalation_indicator',
          timestamp: events[i].timestamp,
          description: `Escalation indicator based on reported events: ${events[i].enhanced_headline}`,
          escalationChange: events[i].escalation_score - events[i-1].escalation_score,
          source: events[i].source || 'Unattributed'
        });
      }
    }
    
    // Sort key points by timestamp
    keyPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return keyPoints;
  }
  
  /**
   * Create fallback summary without LLM
   */
  createFallbackSummary(timelineData) {
    const firstEvent = timelineData[0];
    const lastEvent = timelineData[timelineData.length - 1];
    
    const totalCasualties = timelineData.reduce((sum, event) => {
      return sum + (event.casualties?.killed || 0);
    }, 0);
    
    const locations = [...new Set(timelineData.map(e => e.location).filter(Boolean))];
    const actors = [...new Set(timelineData.flatMap(e => e.actors).filter(Boolean))];
    
    const narrative = `Chronological listing of ${timelineData.length} reported events from ${new Date(firstEvent.timestamp).toLocaleDateString()} to ${new Date(lastEvent.timestamp).toLocaleDateString()}. ` +
      `Locations mentioned in reports: ${locations.join(', ')}. ` +
      `Named parties in reports: ${actors.join(', ')}. ` +
      `Total casualties reported across all events: ${totalCasualties} killed. ` +
      `Events as reported: ${timelineData.slice(0, 3).map(e => e.headline).join('; ')}.`;
    
    return {
      narrative: narrative,
      title: `Reported Events: ${locations[0] || 'Multiple Locations'}`,
      theme: 'reported_events',
      trend: 'insufficient-data',
      significance: 'Factual listing of reported events - no analysis provided',
      generatedAt: new Date().toISOString(),
      model: 'fallback'
    };
  }
  
  /**
   * Extract primary location from events
   */
  extractPrimaryLocation(events) {
    const locationCounts = {};
    
    events.forEach(event => {
      const location = event.country || event.location_name;
      if (location) {
        locationCounts[location] = (locationCounts[location] || 0) + 1;
      }
    });
    
    // Find most frequent location
    let primaryLocation = null;
    let maxCount = 0;
    
    for (const [location, count] of Object.entries(locationCounts)) {
      if (count > maxCount) {
        maxCount = count;
        primaryLocation = location;
      }
    }
    
    return primaryLocation;
  }
  
  /**
   * Extract main actors from events
   */
  extractMainActors(events) {
    const actorCounts = {};
    
    events.forEach(event => {
      const actors = event.primary_actors || event.participants || [];
      actors.forEach(actor => {
        if (actor) {
          actorCounts[actor] = (actorCounts[actor] || 0) + 1;
        }
      });
    });
    
    // Sort by frequency and return top 5
    return Object.entries(actorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([actor]) => actor);
  }
  
  /**
   * Save timeline to database
   */
  async saveTimeline(timelineData) {
    try {
      const { data, error } = await this.supabase
        .from('timeline_summaries')
        .insert({
          event_ids: timelineData.events.map(e => e.id),
          summary: timelineData.summary.narrative,
          key_points: timelineData.keyPoints,
          model_used: timelineData.summary.model,
          metadata: {
            ...timelineData.metadata,
            style: timelineData.style,
            title: timelineData.summary.title,
            theme: timelineData.summary.theme,
            trend: timelineData.summary.trend,
            significance: timelineData.summary.significance
          }
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error saving timeline:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Failed to save timeline:', error);
      throw error;
    }
  }
  
  /**
   * Generate timeline for a specific cluster
   */
  async generateClusterTimeline(clusterId, style = 'chronological') {
    try {
      // Fetch events for cluster
      const { data: events, error } = await this.supabase
        .from('events')
        .select('*')
        .eq('cluster_id', clusterId)
        .order('timestamp', { ascending: true });
      
      if (error) {
        throw error;
      }
      
      if (!events || events.length < this.minEventsForTimeline) {
        console.log(`Cluster ${clusterId} has insufficient events for timeline`);
        return null;
      }
      
      // Generate timeline
      const timeline = await this.generateTimeline(events, style);
      
      // Update timeline with cluster reference
      if (timeline) {
        await this.supabase
          .from('timeline_summaries')
          .update({ cluster_id: clusterId })
          .eq('id', timeline.id);
      }
      
      return timeline;
    } catch (error) {
      console.error('Cluster timeline generation error:', error);
      throw error;
    }
  }
  
  /**
   * Batch generate timelines for multiple clusters
   */
  async batchGenerateTimelines(clusterIds, style = 'chronological') {
    const results = {
      success: [],
      failed: [],
      skipped: []
    };
    
    for (const clusterId of clusterIds) {
      try {
        const timeline = await this.generateClusterTimeline(clusterId, style);
        
        if (timeline) {
          results.success.push({
            clusterId: clusterId,
            timelineId: timeline.id
          });
        } else {
          results.skipped.push({
            clusterId: clusterId,
            reason: 'Insufficient events'
          });
        }
      } catch (error) {
        results.failed.push({
          clusterId: clusterId,
          error: error.message
        });
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Timeline generation complete: ${results.success.length} success, ${results.failed.length} failed, ${results.skipped.length} skipped`);
    
    return results;
  }
  
  /**
   * Update timeline for a cluster when new events are added
   */
  async updateClusterTimeline(clusterId) {
    try {
      // Check if timeline exists
      const { data: existing } = await this.supabase
        .from('timeline_summaries')
        .select('id, generated_at')
        .eq('cluster_id', clusterId)
        .single();
      
      // Only regenerate if timeline is older than 6 hours
      if (existing) {
        const age = Date.now() - new Date(existing.generated_at).getTime();
        if (age < 6 * 60 * 60 * 1000) {
          console.log(`Timeline for cluster ${clusterId} is recent, skipping update`);
          return existing;
        }
      }
      
      // Generate new timeline
      return await this.generateClusterTimeline(clusterId);
    } catch (error) {
      console.error('Timeline update error:', error);
      return null;
    }
  }
}

// Export singleton instance
export const timelineSynthesizer = new TimelineSynthesizer();

// Export main functions
export async function generateTimeline(events, style = 'chronological') {
  return timelineSynthesizer.generateTimeline(events, style);
}

export async function generateClusterTimeline(clusterId, style = 'chronological') {
  return timelineSynthesizer.generateClusterTimeline(clusterId, style);
}

export default TimelineSynthesizer;