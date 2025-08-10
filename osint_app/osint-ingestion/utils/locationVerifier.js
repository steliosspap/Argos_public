/**
 * Location Verifier
 * Ensures location extraction is accurate and coordinates match the country
 */

import debug from 'debug';

const log = debug('osint:utils:locationVerifier');

// Known coordinates for ambiguous cities
const CITY_COORDINATES = {
  tripoli: {
    lebanon: { lat: 34.4346, lng: 35.8362 },
    libya: { lat: 32.8872, lng: 13.1913 }
  },
  alexandria: {
    egypt: { lat: 31.2001, lng: 29.9187 },
    'united states': { lat: 38.8048, lng: -77.0469 }
  },
  valencia: {
    spain: { lat: 39.4699, lng: -0.3763 },
    venezuela: { lat: 10.1620, lng: -68.0077 }
  },
  cordoba: {
    spain: { lat: 37.8882, lng: -4.7794 },
    argentina: { lat: -31.4201, lng: -64.1888 }
  }
};

/**
 * Verify and correct location data
 * @param {Object} locationData - Location data from extractLocation
 * @param {string} text - Original text for additional context
 * @returns {Object} Verified location data
 */
export function verifyLocation(locationData, text) {
  if (!locationData || !locationData.city) {
    return locationData;
  }

  const cityLower = locationData.city.toLowerCase();
  const countryLower = locationData.country?.toLowerCase();
  
  // Check if this is an ambiguous city
  if (CITY_COORDINATES[cityLower]) {
    const cityCoords = CITY_COORDINATES[cityLower];
    
    // If we have coordinates for this city-country combo, verify they match
    if (countryLower && cityCoords[countryLower]) {
      const expectedCoords = cityCoords[countryLower];
      
      // Check if coordinates match (within tolerance)
      const latMatch = Math.abs(locationData.lat - expectedCoords.lat) < 0.1;
      const lngMatch = Math.abs(locationData.lng - expectedCoords.lng) < 0.1;
      
      if (!latMatch || !lngMatch) {
        log(`Correcting coordinates for ${locationData.city}, ${locationData.country}`);
        log(`  Old: [${locationData.lat}, ${locationData.lng}]`);
        log(`  New: [${expectedCoords.lat}, ${expectedCoords.lng}]`);
        
        // Return corrected location
        return {
          ...locationData,
          lat: expectedCoords.lat,
          lng: expectedCoords.lng,
          confidence: locationData.confidence,
          extraction_method: 'verified_correction'
        };
      }
    }
  }
  
  return locationData;
}

/**
 * Extract contextual clues about country from text
 * @param {string} text - Text to analyze
 * @returns {Object} Country hints found in text
 */
export function extractCountryContext(text) {
  const lowerText = text.toLowerCase();
  const context = {
    mentions: [],
    nationalities: [],
    regions: []
  };
  
  // Country mentions
  const countries = [
    'lebanon', 'libya', 'egypt', 'syria', 'israel', 'palestine', 'iran', 'iraq',
    'yemen', 'saudi arabia', 'jordan', 'turkey', 'ukraine', 'russia', 'united states',
    'spain', 'venezuela', 'argentina'
  ];
  
  countries.forEach(country => {
    if (lowerText.includes(country)) {
      context.mentions.push(country);
    }
  });
  
  // Nationality adjectives
  const nationalities = {
    'lebanese': 'lebanon',
    'libyan': 'libya',
    'egyptian': 'egypt',
    'syrian': 'syria',
    'israeli': 'israel',
    'palestinian': 'palestine',
    'iranian': 'iran',
    'iraqi': 'iraq',
    'yemeni': 'yemen',
    'saudi': 'saudi arabia',
    'jordanian': 'jordan',
    'turkish': 'turkey',
    'ukrainian': 'ukraine',
    'russian': 'russia',
    'american': 'united states',
    'spanish': 'spain',
    'venezuelan': 'venezuela',
    'argentinian': 'argentina',
    'argentine': 'argentina'
  };
  
  Object.entries(nationalities).forEach(([nationality, country]) => {
    if (lowerText.includes(nationality)) {
      context.nationalities.push(country);
    }
  });
  
  // Regional indicators
  if (lowerText.includes('northern lebanon')) context.regions.push('lebanon');
  if (lowerText.includes('southern lebanon')) context.regions.push('lebanon');
  if (lowerText.includes('eastern libya')) context.regions.push('libya');
  if (lowerText.includes('western libya')) context.regions.push('libya');
  if (lowerText.includes('hezbollah')) context.regions.push('lebanon');
  if (lowerText.includes('gaddafi') || lowerText.includes('haftar')) context.regions.push('libya');
  
  return context;
}

/**
 * Enhanced location extraction with verification
 * @param {Function} extractLocation - Original extractLocation function
 * @param {string} text - Text to extract location from
 * @returns {Object} Verified location data
 */
export function extractAndVerifyLocation(extractLocation, text) {
  // First, get the basic extraction
  const locationData = extractLocation(text);
  
  if (!locationData) {
    return null;
  }
  
  // Get additional context
  const context = extractCountryContext(text);
  
  // If we have context that conflicts with the extraction, log a warning
  if (locationData.country) {
    const countryLower = locationData.country.toLowerCase();
    const allContextCountries = [
      ...context.mentions,
      ...context.nationalities,
      ...context.regions
    ];
    
    if (allContextCountries.length > 0 && !allContextCountries.includes(countryLower)) {
      log(`Warning: Extracted country (${locationData.country}) doesn't match context (${allContextCountries.join(', ')})`);
    }
  }
  
  // Verify and potentially correct the location
  return verifyLocation(locationData, text);
}

export default {
  verifyLocation,
  extractCountryContext,
  extractAndVerifyLocation
};