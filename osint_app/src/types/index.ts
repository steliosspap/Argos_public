export interface Conflict {
  id: string;
  name: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  conflictType: 'border' | 'civil_war' | 'occupation' | 'insurgency' | 'territorial_dispute' | 'other';
  status: 'active' | 'ceasefire' | 'resolved';
  description: string;
  lastUpdated: string;
  casualties?: number;
  startDate: string;
  escalation_score?: number;
}

export interface ArmsDeal {
  id: string;
  date: string;
  buyerCountry: string;
  sellerCountry?: string;
  sellerCompany?: string;
  weaponSystem: string;
  dealValue: number;
  currency: string;
  sourceLink?: string;
  description?: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

export interface NewsItem {
  id: string;
  headline: string;
  title: string; // Add title as it's used in the UI
  source: string;
  region?: string;
  country?: string;
  date: string;
  url?: string;
  summary?: string;
  tags: string[];
  escalation_score?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  created_at?: string;
  updated_at?: string;
  // Bias and verification fields
  bias_score?: number;
  verification_status?: 'verified' | 'partially-verified' | 'disputed' | 'unverified';
  has_analysis?: boolean;
}

export interface AdminUser {
  id: string;
  username: string;
  role: 'admin' | 'editor';
}

// Phase 1: Conflict Events for real-time monitoring
export interface ConflictEvent {
  id: string;
  timestamp: string;
  lat: number;
  lng: number;
  summary: string;
  event_type: string;
  reliability: number; // 1-10
  severity: 'low' | 'medium' | 'high' | 'critical';
  source_type: string;
  affiliation?: string;
  escalation_score?: number; // 0-10
  country?: string;
  region?: string;
  created_at: string;
  updated_at: string;
}

// Filter interfaces for Phase 1
export interface LocationFilter {
  countries: string[];
  regions: string[];
  boundingBox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface EventFilters {
  location: LocationFilter;
  keyword: string;
  eventTypes: string[];
  severityLevels: string[];
  escalationRange: {
    min: number;
    max: number;
  };
}

// OSINT Event for map display
export interface Event {
  id: string;
  title: string;
  summary: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  country: string;
  region: string;
  timestamp: string;
  channel: string;
  reliability: number;
  escalation_score?: number; // Event severity level (1-10)
  event_classifier: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  source_url?: string;
  source_urls?: string[]; // Multiple sources for corroboration
  created_at: string;
  // Bias and verification fields
  bias_score?: number; // -5 to +5
  verification_status?: 'verified' | 'partially-verified' | 'disputed' | 'unverified';
  has_analysis?: boolean;
  // Additional fields for news
  city?: string;
  event_type?: string;
  tags?: string[];
}