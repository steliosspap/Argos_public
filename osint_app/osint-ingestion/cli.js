#!/usr/bin/env node

/**
 * OSINT Pipeline CLI
 * Command-line interface for the OSINT ingestion system
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { createClient } from '@supabase/supabase-js';

import { config, validateConfig } from './core/config.js';
import { IngestionService } from './services/IngestionService.js';
import { Source } from './models/Source.js';
import { ConflictEvent } from './models/Event.js';

const program = new Command();

// Validate configuration on startup
try {
  validateConfig();
} catch (error) {
  console.error(chalk.red('Configuration error:'), error.message);
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
  config.database.supabase.url,
  config.database.supabase.serviceKey
);

program
  .name('osint-pipeline')
  .description('OSINT Conflict Event Pipeline - Real-time conflict intelligence')
  .version('1.0.0');

// Ingestion command
program
  .command('ingest')
  .description('Run ingestion cycle to collect and process conflict data')
  .option('-d, --dry-run', 'Run without saving to database')
  .option('-v, --verbose', 'Show detailed output')
  .option('-l, --limit <number>', 'Limit number of articles to process', parseInt, 100)
  .option('-s, --source <type>', 'Limit to specific source type (google, rss, newsapi, all)', 'all')
  .action(async (options) => {
    const spinner = ora('Starting OSINT ingestion...').start();
    
    try {
      const ingestionService = new IngestionService({
        dryRun: options.dryRun,
        verbose: options.verbose,
        limit: options.limit
      });
      
      spinner.text = 'Collecting articles from sources...';
      const result = await ingestionService.ingest();
      
      spinner.succeed('Ingestion completed successfully');
      
      // Display results
      console.log('\n' + chalk.bold('Ingestion Results:'));
      console.log(chalk.green(`✓ Articles searched: ${result.stats.searched}`));
      console.log(chalk.green(`✓ Articles fetched: ${result.stats.fetched}`));
      console.log(chalk.green(`✓ Articles analyzed: ${result.stats.analyzed}`));
      console.log(chalk.green(`✓ Events extracted: ${result.stats.eventsExtracted}`));
      
      if (result.stats.errors.length > 0) {
        console.log(chalk.yellow(`⚠ Errors: ${result.stats.errors.length}`));
        if (options.verbose) {
          result.stats.errors.forEach(err => console.log(chalk.yellow(`  - ${err}`)));
        }
      }
      
      // Show sample events
      if (result.events.length > 0 && options.verbose) {
        console.log('\n' + chalk.bold('Sample Events:'));
        result.events.slice(0, 5).forEach(cluster => {
          const event = cluster.primaryEvent;
          console.log(chalk.cyan(`\n- ${event.enhancedHeadline}`));
          console.log(`  Location: ${event.locationName}, ${event.country}`);
          console.log(`  Time: ${event.timestamp.toISOString()}`);
          console.log(`  Severity: ${event.severity} (${event.escalationScore}/10)`);
          if (event.casualties.killed) {
            console.log(`  Casualties: ${event.casualties.killed} killed, ${event.casualties.wounded || 0} wounded`);
          }
          console.log(`  Sources: ${cluster.sourceCount}`);
        });
      }
      
    } catch (error) {
      spinner.fail('Ingestion failed');
      console.error(chalk.red('Error:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Sources management
program
  .command('sources')
  .description('Manage news sources')
  .option('-l, --list', 'List all sources')
  .option('-a, --add <url>', 'Add new source')
  .option('-d, --disable <id>', 'Disable source')
  .option('-s, --stats', 'Show source statistics')
  .action(async (options) => {
    if (options.list) {
      const spinner = ora('Fetching sources...').start();
      
      try {
        const { data: sources, error } = await supabase
          .from('news_sources')
          .select('*')
          .order('reliability_score', { ascending: false });
        
        if (error) throw error;
        
        spinner.stop();
        
        const table = new Table({
          head: ['ID', 'Name', 'Type', 'Reliability', 'Bias', 'Status', 'Last Fetch'],
          colWidths: [15, 30, 15, 12, 10, 10, 20]
        });
        
        sources.forEach(source => {
          const meta = source.metadata || {};
          table.push([
            source.id.substring(0, 13) + '...',
            source.name,
            meta.sourceType || 'news',
            `${source.reliability_score}%`,
            source.bias_score.toFixed(2),
            meta.isActive ? chalk.green('Active') : chalk.red('Inactive'),
            meta.lastSuccessfulFetch ? new Date(meta.lastSuccessfulFetch).toLocaleDateString() : 'Never'
          ]);
        });
        
        console.log(chalk.bold('\nNews Sources:'));
        console.log(table.toString());
        console.log(`\nTotal: ${sources.length} sources`);
        
      } catch (error) {
        spinner.fail('Failed to fetch sources');
        console.error(chalk.red('Error:'), error.message);
      }
    }
    
    if (options.stats) {
      const spinner = ora('Calculating statistics...').start();
      
      try {
        const { data: sources } = await supabase
          .from('news_sources')
          .select('*');
        
        const stats = {
          total: sources.length,
          active: sources.filter(s => s.metadata?.isActive).length,
          byType: {},
          avgReliability: 0,
          avgBias: 0
        };
        
        sources.forEach(source => {
          const type = source.metadata?.sourceType || 'news';
          stats.byType[type] = (stats.byType[type] || 0) + 1;
          stats.avgReliability += source.reliability_score;
          stats.avgBias += Math.abs(source.bias_score);
        });
        
        stats.avgReliability /= sources.length;
        stats.avgBias /= sources.length;
        
        spinner.stop();
        
        console.log(chalk.bold('\nSource Statistics:'));
        console.log(`Total sources: ${stats.total}`);
        console.log(`Active sources: ${stats.active}`);
        console.log(`Average reliability: ${stats.avgReliability.toFixed(1)}%`);
        console.log(`Average bias: ${stats.avgBias.toFixed(2)}`);
        console.log('\nSources by type:');
        Object.entries(stats.byType).forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
        
      } catch (error) {
        spinner.fail('Failed to calculate statistics');
        console.error(chalk.red('Error:'), error.message);
      }
    }
  });

// Events query
program
  .command('events')
  .description('Query conflict events')
  .option('-l, --limit <number>', 'Number of events to show', parseInt, 10)
  .option('-c, --country <name>', 'Filter by country')
  .option('-t, --type <type>', 'Filter by event type')
  .option('-s, --severity <level>', 'Minimum severity (low, medium, high, critical)')
  .option('-d, --days <number>', 'Events from last N days', parseInt, 7)
  .action(async (options) => {
    const spinner = ora('Fetching events...').start();
    
    try {
      let query = supabase
        .from('events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(options.limit);
      
      // Apply filters
      if (options.country) {
        query = query.ilike('country', `%${options.country}%`);
      }
      if (options.type) {
        query = query.eq('event_type', options.type);
      }
      if (options.severity) {
        const severityLevels = ['low', 'medium', 'high', 'critical'];
        const minLevel = severityLevels.indexOf(options.severity);
        query = query.in('severity', severityLevels.slice(minLevel));
      }
      if (options.days) {
        const since = new Date();
        since.setDate(since.getDate() - options.days);
        query = query.gte('timestamp', since.toISOString());
      }
      
      const { data: events, error } = await query;
      
      if (error) throw error;
      
      spinner.stop();
      
      if (events.length === 0) {
        console.log(chalk.yellow('No events found matching criteria'));
        return;
      }
      
      console.log(chalk.bold(`\nFound ${events.length} events:\n`));
      
      events.forEach((event, index) => {
        const eventObj = ConflictEvent.fromDatabase(event);
        
        console.log(chalk.bold.cyan(`${index + 1}. ${eventObj.enhancedHeadline || eventObj.title}`));
        console.log(`   ${chalk.gray('Location:')} ${eventObj.locationName}, ${eventObj.country}`);
        console.log(`   ${chalk.gray('Time:')} ${new Date(eventObj.timestamp).toLocaleString()}`);
        console.log(`   ${chalk.gray('Type:')} ${eventObj.eventType} | ${chalk.gray('Severity:')} ${eventObj.severity}`);
        
        if (eventObj.casualties.killed || eventObj.casualties.wounded) {
          console.log(`   ${chalk.gray('Casualties:')} ${eventObj.casualties.killed || 0} killed, ${eventObj.casualties.wounded || 0} wounded`);
        }
        
        console.log(`   ${chalk.gray('Reliability:')} ${Math.round(eventObj.reliability * 100)}%`);
        console.log('');
      });
      
    } catch (error) {
      spinner.fail('Failed to fetch events');
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Monitor mode
program
  .command('monitor')
  .description('Run continuous monitoring mode')
  .option('-i, --interval <minutes>', 'Check interval in minutes', parseInt, 15)
  .option('-a, --alerts', 'Enable critical event alerts')
  .action(async (options) => {
    console.log(chalk.bold.green('Starting OSINT monitoring mode...'));
    console.log(chalk.gray(`Checking every ${options.interval} minutes`));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));
    
    const ingestionService = new IngestionService({
      verbose: false,
      limit: 50
    });
    
    const runCycle = async () => {
      const spinner = ora('Running ingestion cycle...').start();
      
      try {
        const result = await ingestionService.ingest();
        
        spinner.succeed(`Cycle complete: ${result.stats.eventsExtracted} events extracted`);
        
        // Show critical events
        if (options.alerts) {
          const criticalEvents = result.events
            .filter(c => c.primaryEvent.requiresAlert())
            .map(c => c.primaryEvent);
          
          if (criticalEvents.length > 0) {
            console.log('\n' + chalk.red.bold('🚨 CRITICAL EVENTS DETECTED:'));
            criticalEvents.forEach(event => {
              console.log(chalk.red(`- ${event.enhancedHeadline}`));
              console.log(`  ${event.locationName}, ${event.country} | ${event.severity.toUpperCase()}`);
            });
            console.log('');
          }
        }
        
      } catch (error) {
        spinner.fail('Cycle failed');
        console.error(chalk.red('Error:'), error.message);
      }
    };
    
    // Run immediately
    await runCycle();
    
    // Set up interval
    setInterval(runCycle, options.interval * 60 * 1000);
  });

// Test command
program
  .command('test')
  .description('Test pipeline components')
  .option('-s, --source <url>', 'Test specific source')
  .option('-t, --text <text>', 'Test text processing')
  .action(async (options) => {
    if (options.source) {
      console.log(chalk.bold('Testing source:', options.source));
      // Implement source testing
    }
    
    if (options.text) {
      console.log(chalk.bold('Testing text processing...'));
      
      const { TextProcessor } = await import('./services/TextProcessor.js');
      const processor = new TextProcessor();
      
      const relevance = processor.classifyConflictRelevance(options.text);
      const entities = await processor.extractEntities(options.text);
      const temporal = processor.extractTemporalInfo(options.text);
      
      console.log('\nRelevance:', relevance);
      console.log('\nEntities:', entities);
      console.log('\nTemporal:', temporal);
    }
  });

// Help text
program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ osint-pipeline ingest --verbose');
  console.log('  $ osint-pipeline events --country Ukraine --days 1');
  console.log('  $ osint-pipeline monitor --interval 30 --alerts');
  console.log('  $ osint-pipeline sources --list');
});

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}