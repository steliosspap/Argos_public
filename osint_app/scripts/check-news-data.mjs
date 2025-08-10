/**
 * Check what news data is being returned by the API
 * Run with: node scripts/check-news-data.mjs
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🔍 Checking news data with bias analysis...\n');

// Check news_with_sources view
const { data: news, error } = await supabase
  .from('news_with_sources')
  .select('*')
  .not('bias_score', 'is', null)
  .limit(5)
  .order('published_at', { ascending: false });

if (error) {
  console.error('❌ Error fetching news:', error);
} else {
  console.log(`Found ${news?.length || 0} news items with bias analysis:\n`);
  
  news?.forEach((item, index) => {
    console.log(`${index + 1}. ${item.title || item.headline}`);
    console.log(`   Source: ${item.source}`);
    console.log(`   Bias Score: ${item.bias_score}`);
    console.log(`   Verification: ${item.verification_status || 'Not checked'}`);
    console.log(`   Has Analysis ID: ${!!item.bias_analysis_id}`);
    console.log('');
  });
}

// Check if the news API endpoint includes this data
console.log('\n📡 Testing /api/news endpoint...');
try {
  const response = await fetch('http://localhost:3000/api/news?limit=5');
  if (response.ok) {
    const result = await response.json();
    console.log(`\nAPI returned ${result.data?.length || 0} items`);
    
    const itemWithAnalysis = result.data?.find(item => item.has_analysis);
    if (itemWithAnalysis) {
      console.log('\n✅ Found item with analysis:');
      console.log(`   Title: ${itemWithAnalysis.title}`);
      console.log(`   Bias Score: ${itemWithAnalysis.bias_score}`);
      console.log(`   Verification: ${itemWithAnalysis.verification_status}`);
      console.log(`   Has Analysis: ${itemWithAnalysis.has_analysis}`);
    } else {
      console.log('\n⚠️  No items with analysis found in API response');
    }
  } else {
    console.log(`\n❌ API request failed: ${response.status}`);
    console.log('   Make sure the Next.js server is running: npm run dev');
  }
} catch (err) {
  console.log('\n❌ Could not connect to API');
  console.log('   Make sure the Next.js server is running: npm run dev');
}

console.log('\n✅ Check complete!');