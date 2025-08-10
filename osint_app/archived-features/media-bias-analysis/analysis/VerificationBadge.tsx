'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VerificationBadgeProps {
  status: 'verified' | 'partially-verified' | 'disputed' | 'unverified';
  score: number;
  confidence: number;
  sourcesCount: number;
  geographicReach?: boolean;
  summary?: string;
  expandable?: boolean;
  claims?: Array<{
    claim: string;
    status: string;
    confidence: number;
  }>;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  status,
  score,
  confidence,
  sourcesCount,
  geographicReach = false,
  summary,
  expandable = true,
  claims = []
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    verified: {
      iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      label: 'Verified',
      description: 'Claims corroborated by multiple sources'
    },
    'partially-verified': {
      iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      label: 'Partially Verified',
      description: 'Some claims verified, others unclear'
    },
    disputed: {
      iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      label: 'Disputed',
      description: 'Conflicting reports from sources'
    },
    unverified: {
      iconPath: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/30',
      label: 'Unverified',
      description: 'Insufficient evidence to verify'
    }
  };

  const config = statusConfig[status];

  return (
    <div className="w-full">
      <motion.div
        className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4 cursor-pointer`}
        onClick={() => expandable && setIsExpanded(!isExpanded)}
        whileHover={expandable ? { scale: 1.02 } : {}}
        whileTap={expandable ? { scale: 0.98 } : {}}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <svg className={`w-6 h-6 ${config.color} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.iconPath} />
            </svg>
            <div className="flex-1">
              <h4 className={`font-semibold ${config.color}`}>
                {config.label}
              </h4>
              <p className="text-sm text-gray-400 mt-1">
                {summary || config.description}
              </p>
              
              <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{sourcesCount} sources</span>
                </div>
                {geographicReach && (
                  <div className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Global coverage</span>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <span>Confidence: {Math.round(confidence * 100)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end space-y-2">
            <div className="text-right">
              <div className={`text-2xl font-bold ${config.color}`}>
                {Math.round(score * 100)}%
              </div>
              <p className="text-xs text-gray-400">Verification Score</p>
            </div>
            
            {expandable && (
              <motion.svg
                className="w-5 h-5 text-gray-400"
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </motion.svg>
            )}
          </div>
        </div>
      </motion.div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && claims.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-4 bg-gray-800/50 rounded-lg space-y-3">
              <h5 className="text-sm font-medium text-gray-300 mb-3">Claim Verification Details</h5>
              {claims.map((claim, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      claim.status === 'supported' ? 'bg-green-500' :
                      claim.status === 'disputed' ? 'bg-red-500' :
                      claim.status === 'partially-supported' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm text-gray-300">{claim.claim}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {claim.status.replace('-', ' ')} • {Math.round(claim.confidence * 100)}% confidence
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};