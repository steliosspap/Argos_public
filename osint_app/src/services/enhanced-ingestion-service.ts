import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Event {
  id?: string;
  title: string;
  summary: string;
  enhanced_headline?: string;
  location_name?: string;
  country?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  event_type: string;
  primary_actors?: string[];
  casualties?: number;
  source?: string;
  url?: string;
  embedding?: number[];
  original_language?: string;
  translated?: boolean;
}

export class EnhancedIngestionService {
  private similarityThreshold = 0.85; // High threshold for deduplication
  private clusteringEnabled = false;
  private translationEnabled = false;

  constructor() {
    // Check feature flags from environment
    this.clusteringEnabled = process.env.ENABLE_CLUSTERING === 'true';
    this.translationEnabled = process.env.ENABLE_TRANSLATION === 'true';
  }

  /**
   * Generate embeddings for text using sentence-transformers
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Call Python script to generate embeddings
      const scriptPath = '../osint-ingestion/lib/sentence-transformers/embed_text.py';
      const { stdout } = await execAsync(
        `python3 ${scriptPath} "${text.replace(/"/g, '\\"')}"`
      );
      
      const embedding = JSON.parse(stdout);
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Fallback to OpenAI embeddings if local model fails
      return this.generateOpenAIEmbedding(text);
    }
  }

  /**
   * Fallback to OpenAI embeddings
   */
  async generateOpenAIEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    
    // Pad to 768 dimensions if needed
    const embedding = response.data[0].embedding;
    while (embedding.length < 768) {
      embedding.push(0);
    }
    return embedding.slice(0, 768);
  }

  /**
   * Check for duplicate events using vector similarity
   */
  async checkDuplicate(event: Event): Promise<{ isDuplicate: boolean; similarEvents: any[] }> {
    if (!event.embedding) {
      // Generate embedding for the event
      const eventText = `${event.enhanced_headline || event.title} ${event.summary}`;
      event.embedding = await this.generateEmbedding(eventText);
    }

    // Query for similar events using pgvector
    const { data: similarEvents, error } = await supabase.rpc('find_similar_events', {
      query_embedding: event.embedding,
      top_k: 5,
      similarity_threshold: this.similarityThreshold
    });

    if (error) {
      console.error('Error checking duplicates:', error);
      return { isDuplicate: false, similarEvents: [] };
    }

    // Additional checks for temporal and geographic proximity
    const isDuplicate = similarEvents.some((similar: any) => {
      // Check if events are within 24 hours
      const timeDiff = Math.abs(
        new Date(event.timestamp).getTime() - new Date(similar.event_timestamp).getTime()
      );
      const isTemporallyClose = timeDiff < 24 * 60 * 60 * 1000;

      // Check if events are geographically close (within 50km)
      const isGeographicallyClose = 
        event.latitude && event.longitude && similar.latitude && similar.longitude &&
        this.calculateDistance(
          event.latitude, event.longitude,
          similar.latitude, similar.longitude
        ) < 50;

      return similar.similarity_score > this.similarityThreshold && 
             (isTemporallyClose || isGeographicallyClose);
    });

    return { isDuplicate, similarEvents: similarEvents || [] };
  }

  /**
   * Detect language and translate if needed
   */
  async detectAndTranslate(text: string): Promise<{ text: string; originalLanguage?: string; translated: boolean }> {
    if (!this.translationEnabled) {
      return { text, translated: false };
    }

    try {
      // Call Python script for language detection and translation
      const scriptPath = '../osint-ingestion/lib/translation/translate.py';
      const { stdout } = await execAsync(
        `python3 ${scriptPath} detect_and_translate "${text.replace(/"/g, '\\"')}"`
      );
      
      const result = JSON.parse(stdout);
      return {
        text: result.translated_text || text,
        originalLanguage: result.original_language,
        translated: result.translated
      };
    } catch (error) {
      console.error('Translation error:', error);
      return { text, translated: false };
    }
  }

  /**
   * Process events with ML enhancements
   */
  async processEventsWithML(events: Event[]): Promise<Event[]> {
    const processedEvents: Event[] = [];
    const duplicateCount = 0;

    for (const event of events) {
      try {
        // Step 1: Translate if needed
        if (this.translationEnabled && event.summary) {
          const translationResult = await this.detectAndTranslate(event.summary);
          if (translationResult.translated) {
            event.summary = translationResult.text;
            event.original_language = translationResult.originalLanguage;
            event.translated = true;
          }
        }

        // Step 2: Generate embedding
        const eventText = `${event.enhanced_headline || event.title} ${event.summary}`;
        event.embedding = await this.generateEmbedding(eventText);

        // Step 3: Check for duplicates
        const { isDuplicate, similarEvents } = await this.checkDuplicate(event);
        
        if (!isDuplicate) {
          processedEvents.push(event);
        } else {
          console.log(`Duplicate detected: ${event.title}`);
          // Optionally merge information from similar events
          if (similarEvents.length > 0) {
            // Update the existing event with new information if needed
            const existingEventId = similarEvents[0].event_id;
            await this.mergeEventInformation(existingEventId, event);
          }
        }

      } catch (error) {
        console.error('Error processing event:', error);
        processedEvents.push(event); // Include event even if ML processing fails
      }
    }

    console.log(`Processed ${events.length} events, found ${duplicateCount} duplicates`);
    return processedEvents;
  }

  /**
   * Run HDBSCAN clustering on recent events
   */
  async clusterEvents(timeWindow: string = '24 hours'): Promise<void> {
    if (!this.clusteringEnabled) {
      return;
    }

    try {
      // Call Python clustering script
      const scriptPath = '../osint-ingestion/scripts/cluster.py';
      const { stdout } = await execAsync(
        `python3 ${scriptPath} --time-window "${timeWindow}"`
      );
      
      console.log('Clustering results:', stdout);
    } catch (error) {
      console.error('Clustering error:', error);
    }
  }

  /**
   * Helper function to calculate distance between coordinates
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
   * Merge information from duplicate events
   */
  private async mergeEventInformation(existingEventId: string, newEvent: Event): Promise<void> {
    // Implement logic to merge relevant information
    // For example, update sources, add new details, etc.
    console.log(`Merging information into event ${existingEventId}`);
  }

  /**
   * Enable/disable features
   */
  enableClustering(enabled: boolean = true) {
    this.clusteringEnabled = enabled;
  }

  enableTranslation(enabled: boolean = true) {
    this.translationEnabled = enabled;
  }

  setSimilarityThreshold(threshold: number) {
    this.similarityThreshold = threshold;
  }
}