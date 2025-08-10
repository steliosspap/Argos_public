'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StreamEvent {
  id: string;
  title: string;
  country: string;
  severity: string;
  timestamp: string;
  isNew?: boolean;
}

export default function RealTimeStream() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    // Subscribe to real-time events
    const channel = supabase
      .channel('realtime-events')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'events' 
        }, 
        (payload) => {
          const newEvent: StreamEvent = {
            id: payload.new.id,
            title: payload.new.title,
            country: payload.new.country,
            severity: payload.new.severity,
            timestamp: payload.new.timestamp,
            isNew: true
          };
          
          setEvents(prev => [newEvent, ...prev].slice(0, 10)); // Keep last 10
          setEventCount(prev => prev + 1);
          
          // Remove "new" status after animation
          setTimeout(() => {
            setEvents(prev => 
              prev.map(e => e.id === newEvent.id ? { ...e, isNew: false } : e)
            );
          }, 3000);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="fixed bottom-20 right-4 w-80 z-40">
      {/* Connection Status */}
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-gray-400">
            {isConnected ? 'Live Stream Connected' : 'Connecting...'}
          </span>
        </div>
        <span className="text-gray-500">
          {eventCount} events today
        </span>
      </div>

      {/* Event Stream */}
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-800 shadow-2xl overflow-hidden">
        <div className="px-4 py-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Live Event Stream
          </h3>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          <AnimatePresence>
            {events.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                Waiting for new events...
              </div>
            ) : (
              events.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ 
                    opacity: 1, 
                    x: 0,
                    backgroundColor: event.isNew ? 'rgba(147, 51, 234, 0.1)' : 'transparent'
                  }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="p-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white line-clamp-2">
                        {event.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">
                          {event.country}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          event.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                          event.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          event.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {event.severity}
                        </span>
                      </div>
                    </div>
                    {event.isNew && (
                      <span className="text-xs text-purple-400 font-medium animate-pulse">
                        NEW
                      </span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}