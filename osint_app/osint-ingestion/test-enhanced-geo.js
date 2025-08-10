/**
 * Test enhanced geospatial service
 */

import { EnhancedGeospatialService } from './services/EnhancedGeospatialService.js';
import { ConflictEvent } from './models/Event.js';

async function test() {
  const geoService = new EnhancedGeospatialService();
  
  console.log('Testing Enhanced Geospatial Service\n');
  
  // Test cases
  const testCases = [
    'Shifa Hospital',
    'Rafah crossing',
    'northern Gaza',
    'Khan Yunis',
    'Bakhmut',
    '10km north of Gaza City',
    'Gaza',
    'near Tel Aviv airport'
  ];
  
  for (const location of testCases) {
    const coords = await geoService.resolveLocation(location);
    console.log(`${location}: ${coords || 'NOT RESOLVED'}`);
    
    if (coords) {
      // Create event to test coordinate extraction
      const event = new ConflictEvent({
        title: `Test event at ${location}`,
        location: coords,
        locationName: location
      });
      
      console.log(`  -> Extracted: lat=${event.latitude}, lng=${event.longitude}`);
    }
  }
  
  // Test with full event context
  console.log('\nTesting with event context:');
  const eventText = 'Israeli forces attacked Shifa Hospital in Gaza City, causing multiple casualties';
  const eventDate = new Date();
  
  const contextCoords = await geoService.resolveLocation('Gaza City', eventText, eventDate);
  console.log(`With context: ${contextCoords}`);
}

test().catch(console.error);