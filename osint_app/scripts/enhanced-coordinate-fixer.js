/**
 * Enhanced Coordinate Fixing Utility
 * Extracts city names from event text and provides better geocoding
 */

// Expanded city coordinates for better coverage
const CITY_COORDINATES = {
  // Ukraine - Major cities
  'kyiv': [30.5234, 50.4501],
  'kiev': [30.5234, 50.4501],
  'kharkiv': [36.2304, 49.9935],
  'kharkov': [36.2304, 49.9935],
  'odesa': [30.7233, 46.4825],
  'odessa': [30.7233, 46.4825],
  'dnipro': [35.0462, 48.4647],
  'dnepropetrovsk': [35.0462, 48.4647],
  'zaporizhzhia': [35.1396, 47.8388],
  'zaporozhye': [35.1396, 47.8388],
  'lviv': [24.0297, 49.8397],
  'mariupol': [37.5499, 47.0969],
  'donetsk': [37.8028, 48.0159],
  'luhansk': [39.3078, 48.5740],
  'lugansk': [39.3078, 48.5740],
  'crimea': [34.1025, 44.9572],
  'sevastopol': [33.5253, 44.6054],
  'mykolaiv': [31.9946, 46.9750],
  'cherkasy': [32.0598, 49.4444],
  'sumy': [34.7981, 50.9077],
  'bakhmut': [38.0169, 48.5953],
  'kramatorsk': [37.5558, 48.7372],
  'melitopol': [35.3674, 46.8476],
  'berdyansk': [36.7928, 46.7611],
  'kherson': [32.6178, 46.6354],
  
  // Russia - Major cities
  'moscow': [37.6173, 55.7558],
  'st petersburg': [30.3351, 59.9311],
  'saint petersburg': [30.3351, 59.9311],
  'petersburg': [30.3351, 59.9311],
  'rostov': [39.7015, 47.2357],
  'rostov-on-don': [39.7015, 47.2357],
  'belgorod': [36.5853, 50.5955],
  'kursk': [36.1920, 51.7306],
  'voronezh': [39.2037, 51.6720],
  'krasnodar': [38.9769, 45.0355],
  'volgograd': [44.5018, 48.7080],
  'bryansk': [34.3683, 53.2610],
  
  // Israel/Palestine
  'gaza': [34.4668, 31.5018],
  'gaza city': [34.4668, 31.5018],
  'gaza strip': [34.4668, 31.4544],
  'jerusalem': [35.2137, 31.7683],
  'tel aviv': [34.7818, 32.0853],
  'haifa': [34.9885, 32.7940],
  'west bank': [35.2626, 31.9474],
  'ramallah': [35.2064, 31.9038],
  'bethlehem': [35.1931, 31.7049],
  'nablus': [35.2544, 32.2211],
  'hebron': [35.0938, 31.5326],
  'jericho': [35.4436, 31.8611],
  'rafah': [34.2502, 31.2889],
  'khan younis': [34.3062, 31.3469],
  'deir al-balah': [34.3520, 31.4181],
  'beit lahia': [34.4951, 31.5469],
  'jabalia': [34.4836, 31.5272],
  
  // Syria
  'damascus': [36.2765, 33.5138],
  'aleppo': [37.1612, 36.2021],
  'homs': [36.7228, 34.7268],
  'latakia': [35.7817, 35.5312],
  'hama': [36.7508, 35.1300],
  'idlib': [36.6317, 35.9310],
  'deir ez-zor': [40.1401, 35.3358],
  'raqqa': [39.0194, 35.9597],
  'palmyra': [38.2814, 34.5528],
  
  // Lebanon
  'beirut': [35.5018, 33.8938],
  'tripoli': [35.8344, 34.4361], // Lebanon's Tripoli
  'sidon': [35.3689, 33.5631],
  'tyre': [35.1939, 33.2703],
  'baalbek': [36.2184, 34.0069],
  
  // Iran
  'tehran': [51.3890, 35.6892],
  'isfahan': [51.6659, 32.6542],
  'mashhad': [59.6062, 36.2969],
  'tabriz': [46.2919, 38.0792],
  'shiraz': [52.5311, 29.5918],
  'qom': [50.8764, 34.6399],
  'ahvaz': [48.6842, 31.3203],
  
  // Iraq
  'baghdad': [44.3661, 33.3152],
  'mosul': [43.1189, 36.3350],
  'basra': [47.7975, 30.5085],
  'erbil': [44.0088, 36.1912],
  'kirkuk': [44.3894, 35.4689],
  'najaf': [44.3301, 31.9986],
  'karbala': [44.0249, 32.6149],
  'fallujah': [43.7836, 33.3495],
  
  // Other conflict areas
  'mogadishu': [45.3182, 2.0469],
  'khartoum': [32.5599, 15.5007],
  'tripoli libya': [13.1913, 32.8872], // Libya's Tripoli
  'benghazi': [20.0687, 32.1194],
  'sanaa': [44.2067, 15.3694],
  'sana\'a': [44.2067, 15.3694],
  'aden': [45.0187, 12.7797],
  'kabul': [69.2075, 34.5553],
  'kandahar': [65.7117, 31.6130],
  'herat': [62.2031, 34.3529],
};

// Country center coordinates for fallback
const COUNTRY_COORDINATES = {
  'ukraine': [31.1656, 48.3794],
  'russia': [105.3188, 61.5240], // More central Russia
  'israel': [35.2137, 31.0461],
  'palestine': [35.2226, 31.9474],
  'syria': [38.9968, 34.8021],
  'lebanon': [35.8623, 33.8547],
  'iran': [53.6880, 32.4279],
  'iraq': [43.6793, 33.2232],
  'afghanistan': [67.7100, 33.9391],
  'yemen': [48.5164, 15.5527],
  'libya': [17.2283, 26.3351],
  'somalia': [46.1996, 5.1521],
  'sudan': [30.2176, 12.8628],
  'mali': [-3.9962, 17.5707],
  'nigeria': [8.6753, 9.0820],
  'india': [78.9629, 20.5937],
  'china': [104.1954, 35.8617],
};

/**
 * Extract city names from event text
 */
function extractCityFromText(title, summary, country) {
  const text = `${title || ''} ${summary || ''}`.toLowerCase();
  
  // Create a list of cities to check, prioritizing by country
  let citiesToCheck = Object.keys(CITY_COORDINATES);
  
  // If we know the country, prioritize cities from that country
  if (country) {
    const countryLower = country.toLowerCase();
    const countryCities = [];
    const otherCities = [];
    
    citiesToCheck.forEach(city => {
      // Check if this city is likely in the given country
      if (countryLower.includes('ukrain') && ['kyiv', 'kiev', 'kharkiv', 'odesa', 'mariupol', 'donetsk', 'luhansk'].includes(city)) {
        countryCities.push(city);
      } else if (countryLower.includes('russia') && ['moscow', 'petersburg', 'rostov', 'belgorod', 'kursk'].includes(city)) {
        countryCities.push(city);
      } else if ((countryLower.includes('israel') || countryLower.includes('palestine')) && 
                 ['gaza', 'jerusalem', 'tel aviv', 'ramallah', 'rafah', 'khan younis'].includes(city)) {
        countryCities.push(city);
      } else if (countryLower.includes('syria') && ['damascus', 'aleppo', 'homs', 'idlib'].includes(city)) {
        countryCities.push(city);
      } else if (countryLower.includes('iran') && ['tehran', 'isfahan', 'mashhad'].includes(city)) {
        countryCities.push(city);
      } else {
        otherCities.push(city);
      }
    });
    
    citiesToCheck = [...countryCities, ...otherCities];
  }
  
  // Check for city matches (longest match first to avoid partial matches)
  citiesToCheck.sort((a, b) => b.length - a.length);
  
  for (const city of citiesToCheck) {
    // Create regex to match city as whole word
    const regex = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      return city;
    }
  }
  
  // Check for common patterns like "in <city>" or "near <city>"
  const patterns = [
    /(?:in|at|near|outside|north of|south of|east of|west of)\s+([a-z]+(?:\s+[a-z]+)?)/gi,
    /([a-z]+(?:\s+[a-z]+)?)\s+(?:strike|attack|bombing|explosion|incident)/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const potentialCity = match[1].toLowerCase();
      if (CITY_COORDINATES[potentialCity]) {
        return potentialCity;
      }
    }
  }
  
  return null;
}

/**
 * Enhanced coordinate fixing with city extraction
 */
function enhancedFixCoordinates(event) {
  // First, try to extract city from title and summary
  const extractedCity = extractCityFromText(event.title, event.summary, event.country);
  
  if (extractedCity && CITY_COORDINATES[extractedCity]) {
    const coords = CITY_COORDINATES[extractedCity];
    return {
      longitude: coords[0],
      latitude: coords[1],
      city: extractedCity,
      confidence: 0.9,
      method: 'city_extracted'
    };
  }
  
  // Check if current coordinates are just country centroids
  if (event.longitude && event.latitude && event.country) {
    const countryCoords = COUNTRY_COORDINATES[event.country.toLowerCase()];
    if (countryCoords && 
        Math.abs(event.longitude - countryCoords[0]) < 0.01 && 
        Math.abs(event.latitude - countryCoords[1]) < 0.01) {
      // These are generic country coordinates, try to do better
      if (extractedCity) {
        return null; // Force re-geocoding
      }
    }
  }
  
  // Fall back to country coordinates if nothing else works
  if (event.country) {
    const countryCoords = COUNTRY_COORDINATES[event.country.toLowerCase()];
    if (countryCoords) {
      return {
        longitude: countryCoords[0],
        latitude: countryCoords[1],
        confidence: 0.5,
        method: 'country_fallback'
      };
    }
  }
  
  return null;
}

export { enhancedFixCoordinates, extractCityFromText, CITY_COORDINATES };