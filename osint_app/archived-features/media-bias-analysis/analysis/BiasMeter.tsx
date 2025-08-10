'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface BiasMeterProps {
  biasScore: number; // -5 to +5
  biasCategory: string;
  confidence: number;
  indicators?: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  className?: string;
}

export const BiasMeter: React.FC<BiasMeterProps> = ({
  biasScore,
  biasCategory,
  confidence,
  indicators = [],
  className = ''
}) => {
  // Calculate position on meter (0-100%)
  const meterPosition = ((biasScore + 5) / 10) * 100;

  // Determine color based on bias score
  const getColor = (score: number) => {
    const absScore = Math.abs(score);
    if (absScore <= 1) return '#10B981'; // Green - balanced
    if (absScore <= 2.5) return '#F59E0B'; // Yellow - slight bias
    if (absScore <= 4) return '#EF4444'; // Red - significant bias
    return '#991B1B'; // Dark red - extreme bias
  };

  const color = getColor(biasScore);

  // Bias labels for the meter
  const biasLabels = [
    { position: 0, label: 'Far Left' },
    { position: 25, label: 'Left' },
    { position: 50, label: 'Center' },
    { position: 75, label: 'Right' },
    { position: 100, label: 'Far Right' }
  ];

  return (
    <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Bias Analysis</h3>
          <p className="text-sm text-gray-400 mt-1">
            Confidence: {Math.round(confidence * 100)}%
          </p>
        </div>
        <div className="text-right">
          <span 
            className="text-2xl font-bold"
            style={{ color }}
          >
            {biasScore > 0 ? '+' : ''}{biasScore.toFixed(1)}
          </span>
          <p className="text-sm text-gray-400 capitalize">{biasCategory}</p>
        </div>
      </div>

      {/* Bias Meter */}
      <div className="relative h-12 mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-gray-600 to-red-600 rounded-full opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-gray-500 to-red-500 rounded-full h-2 top-5" />
        
        {/* Position marker */}
        <motion.div
          className="absolute w-4 h-4 rounded-full shadow-lg"
          style={{
            backgroundColor: color,
            left: `${meterPosition}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className="absolute inset-0 rounded-full animate-ping opacity-50" style={{ backgroundColor: color }} />
        </motion.div>

        {/* Labels */}
        <div className="absolute w-full top-10">
          {biasLabels.map((label) => (
            <div
              key={label.label}
              className="absolute text-xs text-gray-400"
              style={{ left: `${label.position}%`, transform: 'translateX(-50%)' }}
            >
              {label.label}
            </div>
          ))}
        </div>
      </div>

      {/* Bias Indicators */}
      {indicators.length > 0 && (
        <div className="mt-6 space-y-2">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Key Indicators</h4>
          {indicators.slice(0, 3).map((indicator, index) => (
            <div
              key={index}
              className="flex items-start space-x-2 text-sm"
            >
              <span
                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  indicator.severity === 'high' ? 'bg-red-500' :
                  indicator.severity === 'medium' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`}
              />
              <div className="flex-1">
                <span className="text-gray-300 capitalize">{indicator.type}:</span>
                <span className="text-gray-400 ml-1">{indicator.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Explanation tooltip */}
      <div className="mt-4 p-3 bg-gray-800 rounded-md">
        <p className="text-xs text-gray-400">
          <span className="font-medium text-gray-300">How we measure bias:</span> Our AI analyzes 
          language patterns, source diversity, emotional appeals, and fact selection to determine 
          political lean and other forms of bias. Scores range from -5 (far left) to +5 (far right).
        </p>
      </div>
    </div>
  );
};