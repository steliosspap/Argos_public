'use client';

import { motion } from 'framer-motion';

interface HeatMapCell {
  value: number;
  label?: string;
}

interface HeatMapProps {
  data: HeatMapCell[][];
  rowLabels?: string[];
  columnLabels?: string[];
  title?: string;
  colorScale?: {
    min: string;
    mid: string;
    max: string;
  };
}

export default function HeatMap({
  data,
  rowLabels = [],
  columnLabels = [],
  title,
  colorScale = {
    min: '#1F2937', // gray-800
    mid: '#3B82F6', // blue-500
    max: '#EF4444'  // red-500
  }
}: HeatMapProps) {
  // Find max value for scaling
  const maxValue = Math.max(...data.flat().map(cell => cell.value));
  const minValue = Math.min(...data.flat().map(cell => cell.value));

  const getColor = (value: number) => {
    const normalized = (value - minValue) / (maxValue - minValue);
    
    if (normalized < 0.5) {
      // Interpolate between min and mid
      const ratio = normalized * 2;
      return interpolateColor(colorScale.min, colorScale.mid, ratio);
    } else {
      // Interpolate between mid and max
      const ratio = (normalized - 0.5) * 2;
      return interpolateColor(colorScale.mid, colorScale.max, ratio);
    }
  };

  const interpolateColor = (color1: string, color2: string, ratio: number) => {
    // Simple color interpolation (works with hex colors)
    const hex2rgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 };
    };

    const c1 = hex2rgb(color1);
    const c2 = hex2rgb(color2);

    const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
    const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
    const b = Math.round(c1.b + (c2.b - c1.b) * ratio);

    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="space-y-3">
      {title && (
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      )}
      
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Column labels */}
          {columnLabels.length > 0 && (
            <div className="flex">
              <div className="w-20" /> {/* Spacer for row labels */}
              {columnLabels.map((label, i) => (
                <div key={i} className="flex-1 text-xs text-gray-400 text-center px-1 pb-2">
                  {label}
                </div>
              ))}
            </div>
          )}
          
          {/* Heatmap grid */}
          {data.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {/* Row label */}
              {rowLabels[rowIndex] && (
                <div className="w-20 text-xs text-gray-400 pr-2 flex items-center justify-end">
                  {rowLabels[rowIndex]}
                </div>
              )}
              
              {/* Cells */}
              {row.map((cell, colIndex) => (
                <motion.div
                  key={colIndex}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: (rowIndex * row.length + colIndex) * 0.01 }}
                  className="flex-1 aspect-square m-0.5 rounded relative group cursor-pointer"
                  style={{ backgroundColor: getColor(cell.value) }}
                >
                  {/* Tooltip */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                      {cell.label || cell.value}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center space-x-4 text-xs text-gray-400">
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: colorScale.min }} />
          <span>Low</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: colorScale.mid }} />
          <span>Medium</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: colorScale.max }} />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}