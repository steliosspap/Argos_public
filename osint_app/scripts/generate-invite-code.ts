import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  email: '',
  name: '',
  maxUses: 1,
  expiresInDays: 30,
  count: 1
};

// Parse arguments
for (let i = 0; i < args.length; i += 2) {
  const flag = args[i];
  const value = args[i + 1];
  
  switch (flag) {
    case '--email':
      options.email = value;
      break;
    case '--name':
      options.name = value;
      break;
    case '--uses':
      options.maxUses = parseInt(value) || 1;
      break;
    case '--days':
      options.expiresInDays = parseInt(value) || 30;
      break;
    case '--count':
      options.count = parseInt(value) || 1;
      break;
    case '--help':
      console.log(`
Usage: npx tsx scripts/generate-invite-code.ts [options]

Options:
  --email <email>     Email of the person (for metadata)
  --name <name>       Name of the person (for metadata)
  --uses <number>     Max uses for the code (default: 1)
  --days <number>     Days until expiration (default: 30)
  --count <number>    Number of codes to generate (default: 1)
  --help              Show this help message

Examples:
  # Generate a single-use code for a specific person
  npx tsx scripts/generate-invite-code.ts --email john@example.com --name "John Doe"
  
  # Generate 5 codes with 3 uses each
  npx tsx scripts/generate-invite-code.ts --count 5 --uses 3
  
  # Generate a code that expires in 7 days
  npx tsx scripts/generate-invite-code.ts --days 7
`);
      process.exit(0);
  }
}

async function generateCodes() {
  console.log('🔑 Generating invite codes...\n');
  
  const codes = [];
  
  for (let i = 0; i < options.count; i++) {
    const metadata: any = {
      generated_by: 'cli_script',
      generated_at: new Date().toISOString()
    };
    
    if (options.email) metadata.intended_email = options.email;
    if (options.name) metadata.intended_name = options.name;
    
    const { data, error } = await supabase.rpc('generate_invite_code', {
      p_length: 8,
      p_created_by: null,
      p_max_uses: options.maxUses,
      p_expires_in_days: options.expiresInDays,
      p_metadata: metadata
    });
    
    if (error) {
      console.error('❌ Failed to generate code:', error);
    } else {
      codes.push(data);
      console.log(`✅ Generated: ${data}`);
      
      // If email/name provided, show personalized message
      if (options.email || options.name) {
        console.log(`   For: ${options.name || 'Unknown'} <${options.email || 'No email'}>`);
      }
      console.log(`   Max uses: ${options.maxUses}`);
      console.log(`   Expires: ${options.expiresInDays} days\n`);
    }
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`Total codes generated: ${codes.length}`);
  
  if (codes.length === 1 && (options.email || options.name)) {
    console.log(`\n📧 Send this code to ${options.name || options.email}:`);
    console.log(`\n   ${codes[0]}\n`);
    console.log(`They can use it at: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite`);
  }
}

// Run the script
generateCodes()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });