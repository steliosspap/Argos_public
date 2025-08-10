// Quick script to debug the coordinate issue
const testCoords = () => {
  // Simulating the coordinate lookup
  const COUNTRY_COORDS = {
    'Israel': [34.8516, 31.0461],
    'Iran': [53.6880, 32.4279],
    'Ukraine': [31.1656, 48.3794],
  };

  const testEvents = [
    { id: 1, country: 'Israel', title: 'Test Israel event' },
    { id: 2, country: 'Iran', title: 'Test Iran event' },
    { id: 3, country: 'Unknown', title: 'Test unknown event' },
  ];

  testEvents.forEach(event => {
    const coords = COUNTRY_COORDS[event.country];
    console.log(`Event ${event.id} (${event.country}):`, coords || 'NO COORDS');
  });

  // Check if any coordinates might be interpreted as [0, lat]
  console.log('\nTesting coordinate parsing:');
  const testParsing = [
    { input: null, expected: 'should be null' },
    { input: undefined, expected: 'should be undefined' },
    { input: [0, 31], expected: 'lng is 0' },
    { input: [34.8516, 31.0461], expected: 'valid Israel coords' },
  ];

  testParsing.forEach(test => {
    console.log(`Input ${JSON.stringify(test.input)} - ${test.expected}`);
  });
};

testCoords();