'use client';

import { motion } from 'framer-motion';

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  showValues?: boolean;
  orientation?: 'vertical' | 'horizontal';
  animate?: boolean;
  labelWidth?: number; // Width in pixels for horizontal labels
}

export default function BarChart({
  data,
  height = 200,
  showValues = true,
  orientation = 'vertical',
  animate = true,
  labelWidth = 120
}: BarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value));

  if (orientation === 'horizontal') {
    return (
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-3">
            <div 
              className="text-xs text-gray-400 text-right pr-2" 
              style={{ minWidth: `${labelWidth}px` }}
              title={item.label}
            >
              <span className="block break-words">
                {item.label.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex-1 relative">
              <motion.div
                initial={animate ? { width: 0 } : false}
                animate={{ width: `${(item.value / maxValue) * 100}%` }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="h-6 rounded"
                style={{ backgroundColor: item.color || '#3B82F6' }}
              />
              {showValues && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white font-medium">
                  {item.value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ height }} className="flex items-end space-x-2">
      {data.map((item, index) => (
        <div key={index} className="flex-1 flex flex-col items-center">
          <div className="relative w-full flex items-end justify-center" style={{ height: height - 40 }}>
            <motion.div
              initial={animate ? { height: 0 } : false}
              animate={{ height: `${(item.value / maxValue) * 100}%` }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="w-full max-w-12 rounded-t"
              style={{ backgroundColor: item.color || '#3B82F6' }}
            >
              {showValues && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-gray-300 font-medium whitespace-nowrap">
                  {item.value}
                </div>
              )}
            </motion.div>
          </div>
          <div className="mt-2 text-xs text-gray-400 text-center truncate w-full">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}