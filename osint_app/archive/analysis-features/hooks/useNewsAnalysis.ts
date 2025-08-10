import { useState, useEffect } from 'react';
import { Event } from '@/types';

interface AnalysisData {
  biasScore?: number;
  biasCategory?: string;
  verificationStatus?: 'verified' | 'partially-verified' | 'disputed' | 'unverified';
  verificationScore?: number;
  confidence?: number;
  summary?: string;
}

export function useNewsAnalysis(event: Event | null) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event?.source_url || event.has_analysis) {
      // Already has analysis or no URL to analyze
      return;
    }

    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/analysis/bias?url=${encodeURIComponent(event.source_url)}`);
        
        if (response.status === 404) {
          // No analysis found - that's okay
          setAnalysis(null);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch analysis');
        }

        const data = await response.json();
        if (data.success && data.data) {
          setAnalysis({
            biasScore: data.data.biasAnalysis?.overallBias,
            biasCategory: data.data.biasAnalysis?.biasCategory,
            verificationStatus: data.data.factCheckResult?.overallVerification,
            verificationScore: data.data.factCheckResult?.verificationScore,
            confidence: data.data.biasAnalysis?.confidence,
            summary: data.data.summary
          });
        }
      } catch (err) {
        console.error('Error fetching analysis:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    // Delay fetch to avoid too many requests
    const timer = setTimeout(fetchAnalysis, 1000);
    return () => clearTimeout(timer);
  }, [event]);

  return { analysis, loading, error };
}

export function triggerAnalysis(event: Event) {
  if (!event.source_url || event.has_analysis) {
    return Promise.resolve();
  }

  return fetch('/api/analysis/bias', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: event.id,
      title: event.title,
      content: event.summary,
      source: event.channel,
      url: event.source_url,
      publishedDate: event.timestamp
    })
  }).catch(err => {
    console.error('Failed to trigger analysis:', err);
  });
}