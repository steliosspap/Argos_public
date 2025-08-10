/**
 * Entity Linking Service
 * Links named entities to Wikidata QIDs for disambiguation
 * Supports BLINK model and Wikidata API fallback
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { config } from '../core/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class EntityLinker {
  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      config.database.supabase.url,
      config.database.supabase.serviceKey
    );
    
    // Cache for entity links
    this.cache = new Map();
    this.loadCacheFromDB();
    
    // BLINK model path
    this.blinkPath = path.join(__dirname, '..', 'lib', 'BLINK');
    this.blinkAvailable = false;
    this.checkBLINKAvailability();
    
    // Wikidata endpoint
    this.wikidataEndpoint = 'https://www.wikidata.org/w/api.php';
    
    // Entity type mappings
    this.entityTypes = {
      'PER': 'person',
      'PERSON': 'person',
      'ORG': 'organization',
      'ORGANIZATION': 'organization',
      'LOC': 'location',
      'LOCATION': 'location',
      'GPE': 'location', // Geopolitical entity
      'FAC': 'facility',
      'FACILITY': 'facility'
    };
  }

  /**
   * Check if BLINK model is available
   */
  async checkBLINKAvailability() {
    try {
      const testScript = path.join(this.blinkPath, 'blink', 'main_dense.py');
      const fs = await import('fs/promises');
      await fs.access(testScript);
      this.blinkAvailable = true;
      console.log('BLINK model is available for entity linking');
    } catch (error) {
      console.log('BLINK model not found, using Wikidata API fallback');
      this.blinkAvailable = false;
    }
  }

  /**
   * Load entity cache from database
   */
  async loadCacheFromDB() {
    try {
      const { data, error } = await this.supabase
        .from('entity_wikidata_cache')
        .select('*');
      
      if (error) {
        console.error('Error loading entity cache:', error);
        return;
      }
      
      data.forEach(entity => {
        const key = `${entity.entity_text}:${entity.entity_type}`;
        this.cache.set(key, {
          qid: entity.wikidata_qid,
          label: entity.label,
          description: entity.description,
          confidence: entity.confidence
        });
      });
      
      console.log(`Loaded ${data.length} entity links from cache`);
    } catch (error) {
      console.error('Failed to load entity cache:', error);
    }
  }

  /**
   * Link entities to Wikidata QIDs
   * @param {Array} namedEntities - Array of {text, type, confidence} objects
   * @returns {Promise<Array>} Array of linked entities
   */
  async linkEntities(namedEntities) {
    if (!namedEntities || namedEntities.length === 0) {
      return [];
    }
    
    const results = [];
    
    for (const entity of namedEntities) {
      try {
        const linkedEntity = await this.linkSingleEntity(entity);
        if (linkedEntity) {
          results.push(linkedEntity);
        }
      } catch (error) {
        console.error(`Failed to link entity "${entity.text}":`, error.message);
        results.push({
          entity: entity.text,
          type: entity.type,
          qid: null,
          confidence: 0,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Link a single entity
   */
  async linkSingleEntity(entity) {
    const entityType = this.normalizeEntityType(entity.type);
    const cacheKey = `${entity.text}:${entityType}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return {
        entity: entity.text,
        type: entityType,
        qid: cached.qid,
        label: cached.label,
        description: cached.description,
        confidence: cached.confidence,
        source: 'cache'
      };
    }
    
    // Try BLINK if available
    if (this.blinkAvailable) {
      const blinkResult = await this.linkWithBLINK(entity.text, entityType);
      if (blinkResult) {
        await this.saveToCache(entity.text, entityType, blinkResult);
        return {
          entity: entity.text,
          type: entityType,
          ...blinkResult,
          source: 'BLINK'
        };
      }
    }
    
    // Fallback to Wikidata API
    const wikidataResult = await this.linkWithWikidata(entity.text, entityType);
    if (wikidataResult) {
      await this.saveToCache(entity.text, entityType, wikidataResult);
      return {
        entity: entity.text,
        type: entityType,
        ...wikidataResult,
        source: 'Wikidata'
      };
    }
    
    return null;
  }

  /**
   * Link entity using BLINK model
   */
  async linkWithBLINK(entityText, entityType) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(this.blinkPath, 'link_entity.py');
      const pythonProcess = spawn('python3', [
        pythonScript,
        '--entity', entityText,
        '--type', entityType
      ]);
      
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
          console.error(`BLINK linking failed: ${stderr}`);
          resolve(null);
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          resolve({
            qid: result.wikidata_id,
            label: result.label,
            description: result.description,
            confidence: result.confidence || 0.8
          });
        } catch (error) {
          console.error('Failed to parse BLINK output:', error);
          resolve(null);
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.error('Failed to spawn BLINK process:', error);
        resolve(null);
      });
    });
  }

  /**
   * Link entity using Wikidata API
   */
  async linkWithWikidata(entityText, entityType) {
    try {
      // Search for entity
      const searchUrl = `${this.wikidataEndpoint}?action=wbsearchentities` +
        `&search=${encodeURIComponent(entityText)}` +
        `&language=en&format=json&limit=5`;
      
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      
      if (!searchData.search || searchData.search.length === 0) {
        return null;
      }
      
      // Find best match based on entity type
      let bestMatch = null;
      let bestScore = 0;
      
      for (const result of searchData.search) {
        const score = await this.scoreWikidataMatch(result, entityText, entityType);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = result;
        }
      }
      
      if (bestMatch && bestScore > 0.5) {
        return {
          qid: bestMatch.id,
          label: bestMatch.label,
          description: bestMatch.description,
          confidence: bestScore
        };
      }
      
      return null;
    } catch (error) {
      console.error('Wikidata API error:', error);
      return null;
    }
  }

  /**
   * Score Wikidata match based on entity type and description
   */
  async scoreWikidataMatch(wikidataItem, entityText, entityType) {
    let score = 0;
    
    // Exact label match
    if (wikidataItem.label.toLowerCase() === entityText.toLowerCase()) {
      score += 0.5;
    } else {
      // Partial match
      const labelSimilarity = this.calculateStringSimilarity(
        wikidataItem.label.toLowerCase(),
        entityText.toLowerCase()
      );
      score += labelSimilarity * 0.3;
    }
    
    // Check description for entity type keywords
    const description = (wikidataItem.description || '').toLowerCase();
    
    const typeKeywords = {
      'person': ['person', 'politician', 'leader', 'general', 'president', 'minister'],
      'organization': ['organization', 'company', 'group', 'party', 'military', 'government'],
      'location': ['city', 'country', 'region', 'capital', 'town', 'province', 'state'],
      'facility': ['facility', 'building', 'airport', 'port', 'base', 'hospital']
    };
    
    const keywords = typeKeywords[entityType] || [];
    for (const keyword of keywords) {
      if (description.includes(keyword)) {
        score += 0.2;
        break;
      }
    }
    
    // Boost score for aliases match
    if (wikidataItem.aliases) {
      for (const alias of wikidataItem.aliases) {
        if (alias.toLowerCase() === entityText.toLowerCase()) {
          score += 0.3;
          break;
        }
      }
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate string similarity (Jaccard index)
   */
  calculateStringSimilarity(str1, str2) {
    const set1 = new Set(str1.split(/\s+/));
    const set2 = new Set(str2.split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Normalize entity type
   */
  normalizeEntityType(type) {
    return this.entityTypes[type?.toUpperCase()] || 'unknown';
  }

  /**
   * Save entity link to cache
   */
  async saveToCache(entityText, entityType, linkData) {
    const cacheKey = `${entityText}:${entityType}`;
    this.cache.set(cacheKey, linkData);
    
    try {
      await this.supabase
        .from('entity_wikidata_cache')
        .upsert({
          entity_text: entityText,
          entity_type: entityType,
          wikidata_qid: linkData.qid,
          label: linkData.label,
          description: linkData.description,
          confidence: linkData.confidence,
          last_verified: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to save entity link to cache:', error);
    }
  }

  /**
   * Get entity information from Wikidata
   */
  async getEntityInfo(qid) {
    try {
      const url = `${this.wikidataEndpoint}?action=wbgetentities` +
        `&ids=${qid}&languages=en&format=json`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.entities && data.entities[qid]) {
        const entity = data.entities[qid];
        return {
          qid: qid,
          label: entity.labels?.en?.value,
          description: entity.descriptions?.en?.value,
          aliases: entity.aliases?.en?.map(a => a.value),
          claims: entity.claims
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get entity info:', error);
      return null;
    }
  }

  /**
   * Link entities in a text using context
   */
  async linkEntitiesWithContext(text, entities) {
    // Group entities by type for batch processing
    const entityGroups = {};
    entities.forEach(entity => {
      const type = this.normalizeEntityType(entity.type);
      if (!entityGroups[type]) {
        entityGroups[type] = [];
      }
      entityGroups[type].push(entity);
    });
    
    // Process each group with context
    const results = [];
    
    for (const [type, group] of Object.entries(entityGroups)) {
      // Create context string
      const context = text.substring(0, 500); // Use first 500 chars as context
      
      for (const entity of group) {
        const linkedEntity = await this.linkSingleEntity(entity);
        if (linkedEntity) {
          // Adjust confidence based on context
          if (context.includes(linkedEntity.description?.split(' ')[0])) {
            linkedEntity.confidence = Math.min(linkedEntity.confidence * 1.2, 1.0);
          }
          results.push(linkedEntity);
        }
      }
    }
    
    return results;
  }

  /**
   * Create BLINK linking script if not exists
   */
  async createBLINKScript() {
    const scriptPath = path.join(this.blinkPath, 'link_entity.py');
    const scriptContent = `#!/usr/bin/env python3
"""
BLINK Entity Linking Script
Links entities to Wikidata using BLINK model
"""

import sys
import json
import argparse
from blink.main_dense import load_models, run

def link_entity(entity_text, entity_type):
    # This is a placeholder - actual BLINK integration would go here
    # For now, return a mock result
    return {
        "wikidata_id": "Q12345",
        "label": entity_text,
        "description": f"Mock {entity_type} entity",
        "confidence": 0.75
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--entity', required=True, help='Entity text to link')
    parser.add_argument('--type', required=True, help='Entity type')
    args = parser.parse_args()
    
    result = link_entity(args.entity, args.type)
    print(json.dumps(result))

if __name__ == '__main__':
    main()
`;
    
    try {
      const fs = await import('fs/promises');
      await fs.mkdir(path.dirname(scriptPath), { recursive: true });
      await fs.writeFile(scriptPath, scriptContent);
      await fs.chmod(scriptPath, '755');
    } catch (error) {
      console.error('Failed to create BLINK script:', error);
    }
  }
}

// Export singleton instance
export const entityLinker = new EntityLinker();

// Export main function
export async function linkEntities(namedEntities) {
  return entityLinker.linkEntities(namedEntities);
}

export default EntityLinker;