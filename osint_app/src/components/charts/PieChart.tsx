'use client';

import { motion } from 'framer-motion';

interface PieChartData {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieChartData[];
  size?: number;
  showLabels?: boolean;
  animate?: boolean;
}

export default function PieChart({
  data,
  size = 200,
  showLabels = true,
  animate = true
}: PieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = size / 2;
  const centerX = radius;
  const centerY = radius;

  let currentAngle = -Math.PI / 2; // Start at top

  const createPath = (startAngle: number, endAngle: number) => {
    const x1 = centerX + Math.cos(startAngle) * radius;
    const y1 = centerY + Math.sin(startAngle) * radius;
    const x2 = centerX + Math.cos(endAngle) * radius;
    const y2 = centerY + Math.sin(endAngle) * radius;

    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {data.map((item, index) => {
          const percentage = item.value / total;
          const angle = percentage * Math.PI * 2;
          const endAngle = currentAngle + angle;
          const path = createPath(currentAngle, endAngle);

          const result = (
            <motion.path
              key={index}
              d={path}
              fill={item.color}
              initial={animate ? { scale: 0, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              style={{ transformOrigin: `${centerX}px ${centerY}px` }}
            />
          );

          currentAngle = endAngle;
          return result;
        })}
      </svg>

      {showLabels && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-gray-900 rounded-lg p-2 shadow-lg">
            <div className="space-y-1">
              {data.map((item, index) => (
                <div key={index} className="flex items-center space-x-2 text-xs">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-400">{item.label}</span>
                  <span className="text-gray-300 font-medium">
                    {Math.round((item.value / total) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}