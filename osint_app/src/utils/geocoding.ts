/**
 * Geocoding utilities for converting location names to coordinates
 * Uses a combination of known locations and Mapbox geocoding API
 */

// Known conflict zone coordinates for better accuracy
export const KNOWN_LOCATIONS: Record<string, [number, number]> = {
  // Countries
  'Ukraine': [31.1656, 48.3794],
  'Russia': [105.3188, 61.5240],
  'Israel': [34.8516, 31.0461],
  'Palestine': [35.2332, 31.9522],
  'Gaza': [34.4668, 31.5018],
  'Gaza Strip': [34.4668, 31.5018],
  'West Bank': [35.2, 31.9],
  'Lebanon': [35.8623, 33.8547],
  'Syria': [38.9968, 34.8021],
  'Iraq': [43.6793, 33.2232],
  'Yemen': [48.5164, 15.5527],
  'Sudan': [30.2176, 12.8628],
  'South Sudan': [31.3070, 6.8770],
  'Myanmar': [95.9560, 21.9139],
  'Somalia': [46.1996, 5.1521],
  'Mali': [-3.9962, 17.5707],
  'Burkina Faso': [-1.5616, 12.2383],
  'Nigeria': [8.6753, 9.0820],
  'Niger': [8.0817, 17.6078],
  'Ethiopia': [40.4897, 9.1450],
  'Afghanistan': [67.7100, 33.9391],
  'Pakistan': [69.3451, 30.3753],
  'Libya': [17.2283, 26.3351],
  'Egypt': [30.8025, 26.8206],
  'Iran': [53.6880, 32.4279],
  'Turkey': [35.2433, 38.9637],
  'India': [78.9629, 20.5937],
  'China': [104.1954, 35.8617],
  'Bangladesh': [90.3563, 23.6850],
  'France': [2.2137, 46.2276],
  'United Kingdom': [-3.4360, 55.3781],
  'UK': [-3.4360, 55.3781],
  'United States': [-95.7129, 37.0902],
  'USA': [-95.7129, 37.0902],
  'Australia': [133.7751, -25.2744],
  'Norway': [8.4689, 60.4720],
  'Netherlands': [5.2913, 52.1326],
  'Slovakia': [19.6990, 48.6690],
  
  // Major cities in conflict zones
  'Kyiv': [30.5234, 50.4501],
  'Kiev': [30.5234, 50.4501],
  'Moscow': [37.6173, 55.7558],
  'Jerusalem': [35.2137, 31.7683],
  'Tel Aviv': [34.7818, 32.0853],
  'Gaza City': [34.4668, 31.5018],
  'Damascus': [36.2765, 33.5138],
  'Baghdad': [44.3661, 33.3152],
  'Beirut': [35.5018, 33.8938],
  'Kabul': [69.2075, 34.5553],
  'Khartoum': [32.5599, 15.5007],
  'Juba': [31.5825, 4.8594],
  'Yangon': [96.1561, 16.8661],
  'Mogadishu': [45.3182, 2.0469],
  'Tripoli': [13.1913, 32.8872],
  'Cairo': [31.2357, 30.0444],
  'Tehran': [51.3890, 35.6892],
  'Ankara': [32.8597, 39.9334],
  'Istanbul': [28.9784, 41.0082],
  
  // Regions
  'Donbas': [37.8, 48.0],
  'Crimea': [34.0, 45.0],
  'Kashmir': [75.3, 34.0],
  'Tigray': [38.5, 13.5],
  'Darfur': [24.0, 13.0],
  'Sinai': [33.8, 29.5],
  'Golan Heights': [35.7, 33.0],
};

/**
 * Get coordinates for a location using known coordinates or country lookup
 */
export function getCoordinatesForLocation(
  country?: string | null,
  city?: string | null,
  region?: string | null
): [number, number] | null {
  // Try city first (most specific)
  if (city) {
    const cityCoords = KNOWN_LOCATIONS[city];
    if (cityCoords) return cityCoords;
    
    // Try city with country
    if (country) {
      const cityCountryKey = `${city}, ${country}`;
      const cityCountryCoords = KNOWN_LOCATIONS[cityCountryKey];
      if (cityCountryCoords) return cityCountryCoords;
    }
  }
  
  // Try region
  if (region) {
    const regionCoords = KNOWN_LOCATIONS[region];
    if (regionCoords) return regionCoords;
  }
  
  // Try country (least specific)
  if (country) {
    const countryCoords = KNOWN_LOCATIONS[country];
    if (countryCoords) return countryCoords;
    
    // Handle special cases
    if (country === 'Israel/Gaza') {
      return KNOWN_LOCATIONS['Israel']; // Default to Israel coords
    }
  }
  
  return null;
}

/**
 * Geocode using Mapbox API (for future enhancement)
 */
export async function geocodeWithMapbox(
  location: string,
  mapboxToken: string
): Promise<[number, number] | null> {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxToken}`
    );
    
    if (!response.ok) {
      console.error('Mapbox geocoding failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return [lng, lat];
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}