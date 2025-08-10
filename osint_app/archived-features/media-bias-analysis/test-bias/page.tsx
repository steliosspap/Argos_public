'use client';

import { CompactBiasIndicator } from '@/components/analysis/CompactBiasIndicator';
import { BiasMeter } from '@/components/analysis/BiasMeter';
import { VerificationBadge } from '@/components/analysis/VerificationBadge';

export default function TestBiasPage() {
  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <h1 className="text-2xl font-bold text-white mb-8">Bias Detection Components Test</h1>
      
      <div className="space-y-8">
        {/* Test Compact Bias Indicators */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Compact Bias Indicators</h2>
          <div className="space-y-2">
            <div className="bg-gray-900 p-4 rounded-lg">
              <p className="text-white mb-2">Balanced article:</p>
              <CompactBiasIndicator biasScore={0} verificationStatus="verified" />
            </div>
            
            <div className="bg-gray-900 p-4 rounded-lg">
              <p className="text-white mb-2">Lean left article:</p>
              <CompactBiasIndicator biasScore={-1.5} verificationStatus="partially-verified" />
            </div>
            
            <div className="bg-gray-900 p-4 rounded-lg">
              <p className="text-white mb-2">Right bias article:</p>
              <CompactBiasIndicator biasScore={3} verificationStatus="disputed" />
            </div>
            
            <div className="bg-gray-900 p-4 rounded-lg">
              <p className="text-white mb-2">Far left article:</p>
              <CompactBiasIndicator biasScore={-4.5} verificationStatus="unverified" />
            </div>
          </div>
        </section>

        {/* Test Bias Meter */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Bias Meter</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BiasMeter
              biasScore={-2}
              biasCategory="left"
              confidence={0.85}
              indicators={[
                { type: 'loaded-language', severity: 'medium', description: 'Uses partisan terminology' },
                { type: 'one-sided', severity: 'high', description: 'Presents only one perspective' }
              ]}
            />
            
            <BiasMeter
              biasScore={0.5}
              biasCategory="center"
              confidence={0.95}
              indicators={[
                { type: 'balanced', severity: 'low', description: 'Presents multiple viewpoints' }
              ]}
            />
          </div>
        </section>

        {/* Test Verification Badge */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Verification Badges</h2>
          <div className="space-y-4">
            <VerificationBadge
              status="verified"
              score={0.9}
              confidence={0.95}
              sourcesCount={5}
              geographicReach={true}
              summary="Claims verified by multiple independent sources"
            />
            
            <VerificationBadge
              status="partially-verified"
              score={0.6}
              confidence={0.7}
              sourcesCount={3}
              summary="Some claims verified, others lack evidence"
              claims={[
                { claim: 'Main event occurred on stated date', status: 'supported', confidence: 0.9 },
                { claim: 'Casualty numbers as reported', status: 'unverified', confidence: 0.3 }
              ]}
            />
            
            <VerificationBadge
              status="disputed"
              score={0.3}
              confidence={0.8}
              sourcesCount={4}
              summary="Conflicting reports from different sources"
            />
          </div>
        </section>
      </div>
    </div>
  );
}