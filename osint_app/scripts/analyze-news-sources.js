#!/usr/bin/env node

/**
 * Comprehensive analysis of news sources in the OSINT pipeline
 * Analyzes source diversity, coverage, duplicates, and potential issues
 */

const { GLOBAL_NEWS_SOURCES, LANGUAGE_CODES, getAllSources } = require('../osint-ingestion/sources/global-news-sources');

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
}

// Main analysis function
function analyzeNewsSources() {
  console.log('='.repeat(80));
  console.log('OSINT NEWS SOURCES ANALYSIS');
  console.log('='.repeat(80));
  
  // 1. Count total sources and categorize
  const categoryStats = {};
  const languageStats = {};
  const domainFrequency = {};
  const duplicateUrls = [];
  const urlSet = new Set();
  
  Object.entries(GLOBAL_NEWS_SOURCES).forEach(([category, sources]) => {
    categoryStats[category] = sources.length;
    
    sources.forEach(url => {
      // Check for duplicate URLs
      if (urlSet.has(url)) {
        duplicateUrls.push({ url, category });
      } else {
        urlSet.add(url);
      }
      
      // Track domain frequency
      const domain = extractDomain(url);
      domainFrequency[domain] = (domainFrequency[domain] || 0) + 1;
      
      // Track language stats
      const language = LANGUAGE_CODES[category] || 'en';
      languageStats[language] = (languageStats[language] || 0) + 1;
    });
  });
  
  // 2. Summary Statistics
  console.log('\n1. SUMMARY STATISTICS');
  console.log('-'.repeat(40));
  const totalSources = Array.from(urlSet).length;
  const totalWithDuplicates = Object.values(categoryStats).reduce((sum, count) => sum + count, 0);
  console.log(`Total unique sources: ${totalSources}`);
  console.log(`Total sources (including duplicates): ${totalWithDuplicates}`);
  console.log(`Duplicate URLs found: ${duplicateUrls.length}`);
  
  // 3. Category Breakdown
  console.log('\n2. SOURCES BY CATEGORY');
  console.log('-'.repeat(40));
  Object.entries(categoryStats).sort((a, b) => b[1] - a[1]).forEach(([category, count]) => {
    const percentage = ((count / totalWithDuplicates) * 100).toFixed(1);
    console.log(`${category.padEnd(20)} ${count.toString().padStart(4)} sources (${percentage}%)`);
  });
  
  // 4. Language Coverage
  console.log('\n3. LANGUAGE COVERAGE');
  console.log('-'.repeat(40));
  Object.entries(languageStats).sort((a, b) => b[1] - a[1]).forEach(([language, count]) => {
    const percentage = ((count / totalSources) * 100).toFixed(1);
    console.log(`${language.padEnd(5)} ${count.toString().padStart(4)} sources (${percentage}%)`);
  });
  
  // 5. Source Diversity Analysis
  console.log('\n4. SOURCE DIVERSITY ANALYSIS');
  console.log('-'.repeat(40));
  
  // Identify major news organizations vs regional/specialized
  const majorOrgs = ['reuters', 'bbc', 'cnn', 'aljazeera', 'xinhua', 'tass', 'afp', 'ap', 'dw', 'france24'];
  const stateMedia = ['rt.com', 'xinhua', 'tass', 'cctv', 'globaltimes', 'sputnik', 'cgtn', 'people.com.cn'];
  const defenseSpecialized = ['janes', 'defensenews', 'military.com', 'stratfor', 'armytimes', 'navytimes'];
  
  let majorOrgCount = 0;
  let stateMediaCount = 0;
  let defenseCount = 0;
  
  Object.keys(domainFrequency).forEach(domain => {
    const lowerDomain = domain.toLowerCase();
    if (majorOrgs.some(org => lowerDomain.includes(org))) majorOrgCount++;
    if (stateMedia.some(org => lowerDomain.includes(org))) stateMediaCount++;
    if (defenseSpecialized.some(org => lowerDomain.includes(org))) defenseCount++;
  });
  
  console.log(`Major international news organizations: ${majorOrgCount}`);
  console.log(`State-affiliated media sources: ${stateMediaCount}`);
  console.log(`Defense/military specialized sources: ${defenseCount}`);
  
  // 6. Geographic Coverage Gaps
  console.log('\n5. GEOGRAPHIC COVERAGE ANALYSIS');
  console.log('-'.repeat(40));
  
  const regionCoverage = {
    'North America': ['cnn', 'npr', 'washingtonpost', 'nytimes', 'military.com'],
    'Europe': ['bbc', 'dw', 'france24', 'euronews', 'spiegel', 'lemonde', 'corriere'],
    'Russia/CIS': ['tass', 'ria', 'lenta', 'kommersant', 'interfax'],
    'China/East Asia': ['xinhua', 'people', 'scmp', 'nhk', 'asahi', 'yomiuri'],
    'Middle East': ['aljazeera', 'alarabiya', 'haaretz', 'jpost', 'dailysabah'],
    'Africa': ['africanews', 'allafrica', 'news24', 'egypttoday'],
    'Latin America': ['clarin', 'folha', 'elpais', 'reforma', 'telam'],
    'South Asia': ['indianexpress', 'dawn', 'thedailystar'], // Note: Limited coverage
    'Southeast Asia': ['straitstimes', 'channelnewsasia', 'jakartapost', 'bangkokpost'],
    'Oceania': [] // Note: No specific sources
  };
  
  Object.entries(regionCoverage).forEach(([region, keywords]) => {
    let count = 0;
    Object.keys(domainFrequency).forEach(domain => {
      if (keywords.some(keyword => domain.toLowerCase().includes(keyword))) count++;
    });
    console.log(`${region.padEnd(20)} ${count} sources ${count === 0 ? '⚠️  GAP IDENTIFIED' : ''}`);
  });
  
  // 7. Duplicate URLs Report
  if (duplicateUrls.length > 0) {
    console.log('\n6. DUPLICATE URLS FOUND');
    console.log('-'.repeat(40));
    duplicateUrls.forEach(({ url, category }) => {
      console.log(`${category}: ${url}`);
    });
  }
  
  // 8. Domain Frequency (potential over-reliance)
  console.log('\n7. DOMAINS WITH MULTIPLE FEEDS');
  console.log('-'.repeat(40));
  Object.entries(domainFrequency)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .forEach(([domain, count]) => {
      console.log(`${domain.padEnd(30)} ${count} feeds`);
    });
  
  // 9. Potential Issues
  console.log('\n8. POTENTIAL ISSUES & RECOMMENDATIONS');
  console.log('-'.repeat(40));
  
  // Check for common RSS feed issues
  const potentialIssues = [];
  
  getAllSources().forEach(source => {
    const url = source.url;
    
    // Check for HTTP vs HTTPS
    if (url.startsWith('http://')) {
      potentialIssues.push(`⚠️  HTTP (not HTTPS): ${url}`);
    }
    
    // Check for potentially outdated feed URLs
    if (url.includes('/export/') || url.includes('/v10/') || url.includes('/rss2/')) {
      potentialIssues.push(`⚠️  Potentially outdated feed format: ${url}`);
    }
  });
  
  if (potentialIssues.length > 0) {
    console.log('Feed URL Issues:');
    potentialIssues.slice(0, 10).forEach(issue => console.log(issue));
    if (potentialIssues.length > 10) {
      console.log(`... and ${potentialIssues.length - 10} more issues`);
    }
  }
  
  // Coverage gaps
  console.log('\nCoverage Gaps Identified:');
  console.log('- Limited South Asian coverage (India, Pakistan, Bangladesh)');
  console.log('- No Oceania/Pacific coverage (Australia, New Zealand)');
  console.log('- Limited coverage of Nordic countries');
  console.log('- Limited coverage of Central Asian republics');
  console.log('- Limited coverage of Caribbean region');
  
  // Recommendations
  console.log('\nRecommendations:');
  console.log('- Add more South Asian sources (Times of India, Dawn, Daily Star)');
  console.log('- Add Australian/NZ sources (ABC Australia, stuff.co.nz)');
  console.log('- Consider adding Nordic sources (Yle, NRK, DR, SVT)');
  console.log('- Update HTTP URLs to HTTPS where possible');
  console.log('- Verify all RSS feeds are still active');
  console.log('- Consider adding more independent/alternative media sources');
  
  // 10. Source Type Distribution
  console.log('\n9. SOURCE TYPE DISTRIBUTION');
  console.log('-'.repeat(40));
  const sourceTypes = {
    'General News': ['international', 'russian', 'chinese', 'arabic', 'spanish', 'french', 'german', 'italian', 'portuguese', 'japanese'],
    'Regional Focus': ['middle_east', 'africa', 'asia_pacific', 'eastern_europe'],
    'Specialized': ['defense_intelligence', 'conflict_monitoring']
  };
  
  Object.entries(sourceTypes).forEach(([type, categories]) => {
    const count = categories.reduce((sum, cat) => sum + (categoryStats[cat] || 0), 0);
    const percentage = ((count / totalWithDuplicates) * 100).toFixed(1);
    console.log(`${type.padEnd(20)} ${count.toString().padStart(4)} sources (${percentage}%)`);
  });
}

// Run the analysis
analyzeNewsSources();