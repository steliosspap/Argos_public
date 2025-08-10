import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = headers().get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run the ingestion pipeline
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    console.log('Starting news ingestion...');
    
    // Run the mass fetcher
    const fetchResult = await execAsync('node scripts/mass-fetcher.js', {
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    console.log('RSS fetch completed:', fetchResult.stdout);
    
    // Parse the output to find the saved file
    const match = fetchResult.stdout.match(/Results saved to: (.+\.json)/);
    if (!match) {
      throw new Error('Could not find output file from fetcher');
    }
    
    const outputFile = match[1];
    
    // Process through ingestion
    const ingestResult = await execAsync(`node scripts/ingest-news.js --batch-file ${outputFile}`, {
      maxBuffer: 1024 * 1024 * 10
    });
    
    console.log('Ingestion completed:', ingestResult.stdout);
    
    // Parse results
    const articlesMatch = fetchResult.stdout.match(/Total articles: (\d+)/);
    const eventsMatch = ingestResult.stdout.match(/(\d+) events inserted/);
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      articlesProcessed: articlesMatch ? parseInt(articlesMatch[1]) : 0,
      eventsInserted: eventsMatch ? parseInt(eventsMatch[1]) : 0,
      message: 'News ingestion completed successfully'
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Ingestion failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}