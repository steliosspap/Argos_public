/**
 * OSINT Pipeline Configuration
 * Central configuration management for all pipeline components
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - check multiple locations
dotenv.config({ path: path.join(__dirname, '../../.env.local') }); // osint-ingestion/.env.local
dotenv.config({ path: path.join(__dirname, '../../../.env.local') }); // osint_app/.env.local
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

export const config = {
  // Application settings
  app: {
    name: 'OSINT Conflict Pipeline',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    debug: process.env.DEBUG === 'true'
  },

  // Database settings
  database: {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  },

  // External APIs
  apis: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      maxTokens: 2000,
      temperature: 0.3
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
      searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
      translateApiKey: process.env.GOOGLE_TRANSLATE_API_KEY
    },
    newsapi: {
      apiKey: process.env.NEWSAPI_KEY
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY
    }
  },

  // Ingestion settings
  ingestion: {
    batchSize: 50,
    maxConcurrentRequests: 10,
    retryAttempts: 3,
    retryDelay: 5000,
    deduplicationWindow: 24 * 60 * 60 * 1000, // 24 hours in ms
    
    // Source priorities
    sourcePriorities: {
      'institutional': 1.0,
      'news_api': 0.8,
      'rss': 0.6,
      'social': 0.4,
      'web_scrape': 0.3
    }
  },

  // Processing settings
  processing: {
    minRelevanceScore: 0.3,
    minConfidenceScore: 0.5,
    maxArticleAge: 72 * 60 * 60 * 1000, // 72 hours in ms
    
    // Event detection thresholds
    eventDetection: {
      minKeywordMatches: 2,
      minEntityCount: 1,
      minSeverityScore: 2
    },
    
    // Deduplication settings
    deduplication: {
      similarityThreshold: 0.8,
      temporalWindow: 6 * 60 * 60 * 1000, // 6 hours in ms
      geospatialRadius: 50 // km
    }
  },

  // Source reliability defaults
  reliability: {
    initialScore: 0.5,
    decayFactor: 0.95,
    minScore: 0.1,
    maxScore: 0.9,
    
    // Bias categories
    biasCategories: {
      farLeft: -1.0,
      left: -0.5,
      centerLeft: -0.25,
      center: 0,
      centerRight: 0.25,
      right: 0.5,
      farRight: 1.0
    }
  },

  // Alert settings
  alerts: {
    enabled: process.env.ALERTS_ENABLED === 'true',
    minAlertScore: parseInt(process.env.MIN_ALERT_SCORE || '7'),
    slackWebhook: process.env.SLACK_WEBHOOK_URL,
    alertEmail: process.env.ALERT_EMAIL
  },

  // Conflict zones and search queries
  conflictZones: {
    active: [
      { name: 'Ukraine-Russia', countries: ['Ukraine', 'Russia'], priority: 'critical' },
      { name: 'Israel-Palestine', countries: ['Israel', 'Palestine', 'Gaza'], priority: 'critical' },
      { name: 'Syria', countries: ['Syria'], priority: 'high' },
      { name: 'Yemen', countries: ['Yemen', 'Saudi Arabia'], priority: 'high' },
      { name: 'Myanmar', countries: ['Myanmar'], priority: 'medium' },
      { name: 'Sudan', countries: ['Sudan'], priority: 'medium' },
      { name: 'Ethiopia', countries: ['Ethiopia'], priority: 'medium' }
    ],
    
    monitoring: [
      { name: 'Taiwan Strait', countries: ['Taiwan', 'China'], priority: 'high' },
      { name: 'Kashmir', countries: ['India', 'Pakistan'], priority: 'medium' },
      { name: 'South China Sea', countries: ['China', 'Philippines', 'Vietnam'], priority: 'medium' },
      { name: 'Armenia-Azerbaijan', countries: ['Armenia', 'Azerbaijan'], priority: 'low' }
    ]
  },

  // Search query templates
  searchTemplates: {
    breaking: [
      '{location} {actor} attack breaking news',
      '{location} military operations latest',
      '{location} casualties reported today',
      '{location} ceasefire violation {date}'
    ],
    
    analysis: [
      '{location} conflict analysis {date}',
      '{actor} military strategy {location}',
      '{location} humanitarian crisis update',
      '{location} diplomatic efforts latest'
    ],
    
    specific: [
      '{location} missile strike {date}',
      '{location} drone attack today',
      '{location} artillery shelling latest',
      '{location} civilian casualties {date}'
    ]
  },

  // NLP settings
  nlp: {
    // Conflict indicators
    conflictKeywords: [
      // Military actions
      'attack', 'strike', 'bombing', 'airstrike', 'missile', 'rocket',
      'shelling', 'artillery', 'gunfire', 'explosion', 'blast',
      
      // Casualties
      'killed', 'dead', 'wounded', 'injured', 'casualties', 'victims',
      
      // Military terms
      'military', 'army', 'forces', 'troops', 'soldiers', 'fighters',
      'militia', 'insurgents', 'rebels', 'terrorists',
      
      // Conflict terms
      'war', 'conflict', 'battle', 'fighting', 'combat', 'clashes',
      'operation', 'offensive', 'invasion', 'occupation',
      
      // Other indicators
      'ceasefire', 'truce', 'peace', 'negotiation', 'sanctions',
      'refugee', 'displaced', 'evacuation', 'humanitarian'
    ],
    
    // Entity types
    entityTypes: [
      'PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'TIME',
      'WEAPON', 'MILITARY_UNIT', 'CASUALTY_COUNT'
    ],
    
    // Temporal expressions
    temporalExpressions: [
      'today', 'yesterday', 'tomorrow', 'this morning', 'tonight',
      'last night', 'this week', 'last week', 'recently', 'earlier',
      'now', 'currently', 'ongoing', 'breaking', 'latest'
    ]
  },

  // Performance settings
  performance: {
    maxMemoryUsage: 2048, // MB
    gcInterval: 60000, // 1 minute
    metricsInterval: 300000, // 5 minutes
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};

// Validate configuration
export function validateConfig() {
  const required = [
    'database.supabase.url',
    'database.supabase.serviceKey',
    'apis.openai.apiKey'
  ];

  const missing = [];
  for (const path of required) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], config);
    if (!value) {
      missing.push(path);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }

  return true;
}

export default config;