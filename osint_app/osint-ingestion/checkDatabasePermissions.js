#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function checkDatabasePermissions() {
  console.log('DATABASE PERMISSION CHECK');
  console.log('========================\n');
  
  // Check which keys are available
  console.log('Environment Variables:');
  console.log('---------------------');
  console.log(`SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ Missing Supabase credentials!');
    process.exit(1);
  }
  
  const keyType = process.env.SUPABASE_SERVICE_KEY ? 'SERVICE_KEY' : 'ANON_KEY';
  console.log(`\nUsing: ${keyType}`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Test permissions on different tables
  console.log('\nTesting Database Operations:');
  console.log('---------------------------');
  
  // Test 1: Read from news
  try {
    const { data, error } = await supabase
      .from('news')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('❌ NEWS READ: Failed -', error.message);
    } else {
      console.log('✅ NEWS READ: Success');
    }
  } catch (e) {
    console.log('❌ NEWS READ: Exception -', e.message);
  }
  
  // Test 2: Insert into events (this is where RLS might block)
  try {
    const testEvent = {
      title: 'Permission Test Event',
      summary: 'Testing database permissions',
      location: 'POINT(0 0)',
      country: 'Test',
      region: 'Test',
      timestamp: new Date().toISOString(),
      channel: 'Test',
      reliability: 5,
      event_classifier: ['test'],
      severity: 'low',
      source_url: 'https://test.com/permission-test'
    };
    
    const { data, error } = await supabase
      .from('events')
      .insert([testEvent])
      .select('id');
    
    if (error) {
      console.log('❌ EVENTS INSERT: Failed -', error.message);
      if (error.message.includes('new row violates row-level security')) {
        console.log('   → RLS BLOCKING: You need SERVICE_KEY for inserts!');
      }
    } else {
      console.log('✅ EVENTS INSERT: Success');
      // Clean up test event
      if (data && data[0]) {
        await supabase.from('events').delete().eq('id', data[0].id);
      }
    }
  } catch (e) {
    console.log('❌ EVENTS INSERT: Exception -', e.message);
  }
  
  // Test 3: Update conflicts table
  try {
    const { error } = await supabase
      .from('conflicts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', '00000000-0000-0000-0000-000000000000') // Non-existent ID
      .select();
    
    if (error) {
      console.log('❌ CONFLICTS UPDATE: Failed -', error.message);
    } else {
      console.log('✅ CONFLICTS UPDATE: Success (permission granted)');
    }
  } catch (e) {
    console.log('❌ CONFLICTS UPDATE: Exception -', e.message);
  }
  
  // Summary
  console.log('\nSUMMARY:');
  console.log('--------');
  if (keyType === 'ANON_KEY') {
    console.log('⚠️  WARNING: Using ANON_KEY - Limited permissions!');
    console.log('   - Cannot INSERT into events table');
    console.log('   - Cannot UPDATE conflicts table');
    console.log('   - Pipeline will fail silently!\n');
    console.log('🔧 FIX: Set SUPABASE_SERVICE_KEY in your .env file');
  } else {
    console.log('✅ Using SERVICE_KEY - Full permissions available');
  }
  
  // Check if news table has recent data
  console.log('\nChecking Data Flow:');
  console.log('------------------');
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data: recentNews, error: newsError } = await supabase
    .from('news')
    .select('id, published_at')
    .gte('published_at', yesterday.toISOString())
    .order('published_at', { ascending: false })
    .limit(5);
  
  if (newsError) {
    console.log('❌ Cannot check recent news:', newsError.message);
  } else {
    console.log(`📰 Recent news articles (last 24h): ${recentNews?.length || 0}`);
    if (recentNews && recentNews.length > 0) {
      console.log(`   Latest: ${new Date(recentNews[0].published_at).toLocaleString()}`);
    }
  }
  
  const { data: recentEvents, error: eventsError } = await supabase
    .from('events')
    .select('id, timestamp')
    .gte('timestamp', yesterday.toISOString())
    .order('timestamp', { ascending: false })
    .limit(5);
  
  if (eventsError) {
    console.log('❌ Cannot check recent events:', eventsError.message);
  } else {
    console.log(`🎯 Recent events (last 24h): ${recentEvents?.length || 0}`);
    if (recentEvents && recentEvents.length > 0) {
      console.log(`   Latest: ${new Date(recentEvents[0].timestamp).toLocaleString()}`);
    }
  }
}

checkDatabasePermissions();