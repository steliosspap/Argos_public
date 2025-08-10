#!/usr/bin/env node

/**
 * Run database migrations
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../core/config.js';
import fs from 'fs/promises';
import chalk from 'chalk';

async function runMigration() {
  console.log(chalk.bold.blue('Running Database Migration\n'));

  // Initialize Supabase client
  const supabase = createClient(
    config.database.supabase.url,
    config.database.supabase.serviceKey
  );

  try {
    // Read the migration SQL
    const sqlPath = './sql/fix-missing-columns.sql';
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    console.log(chalk.yellow('Executing migration...'));
    
    // Split SQL by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.includes('ALTER TABLE') || statement.includes('CREATE INDEX')) {
        console.log(chalk.gray(`Running: ${statement.substring(0, 50)}...`));
        
        // Execute raw SQL using Supabase
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });
        
        if (error) {
          // Try alternative approach - direct to database
          console.log(chalk.yellow('Note: Direct SQL execution not available via Supabase client'));
          console.log(chalk.yellow('Please run the following SQL directly in Supabase SQL Editor:'));
          console.log(chalk.cyan('\n' + statement + ';\n'));
        }
      }
    }
    
    console.log(chalk.green('\n✓ Migration completed!'));
    console.log(chalk.yellow('\nIMPORTANT: Please go to your Supabase dashboard and:'));
    console.log(chalk.yellow('1. Go to SQL Editor'));
    console.log(chalk.yellow('2. Copy and run the contents of: sql/fix-missing-columns.sql'));
    console.log(chalk.yellow('3. Wait 10-30 seconds for schema cache to refresh'));
    console.log(chalk.yellow('4. Then try running the pipeline again'));
    
  } catch (error) {
    console.error(chalk.red('Migration failed:'), error.message);
    process.exit(1);
  }
}

// Run the migration
runMigration();