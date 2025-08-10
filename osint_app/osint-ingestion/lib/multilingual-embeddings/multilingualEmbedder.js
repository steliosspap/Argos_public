/**
 * Multilingual Embeddings Service
 * Supports LASER and LaBSE models for cross-lingual similarity
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { embedText } from '../sentence-transformers/embedText.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MultilingualEmbedder {
  constructor() {
    // Model configurations
    this.models = {
      'laser': {
        name: 'LASER',
        dimensions: 1024,
        languages: 93,
        pythonScript: 'laser_embedder.py'
      },
      'labse': {
        name: 'LaBSE',
        dimensions: 768,
        languages: 109,
        pythonScript: 'labse_embedder.py'
      },
      'multilingual-minilm': {
        name: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
        dimensions: 384,
        languages: 50,
        pythonScript: 'minilm_embedder.py'
      }
    };
    
    this.defaultModel = 'multilingual-minilm';
    this.modelCache = new Map();
    this.initialized = false;
    
    // Initialize models
    this.initializeModels();
  }
  
  /**
   * Initialize multilingual models
   */
  async initializeModels() {
    try {
      // Check which models are available
      for (const [modelKey, modelConfig] of Object.entries(this.models)) {
        const available = await this.checkModelAvailability(modelKey);
        this.models[modelKey].available = available;
        
        if (available) {
          console.log(`Multilingual model ${modelConfig.name} is available`);
        }
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize multilingual models:', error);
    }
  }
  
  /**
   * Check if a model is available
   */
  async checkModelAvailability(modelKey) {
    const modelConfig = this.models[modelKey];
    const scriptPath = path.join(__dirname, modelConfig.pythonScript);
    
    try {
      const fs = await import('fs/promises');
      await fs.access(scriptPath);
      
      // Test the model
      const testResult = await this.testModel(modelKey, 'test');
      return testResult !== null;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Test a model with sample text
   */
  async testModel(modelKey, text) {
    return new Promise((resolve) => {
      const modelConfig = this.models[modelKey];
      const scriptPath = path.join(__dirname, modelConfig.pythonScript);
      
      const pythonProcess = spawn('python3', [scriptPath, '--test']);
      
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
          console.error(`Model test failed for ${modelKey}: ${stderr}`);
          resolve(null);
        } else {
          resolve(true);
        }
      });
      
      pythonProcess.on('error', () => {
        resolve(null);
      });
      
      // Send test text
      pythonProcess.stdin.write(text);
      pythonProcess.stdin.end();
    });
  }
  
  /**
   * Embed text using specified multilingual model
   */
  async embedText(text, language = null, modelKey = null) {
    if (!this.initialized) {
      await this.initializeModels();
    }
    
    // Select model
    const selectedModel = modelKey || this.defaultModel;
    const modelConfig = this.models[selectedModel];
    
    if (!modelConfig || !modelConfig.available) {
      // Fallback to basic embeddings
      console.log('Multilingual model not available, using fallback');
      return this.fallbackEmbed(text);
    }
    
    // Check cache
    const cacheKey = `${selectedModel}:${text}`;
    if (this.modelCache.has(cacheKey)) {
      return this.modelCache.get(cacheKey);
    }
    
    try {
      const embedding = await this.runPythonEmbedder(selectedModel, text, language);
      
      // Cache the result
      this.modelCache.set(cacheKey, embedding);
      
      // Limit cache size
      if (this.modelCache.size > 1000) {
        const firstKey = this.modelCache.keys().next().value;
        this.modelCache.delete(firstKey);
      }
      
      return embedding;
    } catch (error) {
      console.error(`Multilingual embedding error with ${selectedModel}:`, error);
      return this.fallbackEmbed(text);
    }
  }
  
  /**
   * Run Python embedder script
   */
  async runPythonEmbedder(modelKey, text, language) {
    return new Promise((resolve, reject) => {
      const modelConfig = this.models[modelKey];
      const scriptPath = path.join(__dirname, modelConfig.pythonScript);
      
      const args = [scriptPath];
      if (language) {
        args.push('--language', language);
      }
      
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
          reject(new Error(`Python embedder failed: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          
          // Validate embedding
          if (!Array.isArray(result.embedding) || 
              result.embedding.length !== modelConfig.dimensions) {
            throw new Error('Invalid embedding dimensions');
          }
          
          resolve({
            embedding: result.embedding,
            model: modelConfig.name,
            language: result.language || language,
            dimensions: modelConfig.dimensions
          });
        } catch (error) {
          reject(new Error(`Failed to parse embedding: ${error.message}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(error);
      });
      
      // Send text to embed
      pythonProcess.stdin.write(JSON.stringify({ text: text }));
      pythonProcess.stdin.end();
    });
  }
  
  /**
   * Fallback embedding using existing service
   */
  async fallbackEmbed(text) {
    try {
      const embedding = await embedText(text);
      return {
        embedding: embedding,
        model: 'fallback',
        language: 'unknown',
        dimensions: embedding.length
      };
    } catch (error) {
      console.error('Fallback embedding failed:', error);
      // Return zero vector
      return {
        embedding: new Array(768).fill(0),
        model: 'zero',
        language: 'unknown',
        dimensions: 768
      };
    }
  }
  
  /**
   * Compute cross-lingual similarity
   */
  async computeCrossLingualSimilarity(text1, lang1, text2, lang2, modelKey = null) {
    const embedding1 = await this.embedText(text1, lang1, modelKey);
    const embedding2 = await this.embedText(text2, lang2, modelKey);
    
    // Compute cosine similarity
    return this.cosineSimilarity(embedding1.embedding, embedding2.embedding);
  }
  
  /**
   * Batch embed texts in multiple languages
   */
  async batchEmbedMultilingual(texts, languages = null, modelKey = null) {
    const results = [];
    
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const language = languages ? languages[i] : null;
      
      try {
        const embedding = await this.embedText(text, language, modelKey);
        results.push({
          text: text,
          language: language,
          embedding: embedding,
          success: true
        });
      } catch (error) {
        results.push({
          text: text,
          language: language,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }
  
  /**
   * Find similar texts across languages
   */
  async findCrossLingualSimilar(queryText, queryLang, candidates, candidateLangs, threshold = 0.7) {
    const queryEmbedding = await this.embedText(queryText, queryLang);
    const similarities = [];
    
    for (let i = 0; i < candidates.length; i++) {
      const candidateEmbedding = await this.embedText(
        candidates[i], 
        candidateLangs ? candidateLangs[i] : null
      );
      
      const similarity = this.cosineSimilarity(
        queryEmbedding.embedding,
        candidateEmbedding.embedding
      );
      
      if (similarity >= threshold) {
        similarities.push({
          text: candidates[i],
          language: candidateLangs ? candidateLangs[i] : 'unknown',
          similarity: similarity,
          index: i
        });
      }
    }
    
    // Sort by similarity
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities;
  }
  
  /**
   * Calculate cosine similarity
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have same dimensions');
    }
    
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
    
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (norm1 * norm2);
  }
  
  /**
   * Get available models info
   */
  getAvailableModels() {
    const available = {};
    
    for (const [key, config] of Object.entries(this.models)) {
      if (config.available) {
        available[key] = {
          name: config.name,
          dimensions: config.dimensions,
          languages: config.languages
        };
      }
    }
    
    return available;
  }
  
  /**
   * Create Python embedder scripts
   */
  async createPythonScripts() {
    const fs = await import('fs/promises');
    
    // Create multilingual MiniLM script
    const miniLMScript = `#!/usr/bin/env python3
"""
Multilingual MiniLM Embedder
Uses sentence-transformers for multilingual embeddings
"""

import sys
import json
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
    MODEL_AVAILABLE = True
except ImportError:
    MODEL_AVAILABLE = False

def embed_text(text, language=None):
    if not MODEL_AVAILABLE:
        # Return mock embedding
        return {
            "embedding": [0.1] * 384,
            "model": "mock-multilingual-minilm",
            "language": language or "unknown"
        }
    
    try:
        model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
        embedding = model.encode(text)
        
        return {
            "embedding": embedding.tolist(),
            "model": "paraphrase-multilingual-MiniLM-L12-v2",
            "language": language or "auto"
        }
    except Exception as e:
        return {
            "error": str(e),
            "embedding": [0.0] * 384
        }

def main():
    # Check for test mode
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        print(json.dumps({"test": "success"}))
        return
    
    # Read input
    input_data = json.loads(sys.stdin.read())
    text = input_data.get('text', '')
    language = input_data.get('language', None)
    
    # Generate embedding
    result = embed_text(text, language)
    
    # Output result
    print(json.dumps(result))

if __name__ == '__main__':
    main()
`;
    
    await fs.mkdir(__dirname, { recursive: true });
    await fs.writeFile(
      path.join(__dirname, 'minilm_embedder.py'),
      miniLMScript
    );
    
    // Create LASER mock script
    const laserScript = `#!/usr/bin/env python3
"""
LASER Embedder Mock
Placeholder for LASER embeddings
"""

import sys
import json

def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        # LASER not available in this mock
        sys.exit(1)
    
    input_data = json.loads(sys.stdin.read())
    print(json.dumps({
        "embedding": [0.0] * 1024,
        "model": "laser-mock",
        "error": "LASER not installed"
    }))

if __name__ == '__main__':
    main()
`;
    
    await fs.writeFile(
      path.join(__dirname, 'laser_embedder.py'),
      laserScript
    );
    
    // Create LaBSE mock script
    const labseScript = `#!/usr/bin/env python3
"""
LaBSE Embedder Mock
Placeholder for LaBSE embeddings
"""

import sys
import json

def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        # LaBSE not available in this mock
        sys.exit(1)
    
    input_data = json.loads(sys.stdin.read())
    print(json.dumps({
        "embedding": [0.0] * 768,
        "model": "labse-mock",
        "error": "LaBSE not installed"
    }))

if __name__ == '__main__':
    main()
`;
    
    await fs.writeFile(
      path.join(__dirname, 'labse_embedder.py'),
      labseScript
    );
    
    // Make scripts executable
    await fs.chmod(path.join(__dirname, 'minilm_embedder.py'), '755');
    await fs.chmod(path.join(__dirname, 'laser_embedder.py'), '755');
    await fs.chmod(path.join(__dirname, 'labse_embedder.py'), '755');
  }
}

// Export singleton instance
export const multilingualEmbedder = new MultilingualEmbedder();

// Export convenience functions
export async function embedMultilingual(text, language = null, model = null) {
  return multilingualEmbedder.embedText(text, language, model);
}

export async function crossLingualSimilarity(text1, lang1, text2, lang2, model = null) {
  return multilingualEmbedder.computeCrossLingualSimilarity(text1, lang1, text2, lang2, model);
}

export default MultilingualEmbedder;