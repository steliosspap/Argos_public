'use client';

import { useEffect, useState } from 'react';

export default function DebugNewsPage() {
  const [newsData, setNewsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/news?limit=5')
      .then(res => res.json())
      .then(data => {
        setNewsData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-white">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <h1 className="text-2xl font-bold text-white mb-4">News Data Debug</h1>
      
      <div className="bg-gray-900 rounded-lg p-4 mb-4">
        <p className="text-gray-400 mb-2">Total items: {newsData?.data?.length || 0}</p>
        <p className="text-gray-400">Items with analysis: {newsData?.data?.filter((item: any) => item.has_analysis).length || 0}</p>
      </div>

      <div className="space-y-4">
        {newsData?.data?.map((item: any, index: number) => (
          <div key={item.id} className="bg-gray-900 rounded-lg p-4">
            <h3 className="text-white font-medium mb-2">{index + 1}. {item.title || item.headline}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Source: <span className="text-white">{item.source}</span></p>
                <p className="text-gray-400">Has Analysis: <span className={item.has_analysis ? 'text-green-400' : 'text-red-400'}>{String(item.has_analysis)}</span></p>
                <p className="text-gray-400">Bias Score: <span className="text-white">{item.bias_score ?? 'null'}</span></p>
              </div>
              <div>
                <p className="text-gray-400">Verification: <span className="text-white">{item.verification_status || 'null'}</span></p>
                <p className="text-gray-400">Escalation: <span className="text-white">{item.escalation_score}</span></p>
                <p className="text-gray-400">Region: <span className="text-white">{item.region}</span></p>
              </div>
            </div>
            <details className="mt-2">
              <summary className="text-gray-400 cursor-pointer text-xs">Full JSON</summary>
              <pre className="mt-2 text-xs text-gray-500 overflow-x-auto">
                {JSON.stringify(item, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}