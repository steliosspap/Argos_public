'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileMapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleLegend?: () => void;
  showLegend?: boolean;
  legendContent?: React.ReactNode;
  className?: string;
}

export default function MobileMapControls({
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleLegend,
  showLegend = false,
  legendContent,
  className = ''
}: MobileMapControlsProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <>
      {/* Map Controls */}
      <div className={`absolute bottom-4 right-4 flex flex-col space-y-2 z-10 ${className}`}>
        <button
          onClick={onResetView}
          className="bg-gray-800/90 backdrop-blur-sm hover:bg-gray-700 text-white p-3 md:p-2.5 rounded-lg shadow-lg transition-all touch-manipulation active:scale-95"
          aria-label="Reset map view"
        >
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>
        
        <button
          onClick={onZoomIn}
          className="bg-gray-800/90 backdrop-blur-sm hover:bg-gray-700 text-white p-3 md:p-2.5 rounded-lg shadow-lg transition-all touch-manipulation active:scale-95"
          aria-label="Zoom in"
        >
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        
        <button
          onClick={onZoomOut}
          className="bg-gray-800/90 backdrop-blur-sm hover:bg-gray-700 text-white p-3 md:p-2.5 rounded-lg shadow-lg transition-all touch-manipulation active:scale-95"
          aria-label="Zoom out"
        >
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      </div>

      {/* Legend - Collapsible on mobile */}
      {legendContent && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg text-white text-xs shadow-lg">
            {isMobile && onToggleLegend ? (
              <>
                <button
                  onClick={onToggleLegend}
                  className="w-full p-3 flex items-center justify-between hover:bg-gray-700/50 rounded-lg transition-colors touch-manipulation"
                  aria-label="Toggle legend"
                >
                  <span className="font-semibold">Legend</span>
                  <svg 
                    className={`w-4 h-4 transition-transform ${showLegend ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <AnimatePresence>
                  {showLegend && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 pt-0">
                        {legendContent}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="p-3">
                {legendContent}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}