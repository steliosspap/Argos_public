// Test script for Phase 2 features

// Define the functions directly for testing
function getEscalationScore(text) {
  const keywords = [
    // High intensity (4-5 points)
    { word: 'airstrike', score: 5 },
    { word: 'bombing', score: 5 },
    { word: 'missile attack', score: 5 },
    { word: 'invasion', score: 5 },
    { word: 'war crimes', score: 4 },
    { word: 'genocide', score: 5 },
    { word: 'massacre', score: 4 },
    { word: 'assassination', score: 4 },
    
    // Medium-high intensity (3 points)
    { word: 'missile', score: 3 },
    { word: 'shelling', score: 3 },
    { word: 'artillery', score: 3 },
    { word: 'drone strike', score: 3 },
    { word: 'military offensive', score: 3 },
    { word: 'siege', score: 3 },
    { word: 'blockade', score: 3 },
    
    // Medium intensity (2 points)
    { word: 'conflict', score: 2 },
    { word: 'deployment', score: 2 },
    { word: 'military operation', score: 2 },
    { word: 'armed clash', score: 2 },
    { word: 'insurgency', score: 2 },
    { word: 'uprising', score: 2 },
    { word: 'sanctions', score: 2 },
    
    // Low intensity (1 point)
    { word: 'military exercise', score: 1 },
    { word: 'troop movement', score: 1 },
    { word: 'border tension', score: 1 },
    { word: 'diplomatic crisis', score: 1 },
    
    // De-escalation (-1 to -2 points)
    { word: 'ceasefire', score: -2 },
    { word: 'peace agreement', score: -2 },
    { word: 'peace talks', score: -1 },
    { word: 'humanitarian aid', score: -1 },
    { word: 'truce', score: -1 },
    { word: 'withdrawal', score: -1 }
  ];

  let score = 0;
  const lower = text.toLowerCase();
  
  for (const k of keywords) {
    if (lower.includes(k.word)) {
      score += k.score;
    }
  }
  
  // Ensure score is non-negative and cap at reasonable maximum
  return Math.max(0, Math.min(score, 10));
}

function detectRegionAndCountry(title, description) {
  const regionTags = [
    // Middle East
    { name: 'Syria', country: 'Syria', region: 'Middle East' },
    { name: 'Iraq', country: 'Iraq', region: 'Middle East' },
    { name: 'Iran', country: 'Iran', region: 'Middle East' },
    { name: 'Israel', country: 'Israel', region: 'Middle East' },
    { name: 'Palestine', country: 'Palestine', region: 'Middle East' },
    { name: 'Gaza', country: 'Palestine', region: 'Middle East' },
    { name: 'West Bank', country: 'Palestine', region: 'Middle East' },
    { name: 'Lebanon', country: 'Lebanon', region: 'Middle East' },
    { name: 'Jordan', country: 'Jordan', region: 'Middle East' },
    { name: 'Saudi Arabia', country: 'Saudi Arabia', region: 'Middle East' },
    { name: 'Yemen', country: 'Yemen', region: 'Middle East' },
    { name: 'Turkey', country: 'Turkey', region: 'Middle East' },
    
    // Europe
    { name: 'Ukraine', country: 'Ukraine', region: 'Europe' },
    { name: 'Russia', country: 'Russia', region: 'Europe' },
    { name: 'Belarus', country: 'Belarus', region: 'Europe' },
    { name: 'Poland', country: 'Poland', region: 'Europe' },
    { name: 'Germany', country: 'Germany', region: 'Europe' },
    { name: 'France', country: 'France', region: 'Europe' },
    { name: 'United Kingdom', country: 'United Kingdom', region: 'Europe' },
    { name: 'UK', country: 'United Kingdom', region: 'Europe' },
    { name: 'Britain', country: 'United Kingdom', region: 'Europe' },
    
    // Africa
    { name: 'Sudan', country: 'Sudan', region: 'Africa' },
    { name: 'Ethiopia', country: 'Ethiopia', region: 'Africa' },
    { name: 'Somalia', country: 'Somalia', region: 'Africa' },
    { name: 'Congo', country: 'Democratic Republic of Congo', region: 'Africa' },
    { name: 'Libya', country: 'Libya', region: 'Africa' },
    { name: 'Mali', country: 'Mali', region: 'Africa' },
    { name: 'Niger', country: 'Niger', region: 'Africa' },
    { name: 'Chad', country: 'Chad', region: 'Africa' },
    { name: 'Nigeria', country: 'Nigeria', region: 'Africa' },
    { name: 'Kenya', country: 'Kenya', region: 'Africa' },
    
    // Asia
    { name: 'China', country: 'China', region: 'Asia' },
    { name: 'Taiwan', country: 'Taiwan', region: 'Asia' },
    { name: 'North Korea', country: 'North Korea', region: 'Asia' },
    { name: 'South Korea', country: 'South Korea', region: 'Asia' },
    { name: 'Japan', country: 'Japan', region: 'Asia' },
    { name: 'India', country: 'India', region: 'Asia' },
    { name: 'Pakistan', country: 'Pakistan', region: 'Asia' },
    { name: 'Afghanistan', country: 'Afghanistan', region: 'Asia' },
    { name: 'Myanmar', country: 'Myanmar', region: 'Asia' },
    { name: 'Thailand', country: 'Thailand', region: 'Asia' },
    
    // Americas
    { name: 'Venezuela', country: 'Venezuela', region: 'Americas' },
    { name: 'Colombia', country: 'Colombia', region: 'Americas' },
    { name: 'Mexico', country: 'Mexico', region: 'Americas' },
    { name: 'Haiti', country: 'Haiti', region: 'Americas' },
    { name: 'Cuba', country: 'Cuba', region: 'Americas' },
    { name: 'Brazil', country: 'Brazil', region: 'Americas' },
    { name: 'Argentina', country: 'Argentina', region: 'Americas' },
    { name: 'Chile', country: 'Chile', region: 'Americas' }
  ];
  
  const text = `${title} ${description || ''}`.toLowerCase();
  
  // Find the most specific match (longest country name first)
  const sortedTags = regionTags.sort((a, b) => b.name.length - a.name.length);
  
  for (const tag of sortedTags) {
    if (text.includes(tag.name.toLowerCase())) {
      return { country: tag.country, region: tag.region };
    }
  }
  
  return { country: null, region: null };
}

async function testPhase2Features() {
  console.log('🧪 Testing Phase 2 features with sample headlines...');
  console.log('');
  
  const testHeadlines = [
    'Israeli airstrike kills dozens in Gaza amid escalating conflict',
    'Ukraine reports massive Russian missile attack on Kiev',
    'Iran nuclear talks resume as tensions ease in Middle East',
    'Sudan peace agreement signed after months of negotiations',
    'China conducts military exercises near Taiwan strait',
    'Syrian government forces shell rebel positions in Idlib',
    'NATO deployment increases near Belarus border',
    'Myanmar military launches offensive against opposition groups',
    'Ceasefire declared in Yemen after peace negotiations',
    'North Korea conducts ballistic missile test over Japan'
  ];
  
  console.log('📊 Phase 2 Feature Testing Results:');
  console.log('═'.repeat(80));
  
  for (const headline of testHeadlines) {
    const { country, region } = detectRegionAndCountry(headline, '');
    const escalationScore = getEscalationScore(headline);
    
    console.log(`📰 "${headline}"`);
    console.log(`   🌍 Country: ${country || 'Unknown'} | Region: ${region || 'Unknown'}`);
    console.log(`   🔥 Escalation Score: ${escalationScore}/10`);
    console.log('');
  }
  
  console.log('✅ Phase 2 feature testing completed!');
  console.log('');
  console.log('📈 Escalation Score Legend:');
  console.log('   0-2: Low intensity (exercises, talks, diplomatic)');
  console.log('   3-5: Medium intensity (conflicts, operations, sanctions)');
  console.log('   6-8: High intensity (airstrikes, missiles, attacks)');
  console.log('   9-10: Critical intensity (invasions, war crimes, genocide)');
}

if (require.main === module) {
  testPhase2Features()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Testing failed:', error);
      process.exit(1);
    });
}