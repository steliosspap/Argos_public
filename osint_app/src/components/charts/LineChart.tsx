'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface DataPoint {
  x: number;
  y: number;
  label?: string;
}

interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  showGrid?: boolean;
  showLabels?: boolean;
  animate?: boolean;
}

export default function LineChart({
  data,
  width = 300,
  height = 150,
  color = '#3B82F6',
  showGrid = true,
  showLabels = true,
  animate = true
}: LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  if (data.length === 0) return null;

  const padding = 20;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const xMin = Math.min(...data.map(d => d.x));
  const xMax = Math.max(...data.map(d => d.x));
  const yMin = Math.min(...data.map(d => d.y));
  const yMax = Math.max(...data.map(d => d.y));

  const scaleX = (x: number) => ((x - xMin) / (xMax - xMin)) * chartWidth + padding;
  const scaleY = (y: number) => height - (((y - yMin) / (yMax - yMin)) * chartHeight + padding);

  const pathData = data
    .map((point, index) => {
      const x = scaleX(point.x);
      const y = scaleY(point.y);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg ref={svgRef} width={width} height={height} className="overflow-visible">
      {/* Grid */}
      {showGrid && (
        <g className="text-gray-700">
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding + chartHeight * (1 - ratio);
            return (
              <line
                key={`h-${ratio}`}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="currentColor"
                strokeDasharray="2,2"
                opacity={0.2}
              />
            );
          })}
          {/* Vertical grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const x = padding + chartWidth * ratio;
            return (
              <line
                key={`v-${ratio}`}
                x1={x}
                y1={padding}
                x2={x}
                y2={height - padding}
                stroke="currentColor"
                strokeDasharray="2,2"
                opacity={0.2}
              />
            );
          })}
        </g>
      )}

      {/* Line */}
      <motion.path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={2}
        initial={animate ? { pathLength: 0 } : { pathLength: 1 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />

      {/* Data points */}
      {data.map((point, index) => (
        <motion.circle
          key={index}
          cx={scaleX(point.x)}
          cy={scaleY(point.y)}
          r={3}
          fill={color}
          initial={animate ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: (index / data.length) * 0.5 }}
        />
      ))}

      {/* Labels */}
      {showLabels && (
        <>
          {/* Y-axis labels */}
          <text x={padding - 5} y={padding} className="text-xs fill-gray-400" textAnchor="end">
            {yMax}
          </text>
          <text x={padding - 5} y={height - padding} className="text-xs fill-gray-400" textAnchor="end">
            {yMin}
          </text>
          
          {/* X-axis labels */}
          {data.length > 0 && (
            <>
              <text x={padding} y={height - 5} className="text-xs fill-gray-400" textAnchor="middle">
                {data[0].label || xMin}
              </text>
              <text x={width - padding} y={height - 5} className="text-xs fill-gray-400" textAnchor="middle">
                {data[data.length - 1].label || xMax}
              </text>
            </>
          )}
        </>
      )}
    </svg>
  );
}