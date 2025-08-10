import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

interface ConflictEventsProps {
  map: mapboxgl.Map | null;
}

export function RealTimeConflictUpdater({ map }: ConflictEventsProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sourceAddedRef = useRef(false);

  useEffect(() => {
    if (!map) return;

    const SOURCE_ID = 'conflict-events';
    const LAYER_ID = 'conflict-events-layer';

    // Fetch conflict events from the API
    const fetchConflictEvents = async () => {
      try {
        const response = await fetch('/api/events/geojson');
        if (!response.ok) throw new Error('Failed to fetch events');
        
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching conflict events:', error);
        return null;
      }
    };

    // Update map with new data
    const updateConflictEvents = async () => {
      if (!map.isStyleLoaded()) return;

      const geoJsonData = await fetchConflictEvents();
      if (!geoJsonData) return;

      const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
      
      if (source) {
        // Update existing source
        source.setData(geoJsonData);
      } else if (!sourceAddedRef.current) {
        // Add source and layer for first time
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geoJsonData
        });

        map.addLayer({
          id: LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            // Dynamic circle radius based on escalation_score
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'escalation_score'],
              0, 8,    // escalation_score 0 = radius 8
              10, 20   // escalation_score 10 = radius 20
            ],
            // Dynamic color based on escalation_score
            'circle-color': [
              'case',
              ['>', ['get', 'escalation_score'], 8], '#8B0000',  // Dark red
              ['>=', ['get', 'escalation_score'], 5], '#FF8C00', // Orange
              '#FFD700' // Yellow (default for < 5)
            ],
            'circle-opacity': 0.8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF'
          }
        });

        // Add popup on click
        map.on('click', LAYER_ID, (e) => {
          if (!e.features?.[0]) return;
          
          const feature = e.features[0];
          const coordinates = (feature.geometry as any).coordinates.slice();
          const { title, region, escalation_score, severity } = feature.properties as any;

          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
              <div style="padding: 10px;">
                <h3 style="margin: 0 0 5px 0; font-weight: bold;">${title}</h3>
                <p style="margin: 0; font-size: 14px;">Region: ${region}</p>
                <p style="margin: 0; font-size: 14px;">Severity: ${severity}</p>
                <p style="margin: 0; font-size: 14px;">Score: ${escalation_score}</p>
              </div>
            `)
            .addTo(map);
        });

        // Change cursor on hover
        map.on('mouseenter', LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });

        sourceAddedRef.current = true;
      }
    };

    // Initialize when map is ready
    const initialize = async () => {
      if (map.isStyleLoaded()) {
        await updateConflictEvents();
      } else {
        map.once('styledata', updateConflictEvents);
      }

      // Set up polling every 30 seconds
      intervalRef.current = setInterval(updateConflictEvents, 30000);
    };

    initialize();

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Note: Layer-specific event listeners are automatically removed when the layer is removed
      // No need to explicitly remove them
    };
  }, [map]);

  return null;
}

// Direct useEffect implementation for MapboxMap component:
export const conflictEventsEffect = (map: mapboxgl.Map | null) => {
  if (!map) return;

  let interval: NodeJS.Timeout;
  let sourceAdded = false;

  const updateEvents = async () => {
    if (!map.isStyleLoaded()) return;

    try {
      const response = await fetch('/api/events');
      const geoJsonData = await response.json();

      const source = map.getSource('conflict-events') as mapboxgl.GeoJSONSource;
      
      if (source) {
        source.setData(geoJsonData);
      } else if (!sourceAdded) {
        // Add source
        map.addSource('conflict-events', {
          type: 'geojson',
          data: geoJsonData
        });

        // Add layer with styling
        map.addLayer({
          id: 'conflict-events-layer',
          type: 'circle',
          source: 'conflict-events',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['get', 'escalation_score'],
              0, 8, 10, 20
            ],
            'circle-color': [
              'case',
              ['>', ['get', 'escalation_score'], 8], '#8B0000',
              ['>=', ['get', 'escalation_score'], 5], '#FF8C00',
              '#FFD700'
            ],
            'circle-opacity': 0.8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF'
          }
        });

        // Add click popup
        map.on('click', 'conflict-events-layer', (e) => {
          const feature = e.features?.[0];
          if (!feature) return;

          const coords = (feature.geometry as any).coordinates;
          const props = feature.properties as any;

          new mapboxgl.Popup()
            .setLngLat(coords)
            .setHTML(`
              <div>
                <h3><strong>${props.title}</strong></h3>
                <p>Region: ${props.region}</p>
              </div>
            `)
            .addTo(map);
        });

        sourceAdded = true;
      }
    } catch (error) {
      console.error('Failed to update conflict events:', error);
    }
  };

  // Start updates
  if (map.isStyleLoaded()) {
    updateEvents();
  } else {
    map.once('styledata', updateEvents);
  }

  // Poll every 30 seconds
  interval = setInterval(updateEvents, 30000);

  // Return cleanup function
  return () => {
    clearInterval(interval);
  };
};