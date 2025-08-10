/**
 * Enhanced Geospatial Service
 * Integrates osint-geo-extractor and provides advanced location resolution
 */

import fetch from 'node-fetch';
import { config } from '../core/config.js';
import { GeospatialService } from './GeospatialService.js';

// Import osint-geo-extractor components
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class EnhancedGeospatialService extends GeospatialService {
  constructor() {
    super();
    
    // Enhanced location mappings for conflict zones
    this.enhancedMappings = {
      // Gaza specific locations
      'shifa hospital': { lat: 31.5214, lng: 34.4456, country: 'Palestine', confidence: 0.9 },
      'al-shifa hospital': { lat: 31.5214, lng: 34.4456, country: 'Palestine', confidence: 0.9 },
      'rafah': { lat: 31.2969, lng: 34.2448, country: 'Palestine', confidence: 0.85 },
      'rafah crossing': { lat: 31.2528, lng: 34.2514, country: 'Palestine', confidence: 0.95 },
      'khan yunis': { lat: 31.3444, lng: 34.3063, country: 'Palestine', confidence: 0.85 },
      'jabalia': { lat: 31.5272, lng: 34.4833, country: 'Palestine', confidence: 0.85 },
      'beit hanoun': { lat: 31.5383, lng: 34.5375, country: 'Palestine', confidence: 0.85 },
      'deir al-balah': { lat: 31.4175, lng: 34.3514, country: 'Palestine', confidence: 0.85 },
      
      // Ukraine specific locations
      'bakhmut': { lat: 48.5943, lng: 37.9998, country: 'Ukraine', confidence: 0.9 },
      'severodonetsk': { lat: 48.9482, lng: 38.4920, country: 'Ukraine', confidence: 0.9 },
      'avdiivka': { lat: 48.1393, lng: 37.7422, country: 'Ukraine', confidence: 0.9 },
      'pokrovsk': { lat: 48.2821, lng: 37.1756, country: 'Ukraine', confidence: 0.9 },
      'kupiansk': { lat: 49.7104, lng: 37.6147, country: 'Ukraine', confidence: 0.9 },
      
      // Common military/conflict terms with locations
      'gaza city': { lat: 31.5, lng: 34.467, country: 'Palestine', confidence: 0.8 },
      'gaza strip': { lat: 31.3547, lng: 34.3088, country: 'Palestine', confidence: 0.7 },
      'northern gaza': { lat: 31.55, lng: 34.52, country: 'Palestine', confidence: 0.6 },
      'southern gaza': { lat: 31.25, lng: 34.25, country: 'Palestine', confidence: 0.6 },
      'eastern ukraine': { lat: 48.5, lng: 38.0, country: 'Ukraine', confidence: 0.5 },
      'donbas': { lat: 48.0, lng: 38.0, country: 'Ukraine', confidence: 0.6 },
      
      // Fix country coordinates
      'palestine': { lat: 31.9522, lng: 35.2332, country: 'Palestine', confidence: 0.7 },
      'israel': { lat: 31.0461, lng: 34.8516, country: 'Israel', confidence: 0.7 },
      'ukraine': { lat: 48.3794, lng: 31.1656, country: 'Ukraine', confidence: 0.7 },
      'syria': { lat: 34.8021, lng: 38.9968, country: 'Syria', confidence: 0.7 },
      'iran': { lat: 32.4279, lng: 53.6880, country: 'Iran', confidence: 0.7 },
      'iraq': { lat: 33.2232, lng: 43.6793, country: 'Iraq', confidence: 0.7 },
      'yemen': { lat: 15.5527, lng: 48.5164, country: 'Yemen', confidence: 0.7 },
    };
    
    // Cache for osint-geo-extractor data
    this.osintDataCache = null;
    this.osintDataTimestamp = null;
    this.osintCacheDuration = 3600000; // 1 hour
    
    // Coordinate confidence levels
    this.confidenceLevels = {
      VERIFIED: 1.0,      // Matched with osint-geo-extractor
      SPECIFIC: 0.9,      // Specific landmark/building
      NEIGHBORHOOD: 0.7,  // City + district
      CITY: 0.5,          // City level only
      REGION: 0.3         // Region/country only
    };
  }

  /**
   * Load verified events from osint-geo-extractor
   */
  async loadOsintData() {
    // Check cache
    if (this.osintDataCache && this.osintDataTimestamp && 
        (Date.now() - this.osintDataTimestamp) < this.osintCacheDuration) {
      return this.osintDataCache;
    }

    try {
      // For now, return empty array until Python integration is set up
      // TODO: Enable this once Python environment is configured
      /*
      const scriptPath = path.join(__dirname, '../lib/osint-geo-extractor/extract_all.py');
      const result = execSync(`python3 ${scriptPath}`, { encoding: 'utf8' });
      
      const events = JSON.parse(result);
      this.osintDataCache = events;
      this.osintDataTimestamp = Date.now();
      
      return events;
      */
      
      // Temporary: Return empty array
      return [];
    } catch (error) {
      console.error('Error loading osint-geo-extractor data:', error);
      return [];
    }
  }

  /**
   * Find matching verified event from osint sources
   */
  async findVerifiedEvent(text, date) {
    const osintData = await this.loadOsintData();
    
    // Normalize text for comparison
    const normalizedText = text.toLowerCase();
    const eventDate = new Date(date);
    
    // Find best match based on text similarity and date proximity
    let bestMatch = null;
    let bestScore = 0;
    
    for (const event of osintData) {
      // Date proximity score (events within 24 hours)
      const timeDiff = Math.abs(eventDate - new Date(event.date));
      const dateScore = timeDiff < 86400000 ? 0.5 : 0;
      
      // Text similarity score
      const eventText = (event.description + ' ' + event.place_desc).toLowerCase();
      const commonWords = this.getCommonWords(normalizedText, eventText);
      const textScore = commonWords.length / Math.max(normalizedText.split(' ').length, 10);
      
      const totalScore = dateScore + textScore;
      
      if (totalScore > bestScore && totalScore > 0.4) {
        bestScore = totalScore;
        bestMatch = event;
      }
    }
    
    return bestMatch;
  }

  /**
   * Extract all location mentions from text
   */
  extractLocationMentions(text) {
    const locations = [];
    const normalizedText = text.toLowerCase();
    
    // Check for enhanced mappings
    for (const [location, data] of Object.entries(this.enhancedMappings)) {
      if (normalizedText.includes(location)) {
        locations.push({
          text: location,
          ...data
        });
      }
    }
    
    // Check for base mappings
    for (const [location, data] of Object.entries(this.locationMappings)) {
      if (normalizedText.includes(location)) {
        locations.push({
          text: location,
          ...data,
          confidence: data.confidence || 0.7
        });
      }
    }
    
    // Parse relative locations (e.g., "10km north of Gaza")
    const relativePattern = /(\d+)\s*km\s*(north|south|east|west|northeast|northwest|southeast|southwest)\s*of\s*([a-z\s]+)/gi;
    const relativeMatches = [...normalizedText.matchAll(relativePattern)];
    
    for (const match of relativeMatches) {
      const distance = parseInt(match[1]);
      const direction = match[2];
      const place = match[3].trim();
      
      // Find base location
      const baseLocation = this.findLocation(place);
      if (baseLocation) {
        const adjusted = this.adjustCoordinates(baseLocation, direction, distance);
        locations.push({
          text: match[0],
          ...adjusted,
          confidence: baseLocation.confidence * 0.8
        });
      }
    }
    
    // Sort by confidence
    return locations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Resolve location with enhanced accuracy
   */
  async resolveLocation(locationText, eventText = null, eventDate = null) {
    if (!locationText) {
      return null;
    }
    
    const normalized = locationText.toLowerCase().trim();
    
    // First, check if we have a verified event match
    if (eventText && eventDate) {
      const verifiedEvent = await this.findVerifiedEvent(eventText, eventDate);
      if (verifiedEvent) {
        console.log(`Found verified coordinates for event: ${verifiedEvent.place_desc}`);
        return `POINT(${verifiedEvent.longitude} ${verifiedEvent.latitude})`;
      }
    }
    
    // Check enhanced mappings
    if (this.enhancedMappings[normalized]) {
      const location = this.enhancedMappings[normalized];
      return `POINT(${location.lng} ${location.lat})`;
    }
    
    // Check base mappings
    if (this.locationMappings[normalized]) {
      const location = this.locationMappings[normalized];
      return `POINT(${location.lng} ${location.lat})`;
    }
    
    // Extract all location mentions from the text
    const mentions = this.extractLocationMentions(locationText);
    if (mentions.length > 0) {
      const best = mentions[0];
      return `POINT(${best.lng} ${best.lat})`;
    }
    
    // Check cache
    if (this.geocodingCache.has(normalized)) {
      return this.geocodingCache.get(normalized);
    }
    
    // Fall back to geocoding API
    try {
      const coords = await this.geocodeLocation(locationText);
      if (coords) {
        const wkt = `POINT(${coords.lng} ${coords.lat})`;
        this.geocodingCache.set(normalized, wkt);
        return wkt;
      }
    } catch (error) {
      console.error(`Geocoding error for ${locationText}:`, error);
    }
    
    return null;
  }

  /**
   * Get confidence score for coordinates
   */
  getCoordinateConfidence(locationText, verifiedMatch = false) {
    if (verifiedMatch) return this.confidenceLevels.VERIFIED;
    
    const normalized = locationText.toLowerCase();
    
    // Check for specific landmarks
    if (normalized.includes('hospital') || normalized.includes('crossing') || 
        normalized.includes('airport') || normalized.includes('base')) {
      return this.confidenceLevels.SPECIFIC;
    }
    
    // Check for neighborhood/district mentions
    if (normalized.includes('northern') || normalized.includes('southern') ||
        normalized.includes('district') || normalized.includes('neighborhood')) {
      return this.confidenceLevels.NEIGHBORHOOD;
    }
    
    // City level
    if (this.locationMappings[normalized] || this.enhancedMappings[normalized]) {
      return this.confidenceLevels.CITY;
    }
    
    return this.confidenceLevels.REGION;
  }

  /**
   * Helper: Get common words between two texts
   */
  getCommonWords(text1, text2) {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    return [...words1].filter(word => words2.has(word) && word.length > 3);
  }

  /**
   * Helper: Find location in mappings
   */
  findLocation(place) {
    const normalized = place.toLowerCase().trim();
    return this.enhancedMappings[normalized] || 
           this.locationMappings[normalized] || 
           null;
  }

  /**
   * Helper: Adjust coordinates based on direction and distance
   */
  adjustCoordinates(baseLocation, direction, distanceKm) {
    // Rough approximation: 1 degree latitude = 111km
    const latPerKm = 1 / 111;
    const lngPerKm = 1 / (111 * Math.cos(baseLocation.lat * Math.PI / 180));
    
    const adjustments = {
      'north': { lat: distanceKm * latPerKm, lng: 0 },
      'south': { lat: -distanceKm * latPerKm, lng: 0 },
      'east': { lat: 0, lng: distanceKm * lngPerKm },
      'west': { lat: 0, lng: -distanceKm * lngPerKm },
      'northeast': { lat: distanceKm * latPerKm * 0.707, lng: distanceKm * lngPerKm * 0.707 },
      'northwest': { lat: distanceKm * latPerKm * 0.707, lng: -distanceKm * lngPerKm * 0.707 },
      'southeast': { lat: -distanceKm * latPerKm * 0.707, lng: distanceKm * lngPerKm * 0.707 },
      'southwest': { lat: -distanceKm * latPerKm * 0.707, lng: -distanceKm * lngPerKm * 0.707 }
    };
    
    const adj = adjustments[direction] || { lat: 0, lng: 0 };
    
    return {
      lat: baseLocation.lat + adj.lat,
      lng: baseLocation.lng + adj.lng,
      country: baseLocation.country,
      confidence: baseLocation.confidence
    };
  }
}

export default EnhancedGeospatialService;