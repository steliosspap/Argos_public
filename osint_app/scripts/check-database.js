#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('🔍 Checking database contents...\n');

  // Check total news articles
  const { count: totalNews } = await supabase
    .from('news')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📰 Total news articles in database: ${totalNews || 0}`);

  // Check recent news (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: recentNews, count: recentNewsCount } = await supabase
    .from('news')
    .select('id, title, published_at', { count: 'exact' })
    .gte('published_at', sevenDaysAgo.toISOString())
    .order('published_at', { ascending: false })
    .limit(5);
  
  console.log(`📅 News articles from last 7 days: ${recentNewsCount || 0}`);
  
  if (recentNews && recentNews.length > 0) {
    console.log('\nMost recent news articles:');
    recentNews.forEach(article => {
      console.log(`  - ${new Date(article.published_at).toLocaleString()}: ${article.title}`);
    });
  }

  // Check total events
  const { count: totalEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n🎯 Total events in database: ${totalEvents || 0}`);

  // Check events by channel
  const { data: channelData } = await supabase
    .from('events')
    .select('channel');
  
  const channelCounts = channelData?.reduce((acc, event) => {
    acc[event.channel] = (acc[event.channel] || 0) + 1;
    return acc;
  }, {}) || {};
  
  console.log('\nEvents by channel:');
  Object.entries(channelCounts).forEach(([channel, count]) => {
    console.log(`  - ${channel}: ${count}`);
  });

  // Check if news ingestion ever worked
  const { count: newsEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('channel', 'news');
  
  console.log(`\n📈 Events from news channel: ${newsEvents || 0}`);

  // Check the oldest and newest news article
  const { data: oldestNews } = await supabase
    .from('news')
    .select('published_at')
    .order('published_at', { ascending: true })
    .limit(1);
  
  const { data: newestNews } = await supabase
    .from('news')
    .select('published_at')
    .order('published_at', { ascending: false })
    .limit(1);
  
  if (oldestNews && oldestNews.length > 0) {
    console.log(`\n📆 Oldest news article: ${new Date(oldestNews[0].published_at).toLocaleString()}`);
  }
  
  if (newestNews && newestNews.length > 0) {
    console.log(`📆 Newest news article: ${new Date(newestNews[0].published_at).toLocaleString()}`);
  }
}

checkDatabase().catch(console.error);