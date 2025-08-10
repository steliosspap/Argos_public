/**
 * Geospatial Service
 * Handles location resolution and geographic operations
 */

import fetch from 'node-fetch';
import { config } from '../core/config.js';

export class GeospatialService {
  constructor() {
    this.geocodingCache = new Map();
    
    // Common location mappings
    this.locationMappings = {
      // Ukraine conflict
      'kyiv': { lat: 50.4501, lng: 30.5234, country: 'Ukraine' },
      'kiev': { lat: 50.4501, lng: 30.5234, country: 'Ukraine' },
      'kharkiv': { lat: 49.9935, lng: 36.2304, country: 'Ukraine' },
      'mariupol': { lat: 47.0951, lng: 37.5434, country: 'Ukraine' },
      'donetsk': { lat: 48.0159, lng: 37.8028, country: 'Ukraine' },
      'luhansk': { lat: 48.5740, lng: 39.3078, country: 'Ukraine' },
      'crimea': { lat: 45.0000, lng: 34.0000, country: 'Ukraine' },
      'odessa': { lat: 46.4825, lng: 30.7233, country: 'Ukraine' },
      'zaporizhzhia': { lat: 47.8388, lng: 35.1396, country: 'Ukraine' },
      
      // Israel-Palestine
      'gaza': { lat: 31.3547, lng: 34.3088, country: 'Palestine' },
      'gaza strip': { lat: 31.3547, lng: 34.3088, country: 'Palestine' },
      'tel aviv': { lat: 32.0853, lng: 34.7818, country: 'Israel' },
      'jerusalem': { lat: 31.7683, lng: 35.2137, country: 'Israel' },
      'west bank': { lat: 32.0000, lng: 35.2500, country: 'Palestine' },
      'ramallah': { lat: 31.9038, lng: 35.2034, country: 'Palestine' },
      
      // Syria
      'damascus': { lat: 33.5138, lng: 36.2765, country: 'Syria' },
      'aleppo': { lat: 36.2021, lng: 37.1343, country: 'Syria' },
      'idlib': { lat: 35.9308, lng: 36.6418, country: 'Syria' },
      'homs': { lat: 34.7308, lng: 36.7236, country: 'Syria' },
      
      // Other conflict zones
      'moscow': { lat: 55.7558, lng: 37.6173, country: 'Russia' },
      'beirut': { lat: 33.8938, lng: 35.5018, country: 'Lebanon' },
      'baghdad': { lat: 33.3152, lng: 44.3661, country: 'Iraq' },
      'kabul': { lat: 34.5553, lng: 69.2075, country: 'Afghanistan' },
      'sana\'a': { lat: 15.3694, lng: 44.1910, country: 'Yemen' },
      'sanaa': { lat: 15.3694, lng: 44.1910, country: 'Yemen' },
      'khartoum': { lat: 15.5007, lng: 32.5599, country: 'Sudan' },
      'addis ababa': { lat: 8.9806, lng: 38.7578, country: 'Ethiopia' },
      'yangon': { lat: 16.8661, lng: 96.1951, country: 'Myanmar' },
      'taipei': { lat: 25.0330, lng: 121.5654, country: 'Taiwan' }
    };
  }

  /**
   * Resolve location name to coordinates
   */
  async resolveLocation(locationName) {
    if (!locationName) return null;
    
    const normalized = locationName.toLowerCase().trim();
    
    // Check cache
    if (this.geocodingCache.has(normalized)) {
      return this.geocodingCache.get(normalized);
    }
    
    // Check known mappings
    if (this.locationMappings[normalized]) {
      const mapping = this.locationMappings[normalized];
      const wkt = `POINT(${mapping.lng} ${mapping.lat})`;
      this.geocodingCache.set(normalized, wkt);
      return wkt;
    }
    
    // Try geocoding service (if available)
    try {
      const coords = await this.geocodeLocation(locationName);
      if (coords) {
        const wkt = `POINT(${coords.lng} ${coords.lat})`;
        this.geocodingCache.set(normalized, wkt);
        return wkt;
      }
    } catch (error) {
      console.error(`Geocoding error for ${locationName}:`, error.message);
    }
    
    return null;
  }

  /**
   * Geocode location using external service
   */
  async geocodeLocation(locationName) {
    // Option 1: Use Nominatim (OpenStreetMap)
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'OSINT Pipeline/1.0'
        }
      });
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name
        };
      }
    } catch (error) {
      console.error('Nominatim error:', error);
    }
    
    // Option 2: Use Google Geocoding API (if configured)
    if (config.apis.google.apiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationName)}&key=${config.apis.google.apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'OK' && data.results.length > 0) {
          const location = data.results[0].geometry.location;
          return {
            lat: location.lat,
            lng: location.lng,
            displayName: data.results[0].formatted_address
          };
        }
      } catch (error) {
        console.error('Google Geocoding error:', error);
      }
    }
    
    return null;
  }

  /**
   * Get administrative hierarchy for coordinates
   */
  async getAdministrativeHierarchy(wktPoint) {
    // Parse WKT to get coordinates
    const match = wktPoint.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    if (!match) return {};
    
    const lng = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    
    // Find country from known locations
    for (const [location, data] of Object.entries(this.locationMappings)) {
      const distance = this.calculateDistance(lat, lng, data.lat, data.lng);
      if (distance < 50) { // Within 50km
        return {
          country: data.country,
          region: data.region || null,
          admin_level_1: null,
          admin_level_2: null
        };
      }
    }
    
    // Could use reverse geocoding service here
    return {
      country: 'Unknown',
      region: null,
      admin_level_1: null,
      admin_level_2: null
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if two locations are nearby
   */
  areLocationsNearby(wkt1, wkt2, radiusKm = 50) {
    if (!wkt1 || !wkt2) return false;
    
    const coords1 = this.parseWKTPoint(wkt1);
    const coords2 = this.parseWKTPoint(wkt2);
    
    if (!coords1 || !coords2) return false;
    
    const distance = this.calculateDistance(
      coords1.lat, coords1.lng,
      coords2.lat, coords2.lng
    );
    
    return distance <= radiusKm;
  }

  /**
   * Parse WKT point to coordinates
   */
  parseWKTPoint(wkt) {
    const match = wkt.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    if (!match) return null;
    
    return {
      lng: parseFloat(match[1]),
      lat: parseFloat(match[2])
    };
  }

  /**
   * Create bounding box around point
   */
  createBoundingBox(lat, lng, radiusKm) {
    const latChange = radiusKm / 111.2; // Rough conversion
    const lngChange = radiusKm / (111.2 * Math.cos(this.toRadians(lat)));
    
    return {
      minLat: lat - latChange,
      maxLat: lat + latChange,
      minLng: lng - lngChange,
      maxLng: lng + lngChange
    };
  }

  /**
   * Get conflict zone for location
   */
  getConflictZone(locationName, country) {
    const searchText = `${locationName} ${country}`.toLowerCase();
    
    // Check active conflict zones
    for (const zone of config.conflictZones.active) {
      if (zone.countries.some(c => searchText.includes(c.toLowerCase()))) {
        return {
          name: zone.name,
          priority: zone.priority,
          isActive: true
        };
      }
    }
    
    // Check monitoring zones
    for (const zone of config.conflictZones.monitoring) {
      if (zone.countries.some(c => searchText.includes(c.toLowerCase()))) {
        return {
          name: zone.name,
          priority: zone.priority,
          isActive: false
        };
      }
    }
    
    return null;
  }

  /**
   * Format location for display
   */
  formatLocation(locationName, country, region) {
    const parts = [];
    
    if (locationName && locationName !== country) {
      parts.push(locationName);
    }
    
    if (region && region !== locationName && region !== country) {
      parts.push(region);
    }
    
    if (country) {
      parts.push(country);
    }
    
    return parts.join(', ');
  }

  /**
   * Normalize country names
   */
  normalizeCountry(country) {
    const mappings = {
      'usa': 'United States',
      'us': 'United States',
      'america': 'United States',
      'uk': 'United Kingdom',
      'britain': 'United Kingdom',
      'uae': 'United Arab Emirates',
      'dprk': 'North Korea',
      'rok': 'South Korea',
      'prc': 'China'
    };
    
    const normalized = country.toLowerCase().trim();
    return mappings[normalized] || country;
  }

  /**
   * Extract location from text
   */
  extractLocationFromText(text) {
    // Look for location patterns
    const patterns = [
      /\bin\s+([A-Z][a-zA-Z\s-]+)(?:,\s*([A-Z][a-zA-Z\s-]+))?\b/,
      /\bat\s+([A-Z][a-zA-Z\s-]+)(?:,\s*([A-Z][a-zA-Z\s-]+))?\b/,
      /\bnear\s+([A-Z][a-zA-Z\s-]+)(?:,\s*([A-Z][a-zA-Z\s-]+))?\b/,
      /([A-Z][a-zA-Z\s-]+),\s*([A-Z][a-zA-Z\s-]+)/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          primary: match[1].trim(),
          secondary: match[2]?.trim() || null
        };
      }
    }
    
    // Check for known locations
    const textLower = text.toLowerCase();
    for (const location of Object.keys(this.locationMappings)) {
      if (textLower.includes(location)) {
        return {
          primary: location,
          secondary: this.locationMappings[location].country
        };
      }
    }
    
    return null;
  }
}

export default GeospatialService;