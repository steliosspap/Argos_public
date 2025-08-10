#!/usr/bin/env tsx
/**
 * Script to generate invite codes for the Argos application
 * 
 * Usage:
 *   npm run generate-invite-codes -- --count 5 --max-uses 1 --expires-days 30
 *   npm run generate-invite-codes -- --count 1 --max-uses 10 --admin-email admin@example.com
 */

import { getSupabaseAdmin } from '../src/lib/supabase-admin';
import { createInviteCode } from '../src/lib/invite-codes';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

interface GenerateOptions {
  count: number;
  maxUses: number;
  expiresInDays?: number;
  adminEmail?: string;
  metadata?: Record<string, any>;
}

async function generateInviteCodes(options: GenerateOptions) {
  const {
    count = 1,
    maxUses = 1,
    expiresInDays,
    adminEmail,
    metadata = {}
  } = options;

  console.log('🔐 Generating invite codes...\n');
  console.log(`Count: ${count}`);
  console.log(`Max uses per code: ${maxUses}`);
  if (expiresInDays) console.log(`Expires in: ${expiresInDays} days`);
  if (adminEmail) console.log(`Admin email: ${adminEmail}`);
  console.log('\n-----------------------------------\n');

  const supabase = getSupabaseAdmin();
  
  // Get admin user if email provided
  let adminId: string | undefined;
  if (adminEmail) {
    const { data: admin } = await supabase
      .from('users')
      .select('id')
      .eq('email', adminEmail)
      .eq('role', 'admin')
      .single();
    
    if (admin) {
      adminId = admin.id;
    } else {
      console.warn(`⚠️  Admin user with email ${adminEmail} not found. Creating codes without admin association.`);
    }
  }

  const codes: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const code = await createInviteCode({
        createdBy: adminId,
        maxUses,
        expiresInDays,
        metadata: {
          ...metadata,
          generatedBy: 'script',
          generatedAt: new Date().toISOString(),
          purpose: metadata.purpose || 'general-access'
        }
      });
      
      codes.push(code);
      console.log(`✅ Generated code ${i + 1}: ${code}`);
    } catch (error) {
      const errorMsg = `Failed to generate code ${i + 1}: ${error}`;
      errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  console.log('\n-----------------------------------\n');
  console.log(`✅ Successfully generated ${codes.length} codes`);
  if (errors.length > 0) {
    console.log(`❌ Failed to generate ${errors.length} codes`);
  }

  console.log('\n📋 All generated codes:\n');
  codes.forEach((code, index) => {
    console.log(`${index + 1}. ${code}`);
  });

  console.log('\n-----------------------------------');
  console.log('🔗 Share these codes with authorized users');
  console.log('🌐 Users can redeem codes at: /invite');
  console.log('-----------------------------------\n');

  return codes;
}

// Parse command line arguments
function parseArgs(): GenerateOptions {
  const args = process.argv.slice(2);
  const options: GenerateOptions = {
    count: 1,
    maxUses: 1
  };

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--count':
      case '-c':
        options.count = parseInt(value, 10);
        break;
      case '--max-uses':
      case '-m':
        options.maxUses = parseInt(value, 10);
        break;
      case '--expires-days':
      case '-e':
        options.expiresInDays = parseInt(value, 10);
        break;
      case '--admin-email':
      case '-a':
        options.adminEmail = value;
        break;
      case '--purpose':
      case '-p':
        options.metadata = { ...options.metadata, purpose: value };
        break;
      case '--help':
      case '-h':
        console.log(`
Argos Invite Code Generator

Usage:
  npm run generate-invite-codes -- [options]

Options:
  --count, -c         Number of codes to generate (default: 1)
  --max-uses, -m      Maximum uses per code (default: 1)
  --expires-days, -e  Days until expiration (optional)
  --admin-email, -a   Email of admin creating codes (optional)
  --purpose, -p       Purpose of codes (optional)
  --help, -h          Show this help message

Examples:
  # Generate 5 single-use codes
  npm run generate-invite-codes -- --count 5

  # Generate 1 code with 10 uses that expires in 30 days
  npm run generate-invite-codes -- --max-uses 10 --expires-days 30

  # Generate codes with admin association
  npm run generate-invite-codes -- --count 3 --admin-email admin@example.com
        `);
        process.exit(0);
    }
  }

  return options;
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    await generateInviteCodes(options);
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { generateInviteCodes };