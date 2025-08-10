'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface CompactBiasIndicatorProps {
  biasScore?: number; // -5 to +5
  verificationStatus?: 'verified' | 'partially-verified' | 'disputed' | 'unverified';
  className?: string;
}

export const CompactBiasIndicator: React.FC<CompactBiasIndicatorProps> = ({
  biasScore,
  verificationStatus,
  className = ''
}) => {
  if (!biasScore && !verificationStatus) return null;

  // Determine bias color and label
  const getBiasInfo = (score: number) => {
    const absScore = Math.abs(score);
    if (absScore <= 1) return { color: 'text-green-400', bg: 'bg-green-500/10', label: 'Balanced' };
    if (absScore <= 2.5) return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: score > 0 ? 'Lean Right' : 'Lean Left' };
    if (absScore <= 4) return { color: 'text-orange-400', bg: 'bg-orange-500/10', label: score > 0 ? 'Right' : 'Left' };
    return { color: 'text-red-400', bg: 'bg-red-500/10', label: score > 0 ? 'Far Right' : 'Far Left' };
  };

  // Verification status config
  const verificationConfig = {
    verified: { icon: '✓', color: 'text-green-400', bg: 'bg-green-500/10' },
    'partially-verified': { icon: '⚠', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    disputed: { icon: '✗', color: 'text-red-400', bg: 'bg-red-500/10' },
    unverified: { icon: '?', color: 'text-gray-400', bg: 'bg-gray-500/10' }
  };

  const biasInfo = biasScore ? getBiasInfo(biasScore) : null;
  const verifyInfo = verificationStatus ? verificationConfig[verificationStatus] : null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {biasInfo && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${biasInfo.bg}`}
        >
          <div 
            className="w-2 h-2 rounded-full"
            style={{
              background: `linear-gradient(to ${biasScore > 0 ? 'right' : 'left'}, currentColor, transparent)`,
            }}
          />
          <span className={biasInfo.color}>{biasInfo.label}</span>
        </motion.div>
      )}
      
      {verifyInfo && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${verifyInfo.bg}`}
          title={verificationStatus}
        >
          <span className={verifyInfo.color}>{verifyInfo.icon}</span>
          <span className={verifyInfo.color}>
            {verificationStatus === 'verified' ? 'Verified' :
             verificationStatus === 'partially-verified' ? 'Partial' :
             verificationStatus === 'disputed' ? 'Disputed' :
             'Unverified'}
          </span>
        </motion.div>
      )}
    </div>
  );
};