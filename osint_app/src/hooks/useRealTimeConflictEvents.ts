import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

interface ConflictEventProperties {
  title: string;
  escalation_score: number;
  severity: string;
  region: string;
  date?: string;
  description?: string;
}

interface ConflictEventFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: ConflictEventProperties;
}

interface ConflictEventsGeoJSON {
  type: 'FeatureCollection';
  features: ConflictEventFeature[];
}

const SOURCE_ID = 'conflict-events';
const LAYER_ID = 'conflict-events-layer';
const POLL_INTERVAL = 30000; // 30 seconds

export function useRealTimeConflictEvents(map: mapboxgl.Map | null) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSourceAddedRef = useRef(false);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // Function to determine circle color based on escalation score
  const getCircleColor = (score: number): string => {
    if (score > 8) return '#8B0000'; // Dark red
    if (score >= 5) return '#FF8C00'; // Orange
    return '#FFD700'; // Yellow
  };

  // Function to determine circle radius based on escalation score
  const getCircleRadius = (score: number): number => {
    // Base radius of 8, scaling up to 20 for high scores
    return Math.min(8 + (score * 1.2), 20);
  };

  // Fetch conflict events from API
  const fetchConflictEvents = async (): Promise<ConflictEventsGeoJSON | null> => {
    try {
      const response = await fetch('/api/events/geojson', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Validate the data structure
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
        console.error('Invalid GeoJSON structure received');
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching conflict events:', error);
      return null;
    }
  };

  // Initialize or update the map source and layer
  const updateMapData = useCallback(async (map: mapboxgl.Map) => {
    try {
      // Ensure map style is loaded
      if (!map.isStyleLoaded()) {
        console.log('Map style not loaded yet, waiting...');
        return;
      }

      // Fetch latest data
      const geoJsonData = await fetchConflictEvents();
      if (!geoJsonData) return;

      // Check if source exists
      const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;

      if (source) {
        // Update existing source
        source.setData(geoJsonData);
        console.log(`Updated ${geoJsonData.features.length} conflict events`);
      } else if (!isSourceAddedRef.current) {
        // Add source for the first time
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geoJsonData,
        });

        // Add layer with dynamic styling
        map.addLayer({
          id: LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'escalation_score'],
              0, 8,
              10, 20
            ],
            'circle-color': [
              'case',
              ['>', ['get', 'escalation_score'], 8],
              '#8B0000', // Dark red
              ['>=', ['get', 'escalation_score'], 5],
              '#FF8C00', // Orange
              '#FFD700' // Yellow
            ],
            'circle-opacity': 0.8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-opacity': 0.8,
          },
        });

        // Add hover effect
        map.on('mouseenter', LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });

        // Add click handler for popups
        map.on('click', LAYER_ID, (e) => {
          if (!e.features || e.features.length === 0) return;

          const feature = e.features[0] as any;
          const coordinates = feature.geometry.coordinates.slice();
          const properties = feature.properties;

          // Close existing popup
          if (popupRef.current) {
            popupRef.current.remove();
          }

          // Create popup content
          const popupContent = `
            <div class="p-3 max-w-xs">
              <h3 class="font-bold text-lg mb-2">${properties.title}</h3>
              <div class="space-y-1 text-sm">
                <p><span class="font-semibold">Region:</span> ${properties.region}</p>
                <p><span class="font-semibold">Severity:</span> ${properties.severity}</p>
                <p><span class="font-semibold">Escalation Score:</span> ${properties.escalation_score.toFixed(1)}</p>
                ${properties.date ? `<p><span class="font-semibold">Date:</span> ${new Date(properties.date).toLocaleDateString()}</p>` : ''}
                ${properties.description ? `<p class="mt-2 text-gray-600">${properties.description}</p>` : ''}
              </div>
            </div>
          `;

          // Create and show popup
          popupRef.current = new mapboxgl.Popup({ 
            closeButton: true, 
            closeOnClick: true,
            maxWidth: '300px' 
          })
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(map);
        });

        isSourceAddedRef.current = true;
        console.log(`Added conflict events layer with ${geoJsonData.features.length} events`);
      }
    } catch (error) {
      console.error('Error updating map data:', error);
    }
  }, []);

  useEffect(() => {
    if (!map) return;

    let isMounted = true;

    // Function to start polling
    const startPolling = async () => {
      // Initial load
      await updateMapData(map);

      // Set up interval for subsequent updates
      intervalRef.current = setInterval(async () => {
        if (isMounted && map.isStyleLoaded()) {
          await updateMapData(map);
        }
      }, POLL_INTERVAL);
    };

    // Wait for map to be ready
    if (map.isStyleLoaded()) {
      startPolling();
    } else {
      map.once('styledata', () => {
        if (isMounted) {
          startPolling();
        }
      });
    }

    // Cleanup function
    return () => {
      isMounted = false;

      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Remove popup
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      // Remove layer and source if they exist
      try {
        if (map.getLayer(LAYER_ID)) {
          // Note: Layer-specific event listeners are automatically removed when the layer is removed
          map.removeLayer(LAYER_ID);
        }
        if (map.getSource(SOURCE_ID)) {
          map.removeSource(SOURCE_ID);
        }
        isSourceAddedRef.current = false;
      } catch (error) {
        // Map might be disposed, ignore errors during cleanup
        console.log('Cleanup error (safe to ignore):', error);
      }
    };
  }, [map, updateMapData]);
}

// Example usage in a component:
/*
import { useRealTimeConflictEvents } from '@/hooks/useRealTimeConflictEvents';

function MapboxMap() {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  
  // Use the hook
  useRealTimeConflictEvents(map);
  
  useEffect(() => {
    const mapInstance = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [0, 0],
      zoom: 2,
    });
    
    setMap(mapInstance);
    
    return () => {
      mapInstance.remove();
    };
  }, []);
  
  return <div id="map" className="w-full h-full" />;
}
*/