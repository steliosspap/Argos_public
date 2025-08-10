import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(_request: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  // Log at the very beginning to confirm cron execution
  console.log(`[CRON] Start intelligent ingestion - RequestID: ${requestId}`);
  console.log(`[CRON] Timestamp: ${new Date().toISOString()}`);
  console.log(`[CRON] Headers:`, JSON.stringify(Object.fromEntries(headers())));
  
  // Check if this is a Vercel Cron execution
  const authHeader = headers().get('authorization');
  const isVercelCron = authHeader && authHeader.startsWith('Bearer ');
  console.log(`[CRON] Is Vercel Cron: ${isVercelCron}`);

  let ingestion;
  let results;

  try {
    console.log(`[CRON] Importing IntelligentIngestion module...`);
    
    // Import and run the intelligent ingestion
    const { IntelligentIngestion } = await import('@/lib/intelligent-ingestion');
    
    console.log(`[CRON] Creating IntelligentIngestion instance...`);
    
    ingestion = new IntelligentIngestion({
      dryRun: false,
      verbose: true,
      limit: 50
    });
    
    console.log(`[CRON] Starting ingestion.run()...`);
    
    results = await ingestion.run();
    
    const duration = Date.now() - startTime;
    console.log(`[CRON] Ingestion completed successfully in ${duration}ms`);
    console.log(`[CRON] Results:`, JSON.stringify(results));
    
    // Add a small delay to ensure logs are flushed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`[CRON] Finished intelligent ingestion - RequestID: ${requestId}`);
    
    return NextResponse.json({
      success: true,
      stats: results,
      timestamp: new Date().toISOString(),
      duration: duration,
      requestId: requestId,
      isVercelCron: isVercelCron
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error(`[CRON ERROR] Intelligent ingestion failed - RequestID: ${requestId}`);
    console.error(`[CRON ERROR] Error name: ${error.name}`);
    console.error(`[CRON ERROR] Error message: ${error.message}`);
    console.error(`[CRON ERROR] Error stack:`, error.stack);
    console.error(`[CRON ERROR] Duration before failure: ${duration}ms`);
    
    // Add a small delay to ensure error logs are flushed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        errorName: error.name,
        timestamp: new Date().toISOString(),
        duration: duration,
        requestId: requestId,
        isVercelCron: isVercelCron
      },
      { status: 500 }
    );
  }
}

// Use Node.js runtime for full compatibility with googleapis
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max