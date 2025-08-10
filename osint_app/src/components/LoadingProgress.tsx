'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface LoadingProgressProps {
  message?: string;
  progress?: number;
  className?: string;
}

export default function LoadingProgress({ 
  message = 'Loading live events...', 
  progress,
  className = '' 
}: LoadingProgressProps) {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 shadow-lg ${className}`}>
      <div className="flex items-center space-x-3">
        {/* Spinner */}
        <div className="relative">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          {progress !== undefined && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white">{Math.round(progress)}%</span>
            </div>
          )}
        </div>

        {/* Message */}
        <div className="flex-1">
          <p className="text-sm text-white font-medium">{message}</p>
          
          {/* Progress bar */}
          {progress !== undefined && (
            <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
              <motion.div
                className="bg-blue-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}