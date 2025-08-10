#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRecentNews() {
  console.log('🔍 Checking recent news ingestion...');
  console.log(`📅 Current time: ${new Date().toISOString()}\n`);

  try {
    // Check total count
    const { count: totalCount, error: totalError } = await supabase
      .from('news')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('❌ Error getting total count:', totalError);
      return;
    }

    console.log(`📰 Total articles in database: ${totalCount}`);

    // Check recent entries (last 24 hours)
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    const { data: recentNews, count: recentCount, error: recentError } = await supabase
      .from('news')
      .select('*', { count: 'exact' })
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('❌ Error getting recent news:', recentError);
      return;
    }

    console.log(`📅 Articles from last 24 hours: ${recentCount}`);
    
    if (recentNews && recentNews.length > 0) {
      console.log('\n📋 Most recent entries:');
      recentNews.slice(0, 5).forEach((article, index) => {
        console.log(`${index + 1}. [${article.created_at?.split('T')[0]}] ${article.title?.slice(0, 60)}...`);
        console.log(`   Source: ${article.source || 'Unknown'}`);
        console.log(`   Region: ${article.region || 'Unknown'}, Country: ${article.country || 'Unknown'}`);
        console.log(`   Escalation: ${article.escalation_score || 'N/A'}, URL: ${article.url?.slice(0, 50)}...`);
        console.log('');
      });
    } else {
      console.log('\n⚠️ No articles found in the last 24 hours');
    }

    // Check pipeline status by looking at sources
    const { data: sources, error: sourcesError } = await supabase
      .from('news')
      .select('source')
      .gte('created_at', yesterday.toISOString());

    if (!sourcesError && sources) {
      const sourceCount = sources.reduce((acc, item) => {
        acc[item.source] = (acc[item.source] || 0) + 1;
        return acc;
      }, {});

      console.log('📊 Recent articles by source:');
      Object.entries(sourceCount).forEach(([source, count]) => {
        console.log(`   ${source}: ${count} articles`);
      });
    }

    // Check for potential issues
    console.log('\n🔧 Diagnostic Information:');
    
    // Check if we have very old articles but no recent ones
    const { data: oldestNews, error: oldestError } = await supabase
      .from('news')
      .select('created_at, title')
      .order('created_at', { ascending: true })
      .limit(1);

    if (!oldestError && oldestNews && oldestNews.length > 0) {
      const oldestDate = new Date(oldestNews[0].created_at);
      const daysSinceOldest = Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`   Oldest article: ${daysSinceOldest} days ago`);
      
      if (recentCount === 0 && totalCount > 0) {
        console.log('   ⚠️ WARNING: Old articles exist but no recent ones - pipeline may be stalled');
      }
    }

    // Check most recent article details
    const { data: latestNews, error: latestError } = await supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!latestError && latestNews && latestNews.length > 0) {
      const latest = latestNews[0];
      const hoursAgo = Math.floor((Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60));
      console.log(`   Most recent article: ${hoursAgo} hours ago`);
      
      if (hoursAgo > 2) {
        console.log('   ⚠️ WARNING: Most recent article is more than 2 hours old - check pipeline status');
      }
    }

  } catch (error) {
    console.error('💥 Error checking recent news:', error);
  }
}

// Run the check
checkRecentNews()
  .then(() => {
    console.log('\n✅ Recent news check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Check failed:', error);
    process.exit(1);
  });