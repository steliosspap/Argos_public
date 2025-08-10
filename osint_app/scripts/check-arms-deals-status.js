#!/usr/bin/env node

// Quick status check for Agent 13 arms deal ingestion
import { getArmsDealsStats } from '../osint-ingestion/sync/syncArmsDeals.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkStatus() {
  console.log('🛰️ Agent 13: Arms Deal Status Check');
  console.log('='.repeat(40));
  
  try {
    const stats = await getArmsDealsStats();
    
    if (stats) {
      console.log(`📊 Database Status:`);
      console.log(`   Total deals: ${stats.totalDeals}`);
      console.log(`   Total value: $${(stats.totalValue / 1000000000).toFixed(2)}B`);
      console.log(`   Confirmed deals: ${stats.confirmedDeals}`);
      console.log(`   Recent deals (7 days): ${stats.recentDeals}`);
      console.log('');
      
      if (stats.topBuyers.length > 0) {
        console.log(`🎯 Top Buyers:`);
        stats.topBuyers.forEach(buyer => {
          console.log(`   ${buyer.country}: ${buyer.count} deals`);
        });
        console.log('');
      }
      
      if (stats.topSellers.length > 0) {
        console.log(`🏭 Top Sellers:`);
        stats.topSellers.forEach(seller => {
          console.log(`   ${seller.country}: ${seller.count} deals`);
        });
      }
      
      console.log('');
      console.log('✅ Arms deal ingestion pipeline operational');
      
    } else {
      console.log('❌ Could not retrieve arms deal statistics');
    }
    
  } catch (error) {
    console.error('❌ Error checking arms deals status:', error.message);
  }
}

checkStatus().catch(console.error);