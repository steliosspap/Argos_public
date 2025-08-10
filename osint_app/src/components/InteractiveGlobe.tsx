'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';

const Globe = dynamic(() => import('react-globe.gl'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
    </div>
  )
});

interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  size: number;
  color: string;
  title: string;
  summary: string;
  country: string;
  region: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface InteractiveGlobeProps {
  className?: string;
}

export interface InteractiveGlobeHandle {
  getGlobe: () => any;
  resetView: () => void;
  getPointOfView: () => any;
}

const InteractiveGlobe = forwardRef<InteractiveGlobeHandle, InteractiveGlobeProps>(function InteractiveGlobe({ 
  className = ''
}, ref) {
  const [globeReady, setGlobeReady] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showTouchHint, setShowTouchHint] = useState(false);
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Expose globe methods to parent component
  useImperativeHandle(ref, () => ({
    // Expose the globe instance
    getGlobe: () => globeRef.current,
    // Add any custom methods that parent might need
    resetView: () => {
      if (globeRef.current) {
        globeRef.current.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 1000);
      }
    },
    // Get current point of view
    getPointOfView: () => {
      if (globeRef.current) {
        return globeRef.current.pointOfView();
      }
      return null;
    }
  }), []);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Show touch hint on touch-capable devices
      if ('ontouchstart' in window) {
        setShowTouchHint(true);
        // Hide hint after 5 seconds
        setTimeout(() => setShowTouchHint(false), 5000);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    // Use ResizeObserver for more accurate container size tracking
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
      
      // Clean up touch event listeners
      if (globeRef.current && (globeRef.current as any)._touchCleanup) {
        (globeRef.current as any)._touchCleanup();
      }
    };
  }, []);

  const sampleMarkers = useMemo<MarkerData[]>(() => [
    {
      id: '1',
      lat: 50.4501,
      lng: 30.5234,
      size: 0.8,
      color: '#ef4444',
      title: 'Ukraine Conflict Zone',
      summary: 'Ongoing military operations in eastern regions with high-intensity combat activities.',
      country: 'Ukraine',
      region: 'Eastern Europe',
      timestamp: '2024-01-15T14:30:00Z',
      severity: 'critical'
    },
    {
      id: '2',
      lat: 33.3152,
      lng: 44.3661,
      size: 0.6,
      color: '#ef4444',
      title: 'Iraq Security Incident',
      summary: 'Security forces responding to coordinated attacks in Baghdad province.',
      country: 'Iraq',
      region: 'Middle East',
      timestamp: '2024-01-14T09:15:00Z',
      severity: 'high'
    },
    {
      id: '3',
      lat: 15.5527,
      lng: 32.5599,
      size: 0.7,
      color: '#dc2626',
      title: 'Sudan Humanitarian Crisis',
      summary: 'Escalating conflict affecting civilian populations across multiple states.',
      country: 'Sudan',
      region: 'Northeast Africa',
      timestamp: '2024-01-13T16:45:00Z',
      severity: 'critical'
    },
    {
      id: '4',
      lat: 34.5553,
      lng: 69.2075,
      size: 0.5,
      color: '#f59e0b',
      title: 'Afghanistan Border Tensions',
      summary: 'Cross-border incidents reported along Pakistan-Afghanistan frontier.',
      country: 'Afghanistan',
      region: 'Central Asia',
      timestamp: '2024-01-12T11:20:00Z',
      severity: 'medium'
    },
    {
      id: '5',
      lat: 36.2048,
      lng: 138.2529,
      size: 0.3,
      color: '#f97316',
      title: 'East China Sea Monitoring',
      summary: 'Increased naval activity and territorial disputes in international waters.',
      country: 'Japan',
      region: 'East Asia',
      timestamp: '2024-01-11T08:30:00Z',
      severity: 'medium'
    },
    {
      id: '6',
      lat: 6.5244,
      lng: 3.3792,
      size: 0.5,
      color: '#ef4444',
      title: 'Nigeria Security Operations',
      summary: 'Counter-terrorism operations in northern regions affecting local communities.',
      country: 'Nigeria',
      region: 'West Africa',
      timestamp: '2024-01-10T13:00:00Z',
      severity: 'high'
    }
  ], []);

  const handleMarkerClick = useCallback((point: any) => {
    const marker = sampleMarkers.find(m => m.id === point.id);
    if (marker) {
      setSelectedMarker(marker);
    }
  }, [sampleMarkers]);

  const handleGlobeReady = useCallback(() => {
    setGlobeReady(true);
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      
      // Enable touch controls for rotation
      controls.enableRotate = true;
      controls.rotateSpeed = 0.8;
      
      // Disable zoom for pinch gestures to allow pure rotation
      controls.enableZoom = true;
      controls.zoomSpeed = 0.5;
      
      // Set initial view to fill the container better
      globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2.0 }, 0);
      
      // Add custom touch handling for two-finger horizontal rotation
      const globeElement = globeRef.current.renderer().domElement;
      let initialTouchX = 0;
      let initialLng = 0;
      let touchCount = 0;
      
      const handleTouchStart = (e: TouchEvent) => {
        touchCount = e.touches.length;
        if (touchCount === 2) {
          // Stop auto-rotation when user interacts
          controls.autoRotate = false;
          
          // Calculate average X position of two touches
          initialTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const pov = globeRef.current.pointOfView();
          initialLng = pov.lng;
          
          // Prevent default to stop zooming
          e.preventDefault();
        }
      };
      
      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2 && touchCount === 2) {
          // Calculate average X position of two touches
          const currentTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const deltaX = currentTouchX - initialTouchX;
          
          // Calculate rotation based on horizontal movement
          const rotationAmount = (deltaX / globeElement.width) * 180;
          
          // Update globe longitude
          const pov = globeRef.current.pointOfView();
          globeRef.current.pointOfView({
            lat: pov.lat,
            lng: initialLng - rotationAmount,
            altitude: pov.altitude
          }, 0);
          
          e.preventDefault();
        }
      };
      
      const handleTouchEnd = (e: TouchEvent) => {
        if (touchCount === 2) {
          // Resume auto-rotation after interaction
          setTimeout(() => {
            controls.autoRotate = true;
          }, 3000);
        }
        touchCount = e.touches.length;
      };
      
      // Add touch event listeners
      globeElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      globeElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      globeElement.addEventListener('touchend', handleTouchEnd);
      
      // Store cleanup function
      (globeRef.current as any)._touchCleanup = () => {
        globeElement.removeEventListener('touchstart', handleTouchStart);
        globeElement.removeEventListener('touchmove', handleTouchMove);
        globeElement.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, []);

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <Globe
        ref={(el) => {
          if (el) {
            globeRef.current = el;
          }
        }}
        globeImageUrl="//unpkg.com/three-globe@2.24.0/example/img/earth-night.jpg"
        backgroundImageUrl={isMobile ? undefined : "//unpkg.com/three-globe@2.24.0/example/img/night-sky.png"}
        
        animateIn={!isMobile}
        rendererConfig={{
          antialias: !isMobile,
          alpha: true,
          powerPreference: isMobile ? 'low-power' : 'high-performance'
        }}
        
        pointsData={sampleMarkers}
        pointAltitude={0.01}
        pointColor="color"
        pointRadius="size"
        pointResolution={isMobile ? 4 : 8}
        
        atmosphereColor="#1e40af"
        atmosphereAltitude={0.15}
        
        enablePointerInteraction={true}
        onPointClick={handleMarkerClick}
        
        onGlobeReady={handleGlobeReady}
        
        width={dimensions.width || undefined}
        height={dimensions.height || undefined}
      />

      {selectedMarker && (
        <div className="absolute top-4 right-4 bg-white dark:bg-black/90 backdrop-blur-sm rounded-lg p-4 max-w-sm text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getSeverityColor(selectedMarker.severity)}`}></div>
              <span className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">{selectedMarker.severity}</span>
            </div>
            <button
              onClick={() => setSelectedMarker(null)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <h3 className="font-semibold mb-1">{selectedMarker.title}</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{selectedMarker.summary}</p>
          
          <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span>{selectedMarker.country}</span>
            <span>•</span>
            <span>{selectedMarker.region}</span>
            <span>•</span>
            <span>{formatDate(selectedMarker.timestamp)}</span>
          </div>
        </div>
      )}

      {!globeReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white/70 text-sm">Loading Global Intelligence...</p>
          </div>
        </div>
      )}
      
      {/* Touch hint for two-finger rotation */}
      {showTouchHint && globeReady && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm flex items-center gap-2 animate-fadeIn pointer-events-none">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Use two fingers to rotate the globe</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      )}
    </div>
  );
});

InteractiveGlobe.displayName = 'InteractiveGlobe';

export default InteractiveGlobe;