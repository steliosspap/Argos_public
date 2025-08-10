/**
 * Coordinate Fixing Utility
 * Validates and corrects coordinates from various formats
 */

// Major city coordinates for fallback geocoding
const CITY_COORDINATES = {
  // Ukraine
  'kyiv': [30.5234, 50.4501],
  'kiev': [30.5234, 50.4501],
  'kharkiv': [36.2304, 49.9935],
  'odesa': [30.7233, 46.4825],
  'odessa': [30.7233, 46.4825],
  'dnipro': [35.0462, 48.4647],
  'zaporizhzhia': [35.1396, 47.8388],
  'lviv': [24.0297, 49.8397],
  'mariupol': [37.5499, 47.0969],
  'donetsk': [37.8028, 48.0159],
  'luhansk': [39.3078, 48.5740],
  'crimea': [34.1025, 44.9572],
  'sevastopol': [33.5253, 44.6054],
  
  // Russia
  'moscow': [37.6173, 55.7558],
  'st petersburg': [30.3351, 59.9311],
  'saint petersburg': [30.3351, 59.9311],
  'rostov': [39.7015, 47.2357],
  'belgorod': [36.5853, 50.5955],
  'kursk': [36.1920, 51.7306],
  
  // Middle East
  'gaza': [34.4668, 31.5018],
  'gaza city': [34.4668, 31.5018],
  'jerusalem': [35.2137, 31.7683],
  'tel aviv': [34.7818, 32.0853],
  'damascus': [36.2765, 33.5138],
  'aleppo': [37.1612, 36.2021],
  'beirut': [35.5018, 33.8938],
  'baghdad': [44.3661, 33.3152],
  'tehran': [51.3890, 35.6892],
  'kabul': [69.2075, 34.5553],
  
  // Other conflict areas
  'mogadishu': [45.3182, 2.0469],
  'khartoum': [32.5599, 15.5007],
  'tripoli': [13.1913, 32.8872],
  'sana\'a': [44.2067, 15.3694],
  'sanaa': [44.2067, 15.3694],
};

// Country center coordinates for fallback
const COUNTRY_COORDINATES = {
  'ukraine': [31.1656, 48.3794],
  'russia': [37.6173, 55.7558],
  'israel': [35.2137, 31.0461],
  'palestine': [35.2226, 31.9474],
  'gaza strip': [34.4668, 31.4544],
  'west bank': [35.2626, 31.9474],
  'syria': [38.9968, 34.8021],
  'lebanon': [35.8623, 33.8547],
  'iran': [53.6880, 32.4279],
  'iraq': [43.6793, 33.2232],
  'afghanistan': [67.7100, 33.9391],
  'yemen': [48.5164, 15.5527],
  'libya': [17.2283, 26.3351],
  'somalia': [46.1996, 5.1521],
  'sudan': [30.2176, 12.8628],
  'south sudan': [31.3070, 6.8770],
  'ethiopia': [40.4897, 9.1450],
  'mali': [-3.9962, 17.5707],
  'burkina faso': [-1.5616, 12.2383],
  'niger': [8.0817, 17.6078],
  'nigeria': [8.6753, 9.0820],
  'united states': [-95.7129, 37.0902],
  'usa': [-95.7129, 37.0902],
  'china': [104.1954, 35.8617],
  'taiwan': [120.9605, 23.6978],
  'north korea': [127.5101, 40.3399],
  'south korea': [127.7669, 35.9078],
  'myanmar': [95.9560, 21.9162],
  'pakistan': [69.3451, 30.3753],
  'india': [78.9629, 20.5937],
};

/**
 * Validate if coordinates are within valid ranges
 */
function isValidCoordinate(lng, lat) {
  return (
    typeof lng === 'number' && 
    typeof lat === 'number' &&
    !isNaN(lng) && 
    !isNaN(lat) &&
    lng >= -180 && 
    lng <= 180 && 
    lat >= -90 && 
    lat <= 90 &&
    !(lng === 0 && lat === 0) // Exclude null island
  );
}

/**
 * Try to extract coordinates from various string formats
 */
function parseCoordinateString(str) {
  if (!str || typeof str !== 'string') return null;
  
  // Try POINT(lng lat) format
  const pointMatch = str.match(/POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)/i);
  if (pointMatch) {
    const lng = parseFloat(pointMatch[1]);
    const lat = parseFloat(pointMatch[2]);
    if (isValidCoordinate(lng, lat)) {
      return [lng, lat];
    }
  }
  
  // Try lat,lng or lat, lng format
  const commaMatch = str.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (commaMatch) {
    const lat = parseFloat(commaMatch[1]);
    const lng = parseFloat(commaMatch[2]);
    if (isValidCoordinate(lng, lat)) {
      return [lng, lat];
    }
    // Try swapped order
    if (isValidCoordinate(lat, lng)) {
      return [lat, lng];
    }
  }
  
  return null;
}

/**
 * Get coordinates from city name
 */
function geocodeCity(cityName, countryName) {
  if (!cityName) return null;
  
  const normalizedCity = cityName.toLowerCase().trim();
  
  // Check direct city match
  if (CITY_COORDINATES[normalizedCity]) {
    return CITY_COORDINATES[normalizedCity];
  }
  
  // Check with country prefix
  const cityWithCountry = `${normalizedCity}, ${(countryName || '').toLowerCase()}`;
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (cityWithCountry.includes(key)) {
      return coords;
    }
  }
  
  return null;
}

/**
 * Get coordinates from country name
 */
function geocodeCountry(countryName) {
  if (!countryName) return null;
  
  const normalizedCountry = countryName.toLowerCase().trim();
  return COUNTRY_COORDINATES[normalizedCountry] || null;
}

/**
 * Main function to fix coordinates
 */
function fixCoordinates(event) {
  // Check if we already have valid coordinates
  if (event.longitude !== undefined && event.latitude !== undefined) {
    if (isValidCoordinate(event.longitude, event.latitude)) {
      return {
        longitude: event.longitude,
        latitude: event.latitude,
        confidence: 1.0,
        method: 'existing_valid'
      };
    }
  }
  
  // Try to parse location string
  if (event.location) {
    const parsed = parseCoordinateString(event.location);
    if (parsed) {
      return {
        longitude: parsed[0],
        latitude: parsed[1],
        confidence: 0.9,
        method: 'parsed_string'
      };
    }
  }
  
  // Try to geocode from city
  if (event.city) {
    const cityCoords = geocodeCity(event.city, event.country);
    if (cityCoords) {
      return {
        longitude: cityCoords[0],
        latitude: cityCoords[1],
        confidence: 0.8,
        method: 'city_geocode'
      };
    }
  }
  
  // Try to geocode from region if it looks like a city name
  if (event.region) {
    const regionCoords = geocodeCity(event.region, event.country);
    if (regionCoords) {
      return {
        longitude: regionCoords[0],
        latitude: regionCoords[1],
        confidence: 0.7,
        method: 'region_geocode'
      };
    }
  }
  
  // Fall back to country centroid
  if (event.country) {
    const countryCoords = geocodeCountry(event.country);
    if (countryCoords) {
      return {
        longitude: countryCoords[0],
        latitude: countryCoords[1],
        confidence: 0.5,
        method: 'country_centroid'
      };
    }
  }
  
  // No coordinates found
  return null;
}

/**
 * Process a batch of events to fix coordinates
 */
function fixEventCoordinates(events) {
  const results = {
    fixed: 0,
    already_valid: 0,
    unfixable: 0,
    methods: {}
  };
  
  const fixedEvents = events.map(event => {
    const coordFix = fixCoordinates(event);
    
    if (coordFix) {
      if (coordFix.method === 'existing_valid') {
        results.already_valid++;
      } else {
        results.fixed++;
        results.methods[coordFix.method] = (results.methods[coordFix.method] || 0) + 1;
      }
      
      return {
        ...event,
        latitude: coordFix.latitude,
        longitude: coordFix.longitude,
        location: `POINT(${coordFix.longitude} ${coordFix.latitude})`,
        coordinate_confidence: coordFix.confidence,
        coordinate_method: coordFix.method
      };
    } else {
      results.unfixable++;
      return event;
    }
  });
  
  return { events: fixedEvents, stats: results };
}

// Export for use in other scripts
export { 
  fixCoordinates, 
  fixEventCoordinates, 
  isValidCoordinate,
  geocodeCity,
  geocodeCountry 
};