'use client';

import { motion } from 'framer-motion';

interface TrendIndicatorProps {
  title: string;
  current: number;
  previous: number;
  format?: 'number' | 'currency' | 'percentage';
  suffix?: string;
  icon?: React.ReactNode;
}

export default function TrendIndicator({
  title,
  current,
  previous,
  format = 'number',
  suffix = '',
  icon
}: TrendIndicatorProps) {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const isPositive = change >= 0;

  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        return `$${value.toLocaleString()}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">{title}</p>
          <motion.p
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-2xl font-bold text-white"
          >
            {formatValue(current)}{suffix}
          </motion.p>
          
          {previous > 0 && (
            <div className="flex items-center space-x-1 mt-2">
              <svg
                className={`w-4 h-4 ${isPositive ? 'text-green-400' : 'text-red-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isPositive ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'}
                />
              </svg>
              <span className={`text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {Math.abs(change).toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500">
                vs previous
              </span>
            </div>
          )}
        </div>
        
        {icon && (
          <div className="p-2 bg-gray-800 rounded-lg text-gray-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}