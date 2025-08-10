import { useEffect, useRef } from 'react';

interface UseAutoAnalysisProps {
  items: any[];
  type: 'news' | 'events';
  enabled?: boolean;
}

export function useAutoAnalysis({ items, type, enabled = true }: UseAutoAnalysisProps) {
  const analyzedIds = useRef<Set<string>>(new Set());
  const analysisInProgress = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !items.length) return;

    // Find items that need analysis
    const itemsToAnalyze = items.filter(item => 
      !item.has_analysis && 
      !analyzedIds.current.has(item.id) &&
      !analysisInProgress.current.has(item.id) &&
      (type === 'news' ? item.url : item.source_url) // Must have a URL
    );

    if (itemsToAnalyze.length === 0) return;

    // Limit to 10 items per batch
    const batch = itemsToAnalyze.slice(0, 10);
    const batchIds = batch.map(item => item.id);

    // Mark as in progress
    batchIds.forEach(id => analysisInProgress.current.add(id));

    // Trigger analysis
    fetch('/api/analyze-visible', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ids: batchIds })
    })
      .then(res => res.json())
      .then(result => {
        // Mark as analyzed
        batchIds.forEach(id => {
          analyzedIds.current.add(id);
          analysisInProgress.current.delete(id);
        });

        // Log results
        if (result.analyzed > 0) {
          console.log(`[useAutoAnalysis] Analyzed ${result.analyzed} ${type} items`);
        }
      })
      .catch(error => {
        console.error('[useAutoAnalysis] Error:', error);
        // Remove from in progress on error
        batchIds.forEach(id => analysisInProgress.current.delete(id));
      });

  }, [items, type, enabled]);

  return {
    analyzedCount: analyzedIds.current.size,
    inProgressCount: analysisInProgress.current.size
  };
}