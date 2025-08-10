'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BiasMeter } from '@/components/analysis/BiasMeter';
import { VerificationBadge } from '@/components/analysis/VerificationBadge';

interface AnalysisPanelProps {
  isOpen: boolean;
  biasAnalysis?: {
    overallBias: number;
    biasCategory: string;
    confidence: number;
    indicators: Array<{
      type: string;
      severity: string;
      description: string;
    }>;
    explanation: string;
  };
  factCheckResult?: {
    overallVerification: 'verified' | 'partially-verified' | 'disputed' | 'unverified';
    verificationScore: number;
    confidence: number;
    corroboratingSources: Array<{ source: string }>;
    geographicCoverage?: { globalReach: boolean };
    summary: string;
    claims?: Array<{
      claim: string;
      status: string;
      confidence: number;
    }>;
  };
  loading?: boolean;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  isOpen,
  biasAnalysis,
  factCheckResult,
  loading = false
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="border-t border-gray-700 pt-4 mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                <span className="ml-3 text-gray-400">Analyzing article...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Bias Analysis */}
                {biasAnalysis && (
                  <div>
                    <BiasMeter
                      biasScore={biasAnalysis.overallBias}
                      biasCategory={biasAnalysis.biasCategory}
                      confidence={biasAnalysis.confidence}
                      indicators={biasAnalysis.indicators}
                      className="h-full"
                    />
                  </div>
                )}

                {/* Fact Check Results */}
                {factCheckResult && (
                  <div>
                    <div className="bg-gray-900 rounded-lg p-6 h-full">
                      <h3 className="text-lg font-semibold text-white mb-4">Fact Check Results</h3>
                      <VerificationBadge
                        status={factCheckResult.overallVerification}
                        score={factCheckResult.verificationScore}
                        confidence={factCheckResult.confidence}
                        sourcesCount={factCheckResult.corroboratingSources?.length || 0}
                        geographicReach={factCheckResult.geographicCoverage?.globalReach}
                        summary={factCheckResult.summary}
                        claims={factCheckResult.claims}
                        expandable={true}
                      />
                    </div>
                  </div>
                )}

                {/* No Analysis Available */}
                {!biasAnalysis && !factCheckResult && !loading && (
                  <div className="col-span-2 text-center py-8 text-gray-400">
                    <p>No analysis available for this article yet.</p>
                    <button className="mt-2 text-blue-400 hover:text-blue-300 text-sm">
                      Request Analysis
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};