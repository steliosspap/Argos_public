#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugNews() {
  console.log('🔍 Debugging news table...\n');

  // Check table schema
  const { data: allNews, error: allError } = await supabase
    .from('news')
    .select('*')
    .limit(1);
  
  if (allError) {
    console.error('Error fetching news:', allError);
    return;
  }

  if (allNews && allNews.length > 0) {
    console.log('News table columns:', Object.keys(allNews[0]));
    console.log('\nSample news item:', JSON.stringify(allNews[0], null, 2));
  }

  // Check if we have recent news
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - 24);
  
  console.log('\nLooking for news after:', cutoffTime.toISOString());

  const { data: recentNews, error: recentError } = await supabase
    .from('news')
    .select('id, title, published_at')
    .gte('published_at', cutoffTime.toISOString())
    .order('published_at', { ascending: false })
    .limit(5);
  
  if (recentError) {
    console.error('Error fetching recent news:', recentError);
  } else {
    console.log(`\nFound ${recentNews?.length || 0} recent news articles`);
    if (recentNews && recentNews.length > 0) {
      recentNews.forEach(article => {
        console.log(`- ${new Date(article.published_at).toISOString()}: ${article.title}`);
      });
    }
  }

  // Check if 'summary' field exists
  const { data: summaryCheck } = await supabase
    .from('news')
    .select('summary')
    .limit(5);
  
  console.log('\nSummary field check:', summaryCheck?.filter(item => item.summary).length || 0, 'out of 5 have summaries');
}

debugNews().catch(console.error);