/**
 * Similarity Service
 * Handles vector-based similarity search and event deduplication
 */

import pkg from 'pg';
const { Pool } = pkg;
import { embedText, embedEvent, textEmbedder } from '../lib/sentence-transformers/embedText.js';
import { embedMultilingual, crossLingualSimilarity } from '../lib/multilingual-embeddings/multilingualEmbedder.js';
import { config } from '../core/config.js';

export class SimilarityService {
  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url
    });
    this.vectorDimension = 768;
  }

  /**
   * Find similar events using vector similarity
   * @param {number[]} queryVector - Query embedding vector
   * @param {number} topK - Number of results to return
   * @param {number} similarityThreshold - Minimum similarity score (0-1)
   * @returns {Promise<Array>} Similar events with scores
   */
  async findSimilarEvents(queryVector, topK = 5, similarityThreshold = 0.7) {
    try {
      // Format vector for PostgreSQL
      const vectorString = `[${queryVector.join(',')}]`;
      
      const query = `
        SELECT 
          id,
          1 - (embedding <=> $1::vector) AS similarity_score,
          enhanced_headline,
          location_name,
          timestamp,
          severity,
          primary_actors,
          casualties,
          source
        FROM events
        WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `;
      
      const result = await this.pool.query(query, [vectorString, similarityThreshold, topK]);
      
      // Log top matches
      if (result.rows.length > 0) {
        console.log(`Found ${result.rows.length} similar events:`);
        result.rows.forEach((row, idx) => {
          console.log(`  ${idx + 1}. Score: ${row.similarity_score.toFixed(3)} - ${row.enhanced_headline?.substring(0, 60)}...`);
        });
      }
      
      return result.rows;
    } catch (error) {
      console.error('Error finding similar events:', error);
      throw error;
    }
  }

  /**
   * Find similar events by text query
   * @param {string} queryText - Text to search for
   * @param {number} topK - Number of results to return
   * @returns {Promise<Array>} Similar events with scores
   */
  async findSimilarEventsByText(queryText, topK = 5) {
    try {
      // Generate embedding for query text
      const queryVector = await embedText(queryText);
      
      // Find similar events
      return this.findSimilarEvents(queryVector, topK);
    } catch (error) {
      console.error('Error finding similar events by text:', error);
      throw error;
    }
  }

  /**
   * Find similar events to a given event
   * @param {Object} event - Event object to find similar events for
   * @param {number} topK - Number of results to return
   * @returns {Promise<Array>} Similar events with scores
   */
  async findSimilarToEvent(event, topK = 5) {
    try {
      let queryVector;
      
      // Use existing embedding or generate new one
      if (event.embedding) {
        queryVector = event.embedding;
      } else {
        queryVector = await embedEvent(event);
      }
      
      // Find similar events, excluding the current event
      const query = `
        SELECT 
          id,
          1 - (embedding <=> $1::vector) AS similarity_score,
          enhanced_headline,
          location_name,
          timestamp,
          severity,
          primary_actors,
          casualties,
          source
        FROM events
        WHERE embedding IS NOT NULL
        AND id != $2
        AND 1 - (embedding <=> $1::vector) >= 0.6
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `;
      
      const vectorString = `[${queryVector.join(',')}]`;
      const result = await this.pool.query(query, [vectorString, event.id, topK]);
      
      return result.rows;
    } catch (error) {
      console.error('Error finding similar events to event:', error);
      throw error;
    }
  }

  /**
   * Check if an event is a duplicate based on vector similarity
   * @param {Object} event - Event to check
   * @param {number} threshold - Similarity threshold for duplicates
   * @returns {Promise<Object|null>} Duplicate event if found, null otherwise
   */
  async checkDuplicate(event, threshold = 0.85) {
    try {
      // Generate embedding if not present
      const eventVector = event.embedding || await embedEvent(event);
      
      // Look for very similar events within the same time window
      const timeWindow = new Date(event.timestamp);
      timeWindow.setHours(timeWindow.getHours() - 24); // 24-hour window
      
      const query = `
        SELECT 
          id,
          1 - (embedding <=> $1::vector) AS similarity_score,
          enhanced_headline,
          location_name,
          timestamp,
          source
        FROM events
        WHERE embedding IS NOT NULL
        AND timestamp >= $2
        AND timestamp <= $3
        AND 1 - (embedding <=> $1::vector) >= $4
        ORDER BY embedding <=> $1::vector
        LIMIT 1
      `;
      
      const vectorString = `[${eventVector.join(',')}]`;
      const result = await this.pool.query(query, [
        vectorString,
        timeWindow.toISOString(),
        new Date(event.timestamp).toISOString(),
        threshold
      ]);
      
      if (result.rows.length > 0) {
        const duplicate = result.rows[0];
        console.log(`Found potential duplicate with score ${duplicate.similarity_score.toFixed(3)}:`);
        console.log(`  Original: ${duplicate.enhanced_headline}`);
        console.log(`  New: ${event.enhancedHeadline}`);
        return duplicate;
      }
      
      return null;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return null;
    }
  }

  /**
   * Calculate hybrid similarity score combining vector and metadata
   * @param {Object} event1 - First event
   * @param {Object} event2 - Second event
   * @returns {Promise<Object>} Similarity scores breakdown
   */
  async calculateHybridSimilarity(event1, event2) {
    try {
      // Vector similarity
      let vectorSimilarity = 0;
      if (event1.embedding && event2.embedding) {
        vectorSimilarity = textEmbedder.cosineSimilarity(event1.embedding, event2.embedding);
      }
      
      // Temporal similarity (within 24 hours)
      const timeDiff = Math.abs(new Date(event1.timestamp) - new Date(event2.timestamp));
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      const temporalSimilarity = Math.max(0, 1 - (hoursDiff / 24));
      
      // Geographic similarity
      let geographicSimilarity = 0;
      if (event1.locationName && event2.locationName) {
        // Simple string matching for now
        const loc1 = event1.locationName.toLowerCase();
        const loc2 = event2.locationName.toLowerCase();
        if (loc1 === loc2) {
          geographicSimilarity = 1;
        } else if (loc1.includes(loc2) || loc2.includes(loc1)) {
          geographicSimilarity = 0.7;
        } else if (event1.country === event2.country) {
          geographicSimilarity = 0.3;
        }
      }
      
      // Actor overlap
      let actorOverlap = 0;
      if (event1.primaryActors?.length && event2.primaryActors?.length) {
        const actors1 = new Set(event1.primaryActors.map(a => a.toLowerCase()));
        const actors2 = new Set(event2.primaryActors.map(a => a.toLowerCase()));
        const intersection = [...actors1].filter(a => actors2.has(a));
        const union = new Set([...actors1, ...actors2]);
        actorOverlap = union.size > 0 ? intersection.length / union.size : 0;
      }
      
      // Combined score
      const hybridScore = (
        vectorSimilarity * 0.4 +
        temporalSimilarity * 0.2 +
        geographicSimilarity * 0.2 +
        actorOverlap * 0.2
      );
      
      return {
        hybridScore,
        vectorSimilarity,
        temporalSimilarity,
        geographicSimilarity,
        actorOverlap
      };
    } catch (error) {
      console.error('Error calculating hybrid similarity:', error);
      return {
        hybridScore: 0,
        vectorSimilarity: 0,
        temporalSimilarity: 0,
        geographicSimilarity: 0,
        actorOverlap: 0
      };
    }
  }

  /**
   * Update event embedding in database
   * @param {string} eventId - Event ID
   * @param {number[]} embedding - Embedding vector
   */
  async updateEventEmbedding(eventId, embedding) {
    try {
      const vectorString = `[${embedding.join(',')}]`;
      
      const query = `
        UPDATE events 
        SET embedding = $1::vector,
            updated_at = NOW()
        WHERE id = $2
      `;
      
      await this.pool.query(query, [vectorString, eventId]);
      console.log(`Updated embedding for event ${eventId}`);
    } catch (error) {
      console.error('Error updating event embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for events without them
   * @param {number} batchSize - Number of events to process at once
   */
  async generateMissingEmbeddings(batchSize = 50) {
    try {
      // Find events without embeddings
      const query = `
        SELECT id, enhanced_headline, summary, primary_actors, location_name, conflict_type
        FROM events
        WHERE embedding IS NULL
        LIMIT $1
      `;
      
      const result = await this.pool.query(query, [batchSize]);
      
      if (result.rows.length === 0) {
        console.log('No events found without embeddings');
        return;
      }
      
      console.log(`Generating embeddings for ${result.rows.length} events...`);
      
      for (const row of result.rows) {
        try {
          const event = {
            enhancedHeadline: row.enhanced_headline,
            summary: row.summary,
            primaryActors: row.primary_actors,
            locationName: row.location_name,
            conflictType: row.conflict_type
          };
          
          const embedding = await embedEvent(event);
          await this.updateEventEmbedding(row.id, embedding);
        } catch (error) {
          console.error(`Failed to generate embedding for event ${row.id}:`, error);
        }
      }
      
      console.log('Finished generating embeddings');
    } catch (error) {
      console.error('Error generating missing embeddings:', error);
      throw error;
    }
  }

  /**
   * Find similar events using multilingual embeddings
   * @param {string} queryText - Query text in any language
   * @param {string} language - Language code (optional)
   * @param {number} topK - Number of results to return
   * @param {string} model - Multilingual model to use
   * @returns {Promise<Array>} Similar events with scores
   */
  async findSimilarEventsMultilingual(queryText, language = null, topK = 5, model = null) {
    try {
      // Generate multilingual embedding
      const result = await embedMultilingual(queryText, language, model);
      const queryVector = result.embedding;
      
      console.log(`Multilingual search using ${result.model} model (${result.language || 'auto-detected'})`);
      
      // Find similar events
      return this.findSimilarEvents(queryVector, topK);
    } catch (error) {
      console.error('Error in multilingual search:', error);
      // Fallback to regular embedding
      return this.findSimilarEventsByText(queryText, topK);
    }
  }

  /**
   * Find cross-lingual duplicate events
   * @param {Object} event - Event to check
   * @param {string} eventLanguage - Language of the event
   * @param {number} threshold - Similarity threshold
   * @returns {Promise<Array>} Potential cross-lingual duplicates
   */
  async findCrossLingualDuplicates(event, eventLanguage = null, threshold = 0.8) {
    try {
      // Generate multilingual embedding for the event
      const eventText = `${event.enhancedHeadline || event.title} ${event.summary || ''}`;
      const result = await embedMultilingual(eventText, eventLanguage);
      const eventVector = result.embedding;
      
      // Search in a time window
      const timeWindow = new Date(event.timestamp);
      timeWindow.setHours(timeWindow.getHours() - 48); // 48-hour window for cross-lingual
      
      const query = `
        SELECT 
          id,
          1 - (embedding <=> $1::vector) AS similarity_score,
          enhanced_headline,
          location_name,
          timestamp,
          source,
          original_language
        FROM events
        WHERE embedding IS NOT NULL
        AND timestamp >= $2
        AND timestamp <= $3
        AND 1 - (embedding <=> $1::vector) >= $4
        AND (original_language IS NULL OR original_language != $5)
        ORDER BY embedding <=> $1::vector
        LIMIT 10
      `;
      
      const vectorString = `[${eventVector.join(',')}]`;
      const results = await this.pool.query(query, [
        vectorString,
        timeWindow.toISOString(),
        new Date(event.timestamp).toISOString(),
        threshold,
        eventLanguage || 'en'
      ]);
      
      if (results.rows.length > 0) {
        console.log(`Found ${results.rows.length} potential cross-lingual duplicates`);
        results.rows.forEach(row => {
          console.log(`  - ${row.similarity_score.toFixed(3)} [${row.original_language || 'unknown'}]: ${row.enhanced_headline}`);
        });
      }
      
      return results.rows;
    } catch (error) {
      console.error('Error finding cross-lingual duplicates:', error);
      return [];
    }
  }

  /**
   * Update embeddings to multilingual versions
   * @param {number} batchSize - Number of events to process
   * @param {string} model - Multilingual model to use
   */
  async updateToMultilingualEmbeddings(batchSize = 20, model = null) {
    try {
      // Find events with language information
      const query = `
        SELECT id, enhanced_headline, summary, original_language
        FROM events
        WHERE original_language IS NOT NULL
        AND original_language != 'en'
        ORDER BY created_at DESC
        LIMIT $1
      `;
      
      const result = await this.pool.query(query, [batchSize]);
      
      if (result.rows.length === 0) {
        console.log('No multilingual events found to update');
        return;
      }
      
      console.log(`Updating ${result.rows.length} events with multilingual embeddings...`);
      
      for (const row of result.rows) {
        try {
          const text = `${row.enhanced_headline} ${row.summary || ''}`;
          const embeddingResult = await embedMultilingual(text, row.original_language, model);
          
          // Update embedding
          await this.updateEventEmbedding(row.id, embeddingResult.embedding);
          
          console.log(`Updated event ${row.id} with ${embeddingResult.model} embedding`);
        } catch (error) {
          console.error(`Failed to update multilingual embedding for event ${row.id}:`, error);
        }
      }
      
      console.log('Finished updating multilingual embeddings');
    } catch (error) {
      console.error('Error updating multilingual embeddings:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
  }
}

// Export singleton instance
export const similarityService = new SimilarityService();

export default SimilarityService;