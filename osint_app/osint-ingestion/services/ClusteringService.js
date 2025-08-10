/**
 * Clustering Service
 * Implements HDBSCAN clustering for event deduplication
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ClusteringService {
  constructor() {
    this.pythonScriptPath = path.join(__dirname, '..', 'scripts', 'cluster.py');
    this.tempDir = path.join(process.cwd(), '.temp', 'clustering');
    this.ensureTempDir();
  }

  /**
   * Ensure temp directory exists
   */
  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Cluster events using HDBSCAN
   * @param {Array} events - Events with embeddings and metadata
   * @param {Object} options - Clustering options
   * @returns {Promise<Array>} Cluster assignments
   */
  async clusterEvents(events, options = {}) {
    const {
      minClusterSize = 2,
      minSamples = 1,
      metric = 'euclidean',
      clusterSelectionEpsilon = 0.3,
      useHybridFeatures = true
    } = options;

    if (!events || events.length < minClusterSize) {
      return events.map((_, idx) => ({ eventIndex: idx, clusterId: -1 }));
    }

    try {
      // Prepare data for clustering
      const clusteringData = this.prepareClusteringData(events, useHybridFeatures);
      
      // Save data to temp file
      const dataFile = path.join(this.tempDir, `cluster_data_${Date.now()}.json`);
      await fs.writeFile(dataFile, JSON.stringify(clusteringData));
      
      // Run HDBSCAN clustering
      const clusters = await this.runHDBSCAN(dataFile, {
        minClusterSize,
        minSamples,
        metric,
        clusterSelectionEpsilon
      });
      
      // Clean up temp file
      await fs.unlink(dataFile).catch(() => {});
      
      return this.processClusterResults(events, clusters);
    } catch (error) {
      console.error('Clustering failed:', error);
      // Fallback: return all events as unclustered
      return events.map((_, idx) => ({ eventIndex: idx, clusterId: -1 }));
    }
  }

  /**
   * Prepare data for clustering
   */
  prepareClusteringData(events, useHybridFeatures) {
    const data = {
      vectors: [],
      metadata: [],
      features: []
    };

    events.forEach((event, idx) => {
      // Add embedding vector
      if (event.embedding) {
        data.vectors.push(event.embedding);
      } else {
        // Use zero vector if no embedding
        data.vectors.push(new Array(768).fill(0));
      }

      // Add metadata
      data.metadata.push({
        index: idx,
        id: event.id,
        timestamp: event.timestamp,
        location: event.locationName,
        actors: event.primaryActors || []
      });

      if (useHybridFeatures) {
        // Create feature vector combining multiple signals
        const features = [
          // Temporal feature (hours since epoch, normalized)
          new Date(event.timestamp).getTime() / (1000 * 60 * 60 * 24 * 365), // Years since epoch
          
          // Geographic features (simplified - would need proper encoding)
          event.latitude || 0,
          event.longitude || 0,
          
          // Severity features
          event.escalationScore / 10,
          event.casualties?.killed ? Math.log1p(event.casualties.killed) / 10 : 0,
          
          // Event type features (one-hot encoding would be better)
          event.eventType === 'military_action' ? 1 : 0,
          event.eventType === 'terrorist_attack' ? 1 : 0,
          event.eventType === 'civil_unrest' ? 1 : 0
        ];
        
        data.features.push(features);
      }
    });

    return data;
  }

  /**
   * Run HDBSCAN clustering via Python script
   */
  async runHDBSCAN(dataFile, options) {
    return new Promise((resolve, reject) => {
      const args = [
        this.pythonScriptPath,
        '--data', dataFile,
        '--min-cluster-size', options.minClusterSize.toString(),
        '--min-samples', options.minSamples.toString(),
        '--metric', options.metric,
        '--cluster-selection-epsilon', options.clusterSelectionEpsilon.toString()
      ];

      const pythonProcess = spawn('python3', args);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`HDBSCAN clustering failed: ${stderr}`));
          return;
        }
        
        try {
          const clusters = JSON.parse(stdout);
          resolve(clusters);
        } catch (error) {
          reject(new Error(`Failed to parse clustering results: ${error.message}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }

  /**
   * Process cluster results
   */
  processClusterResults(events, clusterLabels) {
    const clusters = new Map();
    
    // Group events by cluster
    clusterLabels.forEach((label, idx) => {
      if (!clusters.has(label)) {
        clusters.set(label, []);
      }
      clusters.get(label).push({
        event: events[idx],
        index: idx
      });
    });
    
    // Convert to result format
    const result = [];
    
    clusters.forEach((clusterEvents, clusterId) => {
      // Find best representative event (highest confidence/reliability)
      let primaryEvent = clusterEvents[0].event;
      let maxScore = primaryEvent.reliability || 0;
      
      clusterEvents.forEach(({ event }) => {
        const score = event.reliability || 0;
        if (score > maxScore) {
          primaryEvent = event;
          maxScore = score;
        }
      });
      
      result.push({
        clusterId,
        primaryEvent,
        events: clusterEvents.map(ce => ce.event),
        size: clusterEvents.length,
        confidence: this.calculateClusterConfidence(clusterEvents)
      });
    });
    
    // Sort by cluster size (descending)
    result.sort((a, b) => b.size - a.size);
    
    return result;
  }

  /**
   * Calculate cluster confidence based on member similarity
   */
  calculateClusterConfidence(clusterEvents) {
    if (clusterEvents.length === 1) {
      return clusterEvents[0].event.reliability || 0.5;
    }
    
    // Average reliability of cluster members
    const avgReliability = clusterEvents.reduce((sum, ce) => 
      sum + (ce.event.reliability || 0.5), 0
    ) / clusterEvents.length;
    
    // Boost confidence for larger clusters
    const sizeBoost = Math.min(0.2, clusterEvents.length * 0.05);
    
    return Math.min(1.0, avgReliability + sizeBoost);
  }

  /**
   * Perform online clustering for new events
   * @param {Object} newEvent - New event to cluster
   * @param {Array} existingClusters - Existing cluster centers
   * @returns {Promise<number>} Cluster assignment (-1 for new cluster)
   */
  async assignToCluster(newEvent, existingClusters, threshold = 0.7) {
    if (!newEvent.embedding || existingClusters.length === 0) {
      return -1;
    }
    
    let bestCluster = -1;
    let bestSimilarity = 0;
    
    // Compare with existing cluster centers
    for (const cluster of existingClusters) {
      if (!cluster.centroid) continue;
      
      const similarity = this.cosineSimilarity(newEvent.embedding, cluster.centroid);
      
      if (similarity > threshold && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestCluster = cluster.id;
      }
    }
    
    return bestCluster;
  }

  /**
   * Calculate cosine similarity
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (norm1 * norm2);
  }

  /**
   * Update cluster centroid
   */
  updateClusterCentroid(cluster) {
    if (!cluster.events || cluster.events.length === 0) {
      return null;
    }
    
    const embeddings = cluster.events
      .map(e => e.embedding)
      .filter(e => e && e.length > 0);
    
    if (embeddings.length === 0) {
      return null;
    }
    
    // Calculate mean embedding
    const centroid = new Array(embeddings[0].length).fill(0);
    
    embeddings.forEach(embedding => {
      for (let i = 0; i < embedding.length; i++) {
        centroid[i] += embedding[i];
      }
    });
    
    for (let i = 0; i < centroid.length; i++) {
      centroid[i] /= embeddings.length;
    }
    
    return centroid;
  }
}

export default ClusteringService;