const { GLOBAL_NEWS_SOURCES } = require('../osint-ingestion/sources/global-news-sources');

// Count sources by category
const categories = Object.keys(GLOBAL_NEWS_SOURCES);
let totalSources = 0;

console.log('📊 RSS Source Statistics:\n');

categories.forEach(category => {
  const count = GLOBAL_NEWS_SOURCES[category].length;
  totalSources += count;
  console.log(`${category}: ${count} sources`);
});

console.log('\n📈 Total Sources:', totalSources);

// New additions
const newAdditions = {
  south_asia: GLOBAL_NEWS_SOURCES.south_asia.length,
  oceania: GLOBAL_NEWS_SOURCES.oceania.length,
  nordic: GLOBAL_NEWS_SOURCES.nordic.length
};

console.log('\n✨ New Additions:');
console.log(`South Asia: ${newAdditions.south_asia} sources`);
console.log(`Oceania: ${newAdditions.oceania} sources`);
console.log(`Nordic: ${newAdditions.nordic} sources`);
console.log(`Total New: ${newAdditions.south_asia + newAdditions.oceania + newAdditions.nordic} sources`);