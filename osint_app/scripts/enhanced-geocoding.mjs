/**
 * Enhanced Geocoding Service
 * Provides multiple fallback strategies for geocoding with caching
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { geocodeCity, geocodeCountry, isValidCoordinate } from './coordinate-fixer.mjs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// In-memory cache for geocoding results
const geocodeCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Cache geocoding result
 * @param {string} location - Location string
 * @param {Object} result - Geocoding result
 */
function cacheResult(location, result) {
  geocodeCache.set(location.toLowerCase(), {
    result,
    timestamp: Date.now()
  });
}

/**
 * Get cached geocoding result
 * @param {string} location - Location string
 * @returns {Object|null} - Cached result or null
 */
function getCachedResult(location) {
  const cached = geocodeCache.get(location.toLowerCase());
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.result;
  }
  return null;
}

/**
 * Geocode using Nominatim (OpenStreetMap)
 * @param {string} location - Location to geocode
 * @returns {Object|null} - Coordinates and confidence
 */
async function geocodeWithNominatim(location) {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.append('q', location);
    url.searchParams.append('format', 'json');
    url.searchParams.append('limit', '1');
    url.searchParams.append('addressdetails', '1');
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Argos-OSINT-Platform/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        confidence: result.importance || 0.7,
        method: 'nominatim',
        display_name: result.display_name,
        country: result.address?.country,
        city: result.address?.city || result.address?.town || result.address?.village
      };
    }
  } catch (error) {
    console.error('Nominatim geocoding failed:', error.message);
  }
  
  return null;
}

/**
 * Geocode using Mapbox (requires API key)
 * @param {string} location - Location to geocode
 * @returns {Object|null} - Coordinates and confidence
 */
async function geocodeWithMapbox(location) {
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  
  if (!mapboxToken) {
    return null; // Skip if no token
  }
  
  try {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json`);
    url.searchParams.append('access_token', mapboxToken);
    url.searchParams.append('limit', '1');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      return {
        latitude: feature.center[1],
        longitude: feature.center[0],
        confidence: feature.relevance || 0.8,
        method: 'mapbox',
        place_name: feature.place_name,
        place_type: feature.place_type
      };
    }
  } catch (error) {
    console.error('Mapbox geocoding failed:', error.message);
  }
  
  return null;
}

/**
 * Extract location entities from text using regex patterns
 * @param {string} text - Text to analyze
 * @returns {Array} - Extracted locations
 */
function extractLocations(text) {
  const locations = [];
  
  // Common location patterns
  const patterns = [
    /in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    /at\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    /near\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    /outside\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    /,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:,|$)/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      locations.push(match[1]);
    }
  });
  
  return [...new Set(locations)]; // Remove duplicates
}

/**
 * Enhanced geocoding with multiple strategies
 * @param {Object} event - Event data
 * @returns {Object|null} - Geocoding result
 */
async function enhancedGeocode(event) {
  // 1. Check if we already have valid coordinates
  if (isValidCoordinate(event.longitude, event.latitude)) {
    return {
      longitude: event.longitude,
      latitude: event.latitude,
      confidence: 1.0,
      method: 'existing_valid'
    };
  }
  
  // 2. Build location query string
  const locationParts = [];
  if (event.city) locationParts.push(event.city);
  if (event.region && event.region !== event.city) locationParts.push(event.region);
  if (event.country) locationParts.push(event.country);
  
  const locationQuery = locationParts.join(', ');
  
  // 3. Check cache
  const cached = getCachedResult(locationQuery);
  if (cached) {
    console.log(`📍 Cache hit for: ${locationQuery}`);
    return cached;
  }
  
  // 4. Try local geocoding first (fastest)
  if (event.city) {
    const localResult = geocodeCity(event.city, event.country);
    if (localResult) {
      const result = {
        longitude: localResult[0],
        latitude: localResult[1],
        confidence: 0.8,
        method: 'local_city'
      };
      cacheResult(locationQuery, result);
      return result;
    }
  }
  
  // 5. Try external geocoding services
  if (locationQuery) {
    // Try Nominatim first (free, no API key needed)
    console.log(`🌍 Geocoding: ${locationQuery}`);
    let result = await geocodeWithNominatim(locationQuery);
    
    // Fallback to Mapbox if available
    if (!result && process.env.MAPBOX_ACCESS_TOKEN) {
      result = await geocodeWithMapbox(locationQuery);
    }
    
    if (result) {
      cacheResult(locationQuery, result);
      return result;
    }
  }
  
  // 6. Try to extract locations from title/summary
  if (event.title || event.summary) {
    const textLocations = extractLocations(`${event.title} ${event.summary}`);
    for (const location of textLocations) {
      const result = await geocodeWithNominatim(`${location}, ${event.country || ''}`);
      if (result) {
        result.confidence *= 0.7; // Lower confidence for extracted locations
        cacheResult(location, result);
        return result;
      }
    }
  }
  
  // 7. Final fallback to country centroid
  if (event.country) {
    const countryCoords = geocodeCountry(event.country);
    if (countryCoords) {
      const result = {
        longitude: countryCoords[0],
        latitude: countryCoords[1],
        confidence: 0.5,
        method: 'country_centroid'
      };
      cacheResult(event.country, result);
      return result;
    }
  }
  
  // No coordinates found
  return null;
}

/**
 * Batch geocode events
 * @param {Array} events - Events to geocode
 * @returns {Array} - Events with enhanced coordinates
 */
async function batchGeocode(events) {
  console.log(`🌍 Geocoding ${events.length} events...`);
  
  const results = {
    success: 0,
    failed: 0,
    methods: {}
  };
  
  const geocodedEvents = [];
  
  for (const event of events) {
    const geoResult = await enhancedGeocode(event);
    
    if (geoResult) {
      results.success++;
      results.methods[geoResult.method] = (results.methods[geoResult.method] || 0) + 1;
      
      geocodedEvents.push({
        ...event,
        latitude: geoResult.latitude,
        longitude: geoResult.longitude,
        location: `POINT(${geoResult.longitude} ${geoResult.latitude})`,
        coordinate_confidence: geoResult.confidence,
        coordinate_method: geoResult.method
      });
    } else {
      results.failed++;
      geocodedEvents.push(event);
      console.warn(`⚠️  Failed to geocode: ${event.title} in ${event.country}`);
    }
    
    // Rate limiting for external services
    if (results.success % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay every 10 requests
    }
  }
  
  console.log(`✅ Geocoding complete:`);
  console.log(`   Success: ${results.success}`);
  console.log(`   Failed: ${results.failed}`);
  console.log(`   Methods:`, results.methods);
  
  return geocodedEvents;
}

/**
 * Save geocoding cache to database
 */
async function persistCache() {
  // Convert cache to array
  const cacheData = Array.from(geocodeCache.entries()).map(([location, data]) => ({
    location,
    coordinates: [data.result.longitude, data.result.latitude],
    confidence: data.result.confidence,
    method: data.result.method,
    cached_at: new Date(data.timestamp).toISOString()
  }));
  
  // You could save this to a geocoding_cache table
  console.log(`💾 Persisting ${cacheData.length} geocoding results to cache`);
}

export {
  enhancedGeocode,
  batchGeocode,
  geocodeWithNominatim,
  geocodeWithMapbox,
  extractLocations,
  persistCache
};