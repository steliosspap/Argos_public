import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge'; // Use edge runtime for better performance
export const dynamic = 'force-dynamic';

// Keep connection alive for streaming
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  
  // Create a readable stream for Server-Sent Events
  const readable = new ReadableStream({
    async start(controller) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );

      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`)
      );

      // Subscribe to real-time events
      const channel = supabase
        .channel('events-changes')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'events' 
          }, 
          (payload) => {
            // Send new event to client
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'new_event', 
                event: payload.new,
                timestamp: new Date().toISOString() 
              })}\n\n`)
            );
          }
        )
        .on('postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'events'
          },
          (payload) => {
            // Send updated event to client
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'update_event', 
                event: payload.new,
                timestamp: new Date().toISOString() 
              })}\n\n`)
            );
          }
        )
        .subscribe();

      // Keep alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() })}\n\n`)
          );
        } catch (error) {
          clearInterval(pingInterval);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        supabase.removeChannel(channel);
        controller.close();
      });
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}