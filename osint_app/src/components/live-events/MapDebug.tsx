'use client';

export default function MapDebug() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  
  // Only show in development mode
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  
  return (
    <div className="fixed bottom-20 left-4 bg-black/90 text-white p-4 rounded-lg text-xs max-w-md z-50">
      <h3 className="font-bold mb-2">Map Debug Info:</h3>
      <div className="space-y-1">
        <div>
          <span className="text-gray-400">Mapbox Token:</span>{' '}
          {token ? (
            <span className="text-green-400">{token.substring(0, 20)}...</span>
          ) : (
            <span className="text-red-400">NOT FOUND</span>
          )}
        </div>
        <div>
          <span className="text-gray-400">Token Length:</span>{' '}
          <span className={token ? 'text-green-400' : 'text-red-400'}>
            {token ? token.length : 0}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Environment:</span>{' '}
          <span className="text-blue-400">{process.env.NODE_ENV}</span>
        </div>
        <div className="mt-2 text-yellow-400">
          {!token && 'Please restart the Next.js dev server after adding environment variables!'}
        </div>
      </div>
    </div>
  );
}