#!/usr/bin/env node

/**
 * Export Events to Mapbox
 * 
 * This script exports events from the database to CSV format
 * and uploads them to Mapbox as a dataset for visualization
 */

const { createClient } = require('@supabase/supabase-js');
const { exportRecentEvents, exportAllEvents } = require('../osint-ingestion/utils/csvExport');
const { uploadToMapboxDataset, uploadCSVToMapboxTilesets } = require('../osint-ingestion/utils/mapboxUpload');
const { validateEnvironment } = require('../osint-ingestion/utils/envValidator');
const fs = require('fs');
const path = require('path');

// Command line arguments
const args = process.argv.slice(2);
const mode = args[0] || 'recent'; // 'recent', 'all', or 'incremental'
const uploadMethod = args[1] || 'dataset'; // 'dataset' or 'tileset'

// Configuration
const CONFIG = {
  EXPORT_DIR: path.join(__dirname, '../exports'),
  BATCH_SIZE: 10000,
  RETENTION_DAYS: 7, // Keep exported files for 7 days
  MAPBOX_DATASET_NAME: 'OSINT Events Dataset',
  MAPBOX_TILESET_NAME: 'OSINT Events Tileset'
};

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting Events to Mapbox export...');
  console.log(`Mode: ${mode}, Upload Method: ${uploadMethod}`);

  let exportResult = null;
  let uploadResult = null;

  try {
    // Validate environment
    console.log('🔍 Validating environment...');
    validateEnvironment([
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN'
    ]);

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Clean up old export files
    await cleanupOldExports(CONFIG.EXPORT_DIR, CONFIG.RETENTION_DAYS);

    // Export events to CSV
    console.log('📊 Exporting events to CSV...');
    exportResult = await exportEvents(supabase, mode);

    if (!exportResult) {
      console.log('ℹ️  No events to export, exiting...');
      return;
    }

    // Upload to Mapbox
    console.log('🗺️  Uploading to Mapbox...');
    uploadResult = await uploadToMapbox(exportResult.path, uploadMethod);

    // Success summary
    console.log('\n✅ Export completed successfully!');
    console.log('📈 Summary:');
    console.log(`  • Events exported: ${exportResult.count}`);
    console.log(`  • CSV file size: ${(exportResult.size / 1024).toFixed(2)} KB`);
    console.log(`  • Export file: ${exportResult.path}`);
    
    if (uploadResult.datasetId) {
      console.log(`  • Dataset ID: ${uploadResult.datasetId}`);
      console.log(`  • Features uploaded: ${uploadResult.featuresUploaded}`);
      console.log(`  • Dataset URL: ${uploadResult.datasetUrl}`);
    }

    if (uploadResult.sourceId) {
      console.log(`  • Source ID: ${uploadResult.sourceId}`);
      console.log(`  • Upload ID: ${uploadResult.uploadId}`);
    }

    // Clean up CSV file after successful upload (optional)
    if (process.env.CLEANUP_AFTER_UPLOAD === 'true') {
      fs.unlinkSync(exportResult.path);
      console.log('🗑️  Cleaned up CSV file after upload');
    }

  } catch (error) {
    console.error('❌ Export failed:', error);
    
    // Clean up on error
    if (exportResult?.path && fs.existsSync(exportResult.path)) {
      try {
        fs.unlinkSync(exportResult.path);
        console.log('🗑️  Cleaned up CSV file after error');
      } catch (cleanupError) {
        console.error('⚠️  Failed to clean up CSV file:', cleanupError);
      }
    }
    
    process.exit(1);
  }
}

/**
 * Export events based on mode
 */
async function exportEvents(supabase, mode) {
  const options = {
    outputDir: CONFIG.EXPORT_DIR,
    onlyWithCoordinates: true
  };

  switch (mode) {
    case 'recent':
      return await exportRecentEvents(supabase, options);
    
    case 'all':
      return await exportAllEvents(supabase, {
        ...options,
        batchSize: CONFIG.BATCH_SIZE
      });
    
    case 'incremental':
      return await exportIncrementalEvents(supabase, options);
    
    default:
      throw new Error(`Unknown export mode: ${mode}`);
  }
}

/**
 * Export incremental events (since last export)
 */
async function exportIncrementalEvents(supabase, options) {
  const lastExportPath = path.join(CONFIG.EXPORT_DIR, '.last-export');
  let lastExportTime = null;

  // Read last export timestamp
  if (fs.existsSync(lastExportPath)) {
    try {
      const lastExportData = fs.readFileSync(lastExportPath, 'utf8');
      lastExportTime = new Date(lastExportData.trim());
    } catch (error) {
      console.warn('⚠️  Failed to read last export timestamp, doing full export');
    }
  }

  // Set date range for incremental export
  const dateRange = lastExportTime ? {
    start: lastExportTime.toISOString()
  } : null;

  console.log(lastExportTime ? 
    `📅 Exporting events since ${lastExportTime.toISOString()}` :
    '📅 No previous export found, doing full export'
  );

  // Export events
  const { exportEventsToCSV } = require('../osint-ingestion/utils/csvExport');
  const result = await exportEventsToCSV(supabase, {
    ...options,
    dateRange,
    filename: `incremental_events_${new Date().toISOString().split('T')[0]}.csv`
  });

  // Update last export timestamp
  if (result) {
    fs.writeFileSync(lastExportPath, new Date().toISOString());
    console.log('📝 Updated last export timestamp');
  }

  return result;
}

/**
 * Upload to Mapbox based on method
 */
async function uploadToMapbox(csvPath, method) {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const username = process.env.MAPBOX_USERNAME;

  switch (method) {
    case 'dataset':
      return await uploadToMapboxDataset(csvPath, {
        accessToken,
        datasetId: process.env.MAPBOX_DATASET_ID,
        datasetName: CONFIG.MAPBOX_DATASET_NAME,
        description: 'OSINT Events data exported from database',
        replace: true
      });
    
    case 'tileset':
      return await uploadCSVToMapboxTilesets(csvPath, {
        accessToken,
        username,
        sourceName: 'events-source',
        replace: true
      });
    
    default:
      throw new Error(`Unknown upload method: ${method}`);
  }
}

/**
 * Clean up old export files
 */
async function cleanupOldExports(exportDir, retentionDays) {
  if (!fs.existsSync(exportDir)) {
    return;
  }

  const now = Date.now();
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  
  try {
    const files = fs.readdirSync(exportDir);
    let cleanedCount = 0;

    for (const file of files) {
      const filePath = path.join(exportDir, file);
      const stat = fs.statSync(filePath);

      if (stat.isFile() && file.endsWith('.csv')) {
        const age = now - stat.mtime.getTime();
        
        if (age > retentionMs) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`🗑️  Cleaned up ${cleanedCount} old export files`);
    }
  } catch (error) {
    console.warn('⚠️  Failed to clean up old exports:', error);
  }
}

/**
 * Display help information
 */
function displayHelp() {
  console.log(`
📋 Events to Mapbox Export Script

Usage:
  node export-to-mapbox.js [mode] [upload-method]

Modes:
  recent      Export events from last 24 hours (default)
  all         Export all events from database
  incremental Export events since last export

Upload Methods:
  dataset     Upload to Mapbox Dataset (default)
  tileset     Upload to Mapbox Tileset

Environment Variables:
  NEXT_PUBLIC_SUPABASE_URL     - Supabase project URL
  SUPABASE_SERVICE_KEY         - Supabase service key
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN - Mapbox access token
  MAPBOX_USERNAME              - Mapbox username (for tilesets)
  MAPBOX_DATASET_ID            - Existing dataset ID (optional)
  CLEANUP_AFTER_UPLOAD         - Clean up CSV after upload (optional)

Examples:
  node export-to-mapbox.js recent dataset
  node export-to-mapbox.js all tileset
  node export-to-mapbox.js incremental dataset

For more information, see the documentation.
`);
}

// Handle help flag
if (args.includes('--help') || args.includes('-h')) {
  displayHelp();
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main();
}

module.exports = { main, exportEvents, uploadToMapbox };