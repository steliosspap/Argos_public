/**
 * News deduplication utilities
 * Groups similar news events and tracks multiple sources
 */

import { Event } from '@/types';

interface DuplicateGroup {
  primary: Event;
  duplicates: Event[];
  sources: string[];
  combinedTags: string[];
}

/**
 * Calculate similarity between two text strings using Jaccard similarity
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Check if two events are likely duplicates
 */
function areEventsDuplicates(event1: Event, event2: Event): boolean {
  // Time window - events within 24 hours
  const timeDiff = Math.abs(
    new Date(event1.timestamp).getTime() - new Date(event2.timestamp).getTime()
  );
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  if (hoursDiff > 24) return false;
  
  // Location check - must be same country
  if (event1.country !== event2.country) return false;
  
  // Title similarity
  const titleSimilarity = calculateTextSimilarity(event1.title, event2.title);
  if (titleSimilarity > 0.7) return true;
  
  // Summary similarity
  if (event1.summary && event2.summary) {
    const summarySimilarity = calculateTextSimilarity(event1.summary, event2.summary);
    if (summarySimilarity > 0.6) return true;
  }
  
  // Check if they share multiple tags
  if (event1.tags && event2.tags) {
    const sharedTags = event1.tags.filter(tag => event2.tags?.includes(tag));
    if (sharedTags.length >= 2) return true;
  }
  
  return false;
}

/**
 * Extract source name from URL or event metadata
 */
function extractSourceName(event: Event): string {
  // First check if source is stored in metadata
  if ((event as any).source_name) {
    return (event as any).source_name;
  }
  
  // Extract from URL
  if (event.source_urls && event.source_urls.length > 0) {
    try {
      const url = new URL(event.source_urls[0]);
      return url.hostname.replace('www.', '');
    } catch {
      return 'Unknown Source';
    }
  }
  
  return 'Unknown Source';
}

/**
 * Group duplicate events together
 */
export function groupDuplicateEvents(events: Event[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();
  
  for (const event of events) {
    if (processed.has(event.id)) continue;
    
    const group: DuplicateGroup = {
      primary: event,
      duplicates: [],
      sources: [extractSourceName(event)],
      combinedTags: [...(event.tags || [])]
    };
    
    // Find all duplicates
    for (const otherEvent of events) {
      if (event.id === otherEvent.id || processed.has(otherEvent.id)) continue;
      
      if (areEventsDuplicates(event, otherEvent)) {
        group.duplicates.push(otherEvent);
        processed.add(otherEvent.id);
        
        // Add source
        const source = extractSourceName(otherEvent);
        if (!group.sources.includes(source)) {
          group.sources.push(source);
        }
        
        // Combine tags
        if (otherEvent.tags) {
          for (const tag of otherEvent.tags) {
            if (!group.combinedTags.includes(tag)) {
              group.combinedTags.push(tag);
            }
          }
        }
      }
    }
    
    processed.add(event.id);
    groups.push(group);
  }
  
  return groups;
}

/**
 * Get deduplicated events list
 */
export function getDeduplicatedEvents(events: Event[]): Event[] {
  const groups = groupDuplicateEvents(events);
  
  return groups.map(group => {
    // Enhance primary event with combined data
    const enhanced = { ...group.primary };
    
    // Add all source URLs
    const allSourceUrls = [
      ...(enhanced.source_urls || []),
      ...group.duplicates.flatMap(d => d.source_urls || [])
    ].filter((url, index, self) => self.indexOf(url) === index);
    
    enhanced.source_urls = allSourceUrls;
    
    // Use combined tags
    enhanced.tags = group.combinedTags;
    
    // Add metadata about duplicates
    (enhanced as any).duplicate_count = group.duplicates.length;
    (enhanced as any).reporting_sources = group.sources;
    
    return enhanced;
  });
}

/**
 * Get related events for a given event
 */
export function getRelatedEvents(event: Event, allEvents: Event[]): Event[] {
  return allEvents.filter(e => 
    e.id !== event.id && areEventsDuplicates(event, e)
  );
}