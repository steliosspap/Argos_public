'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function IngestButton() {
  const [isIngesting, setIsIngesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runIngestion = async () => {
    setIsIngesting(true);
    setResult(null);
    
    try {
      // Use massive ingestion endpoint for maximum data
      const response = await fetch('/api/ingest-massive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      setResult(data);
      
      // If successful, show impressive stats
      if (data.success) {
        console.log('Massive ingestion stats:', data.stats);
      }
      
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <motion.button
        onClick={runIngestion}
        disabled={isIngesting}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`
          px-4 py-2 rounded-lg font-medium text-white shadow-lg
          ${isIngesting 
            ? 'bg-gray-500 cursor-not-allowed' 
            : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800'
          }
        `}
      >
        {isIngesting ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Ingesting...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Run Ingestion</span>
          </div>
        )}
      </motion.button>
      
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`
            mt-2 p-3 rounded-lg text-sm
            ${result.success 
              ? 'bg-green-500/20 border border-green-500/50 text-green-300'
              : 'bg-red-500/20 border border-red-500/50 text-red-300'
            }
          `}
        >
          {result.success ? (
            <div>
              <p className="font-medium">✅ Massive Ingestion Complete!</p>
              <div className="text-xs mt-1 space-y-1">
                <p>📰 {result.stats?.articlesProcessed || 0} articles processed</p>
                <p>🎯 {result.stats?.eventsInserted || 0} new events added</p>
                <p>⚡ {result.stats?.articlesPerSecond || 0} articles/sec</p>
                <p>⏱️ Completed in {result.duration || '0s'}</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-medium">❌ Ingestion Failed</p>
              <p className="text-xs mt-1">{result.error}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}