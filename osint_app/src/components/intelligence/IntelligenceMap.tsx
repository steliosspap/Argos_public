'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Event } from '@/types';
import MapErrorFallback from '@/components/MapErrorFallback';
import { getCountryCoordinates } from '@/utils/countryCoordinates';
import { getRelativeTime } from '@/utils/relativeTime';

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

interface ConflictZone {
  id: string;
  name: string;
  center: [number, number];
  radius: number;
  escalationScore: number;
  eventCount: number;
  lastUpdated: Date;
}

interface IntelligenceMapProps {
  events: Event[];
  conflictZones: ConflictZone[];
  selectedZone: ConflictZone | null;
  selectedEvent: Event | null;
  onZoneSelect: (zone: ConflictZone) => void;
  onEventSelect: (event: Event) => void;
  onBoundsChange: (bounds: any) => void;
  loading: boolean;
  armsDeals?: any[];
  layerStates?: Record<string, boolean>;
}

export default function IntelligenceMap({
  events,
  conflictZones,
  selectedZone,
  selectedEvent,
  onZoneSelect,
  onEventSelect,
  onBoundsChange,
  loading,
  armsDeals = [],
  layerStates = { events: true, arms: false, zones: true }
}: IntelligenceMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const zoneSourceRef = useRef<boolean>(false);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPopupHoveredRef = useRef<boolean>(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isUserInteracting = useRef<boolean>(false);
  const lastEventCount = useRef<number>(0);
  const eventSourceRef = useRef<boolean>(false);
  const previousEventPositions = useRef<Map<string, [number, number]>>(new Map());
  const recentlyMovedEvents = useRef<Set<string>>(new Set());

  // Initialize map with dimension checks
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!MAPBOX_ACCESS_TOKEN) {
      console.error('Mapbox access token is required. Please set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your environment variables.');
      setMapError('Map configuration error. Please contact support.');
      return;
    }

    let initializationTimeout: NodeJS.Timeout;
    
    const initializeMap = () => {
      if (!mapContainer.current || map.current) return;
      
      const width = mapContainer.current.offsetWidth;
      const height = mapContainer.current.offsetHeight;
      
      console.log('Container dimensions check:', { width, height });
      
      if (width === 0 || height === 0) {
        console.log('Container has zero dimensions, retrying...');
        initializationTimeout = setTimeout(initializeMap, 100);
        return;
      }

      try {
        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
        console.log('Initializing Mapbox with valid dimensions:', { width, height });

        const mapInstance = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [0, 20],
          zoom: 2,
          projection: 'globe' as any,
          pitchWithRotate: false, // Disable 3D pitch on mobile
          dragRotate: false, // Disable rotation on mobile
          touchZoomRotate: true, // Enable touch zoom
          touchPitch: false // Disable touch pitch
        });

        mapInstance.on('error', (e) => {
          console.error('Map error:', e);
          if (e.error?.status === 401) {
            setMapError('Invalid map credentials. Please check configuration.');
          } else {
            setMapError('Unable to load map. Please try refreshing the page.');
          }
        });

        mapInstance.on('load', () => {
          console.log('Map loaded successfully');
          setMapLoaded(true);
          setMapError(null); // Clear any errors
          
          // Debug: Check what's in the map container
          setTimeout(() => {
            const mapChildren = mapContainer.current?.children;
            if (mapChildren) {
              console.log('Map container children:', mapChildren.length);
              Array.from(mapChildren).forEach((child, i) => {
                console.log(`Child ${i}:`, child.className, child.tagName);
              });
            }
          }, 1000);
          
          // Add atmosphere (skip on mobile for performance)
          if (window.innerWidth >= 768) {
            mapInstance.setFog({
              color: 'rgb(20, 20, 30)',
              'high-color': 'rgb(36, 92, 223)',
              'horizon-blend': 0.02,
              'space-color': 'rgb(0, 0, 0)',
              'star-intensity': 0.6
            });
          }
          
          // Add navigation controls
          mapInstance.addControl(new mapboxgl.NavigationControl({
            showCompass: true,
            showZoom: true,
            visualizePitch: false
          }), 'bottom-right');

          // Initialize sources
          mapInstance.addSource('conflict-zones', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          });

          // Add conflict zone layer - subtle visual indicator
          mapInstance.addLayer({
            id: 'conflict-zones-fill',
            type: 'fill',
            source: 'conflict-zones',
            paint: {
              'fill-color': [
                'case',
                ['>=', ['get', 'escalationScore'], 7],
                'rgba(239, 68, 68, 0.08)', // Red - even more subtle
                ['>=', ['get', 'escalationScore'], 4],
                'rgba(245, 158, 11, 0.08)', // Orange - even more subtle
                'rgba(59, 130, 246, 0.08)' // Blue - even more subtle
              ],
              'fill-opacity': 0.3
            }
          });

          // Add conflict zone border - dotted/dashed for subtlety
          mapInstance.addLayer({
            id: 'conflict-zones-border',
            type: 'line',
            source: 'conflict-zones',
            paint: {
              'line-color': [
                'case',
                ['>=', ['get', 'escalationScore'], 7],
                '#ef4444', // Red
                ['>=', ['get', 'escalationScore'], 4],
                '#f59e0b', // Orange
                '#3b82f6' // Blue
              ],
              'line-width': 1.5,
              'line-opacity': 0.4,
              'line-dasharray': [2, 4] // Dashed line
            }
          });

          // Add click handler for zones
          mapInstance.on('click', 'conflict-zones-fill', (e) => {
            if (e.features && e.features.length > 0) {
              const feature = e.features[0];
              const zone = conflictZones.find(z => z.id === feature.properties?.id);
              if (zone) {
                onZoneSelect(zone);
              }
            }
          });

          // Add hover effects
          mapInstance.on('mouseenter', 'conflict-zones-fill', () => {
            mapInstance.getCanvas().style.cursor = 'pointer';
          });

          mapInstance.on('mouseleave', 'conflict-zones-fill', () => {
            mapInstance.getCanvas().style.cursor = '';
          });

          zoneSourceRef.current = true;

          // Add events source for clustering
          mapInstance.addSource('events', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            },
            cluster: true,
            clusterMaxZoom: 12, // Start unclustering earlier
            clusterRadius: window.innerWidth < 768 ? 80 : 60, // Larger radius on mobile for better touch targets
            clusterProperties: {
              // Calculate average escalation score for clusters
              avgEscalation: ['+', ['get', 'escalation_score']],
              maxEscalation: ['max', ['get', 'escalation_score']]
            }
          });

          // Add clustered circles layer
          mapInstance.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'events',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': [
                'case',
                ['>=', ['/', ['get', 'avgEscalation'], ['get', 'point_count']], 7],
                '#ef4444', // red for high average escalation
                ['>=', ['/', ['get', 'avgEscalation'], ['get', 'point_count']], 4],
                '#f59e0b', // orange for medium
                '#fbbf24'  // yellow for low
              ],
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                15, // 15px for small clusters (< 10 events)
                10,
                20, // 20px for medium clusters (10-50 events) 
                50,
                25  // 25px for large clusters (50+ events)
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
              'circle-stroke-opacity': 0.8
            }
          });

          // Add cluster count labels
          mapInstance.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'events',
            filter: ['has', 'point_count'],
            layout: {
              'text-field': '{point_count_abbreviated}',
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': 14
            },
            paint: {
              'text-color': '#ffffff'
            }
          });

          // Add individual event circles
          mapInstance.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'events',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': [
                'case',
                // If it's a round 2 deep search result, use purple tint
                ['==', ['get', 'discovery_round'], 2],
                [
                  'case',
                  ['>=', ['get', 'escalation_score'], 7],
                  '#DC2626', // darker red with purple tint
                  ['>=', ['get', 'escalation_score'], 4],
                  '#C026D3', // purple-orange for moderate
                  '#A855F7'  // purple for low
                ],
                // Otherwise use normal colors
                ['>=', ['get', 'escalation_score'], 7],
                '#ef4444', // red for high risk
                ['>=', ['get', 'escalation_score'], 4],
                '#f59e0b', // orange for moderate
                '#fbbf24'  // yellow for low
              ],
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'escalation_score'],
                1, 8,   // min size for low escalation
                10, 16  // max size for high escalation
              ],
              'circle-stroke-width': [
                'case',
                // Thicker stroke for high reliability sources
                ['>=', ['get', 'source_reliability'], 0.8],
                3,
                ['get', 'recently_moved'],
                3, // Thicker stroke for recently moved
                2
              ],
              'circle-stroke-color': [
                'case',
                // Green stroke for high reliability
                ['>=', ['get', 'source_reliability'], 0.8],
                '#10b981',
                '#fff'
              ],
              'circle-stroke-opacity': [
                'case',
                ['get', 'recently_moved'],
                1, // Full opacity for recently moved
                0.9
              ],
              'circle-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                5, 0.6,   // More transparent when zoomed out
                10, 0.8,  // More opaque when zoomed in
                15, 0.9
              ]
            }
          });

          // Add hover tooltip for clusters
          const createClusterPopup = (feature: any) => {
            const geometry = feature.geometry as GeoJSON.Point;
            const coordinates = geometry.coordinates.slice() as [number, number];
            const count = feature.properties?.point_count;
            const avgEscalation = feature.properties?.avgEscalation / count || 5;
            
            // Remove any existing popup
            if (hoverPopupRef.current) {
              hoverPopupRef.current.remove();
            }
            
            // Create hover popup
            const popup = new mapboxgl.Popup({
              closeButton: false,
              closeOnClick: false,
              offset: 25,
              className: 'cluster-hover-popup'
            });
            
            const popupContent = document.createElement('div');
            popupContent.className = 'p-3';
            popupContent.innerHTML = `
              <div class="font-semibold text-white">${count} Events</div>
              <div class="text-xs text-gray-400 mb-2">Click to zoom</div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500">Avg. Escalation</span>
                <span class="text-sm font-medium ${
                  avgEscalation >= 7 ? 'text-red-400' :
                  avgEscalation >= 4 ? 'text-orange-400' :
                  'text-yellow-400'
                }">${Math.round(avgEscalation)}/10</span>
              </div>
            `;
            
            // Add hover tracking for clusters too
            popupContent.addEventListener('mouseenter', () => {
              isPopupHoveredRef.current = true;
              if (popupTimeoutRef.current) {
                clearTimeout(popupTimeoutRef.current);
                popupTimeoutRef.current = null;
              }
            });
            
            popupContent.addEventListener('mouseleave', () => {
              isPopupHoveredRef.current = false;
              popupTimeoutRef.current = setTimeout(() => {
                if (!isPopupHoveredRef.current && hoverPopupRef.current) {
                  hoverPopupRef.current.remove();
                  hoverPopupRef.current = null;
                }
              }, 200);
            });
            
            popup.setLngLat(coordinates)
              .setDOMContent(popupContent)
              .addTo(mapInstance);
            
            hoverPopupRef.current = popup;
          };
          
          mapInstance.on('mouseenter', 'clusters', (e) => {
            if (!e.features || e.features.length === 0) return;
            
            // Clear any pending popup removal
            if (popupTimeoutRef.current) {
              clearTimeout(popupTimeoutRef.current);
              popupTimeoutRef.current = null;
            }
            
            createClusterPopup(e.features[0]);
          });
          
          mapInstance.on('mouseleave', 'clusters', () => {
            // Add delay before removing
            popupTimeoutRef.current = setTimeout(() => {
              if (!isPopupHoveredRef.current && hoverPopupRef.current) {
                hoverPopupRef.current.remove();
                hoverPopupRef.current = null;
              }
            }, 200);
          });

          // Add hover tooltip for individual events  
          const createEventPopup = (feature: any) => {
            const geometry = feature.geometry as GeoJSON.Point;
            const coordinates = geometry.coordinates.slice() as [number, number];
            const props = feature.properties;
            const eventId = props?.id;
            
            // Find the full event data
            const event = events.find(ev => ev.id === eventId);
            
            // Remove any existing popup
            if (hoverPopupRef.current) {
              hoverPopupRef.current.remove();
            }
            
            // Create hover popup with clickable content
            const popup = new mapboxgl.Popup({
              closeButton: false,
              closeOnClick: false,
              offset: 15,
              className: 'event-hover-popup'
            });
            
            const popupContent = document.createElement('div');
            popupContent.className = 'p-3 max-w-xs';
            
            // Get enhanced event data from properties first, then tags
            let sourceReliability = props?.source_reliability;
            let discoveryRound = props?.discovery_round;
            
            // If not in properties, check event tags
            if (!sourceReliability && event?.tags) {
              const reliabilityTag = event.tags.find(t => t?.startsWith('reliability:'));
              sourceReliability = reliabilityTag ? parseInt(reliabilityTag.split(':')[1]) / 100 : undefined;
            }
            
            if (!discoveryRound && event?.tags) {
              const discoveryTag = event.tags.find(t => t?.startsWith('discovery:'));
              discoveryRound = discoveryTag ? parseInt(discoveryTag.split('round')[1]) : undefined;
            }
            
            popupContent.innerHTML = `
              <div class="font-semibold text-white line-clamp-2 mb-1">${props?.title || 'Unknown Event'}</div>
              <div class="text-xs text-gray-400 mb-2">
                ${props?.country || 'Unknown Location'} • ${event?.timestamp ? getRelativeTime(event.timestamp) : 'Unknown time'}
              </div>
              
              <!-- Enhanced metadata -->
              ${(discoveryRound || sourceReliability) ? `
                <div class="flex items-center gap-2 mb-2">
                  ${discoveryRound ? `
                    <span class="text-xs px-1.5 py-0.5 rounded-full ${
                      discoveryRound === 1 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-purple-500/20 text-purple-400'
                    }">
                      ${discoveryRound === 1 ? 'Discovery' : 'Deep Search'}
                    </span>
                  ` : ''}
                  ${sourceReliability ? `
                    <span class="text-xs px-1.5 py-0.5 rounded-full ${
                      sourceReliability >= 0.8 
                        ? 'bg-green-500/20 text-green-400' 
                        : sourceReliability >= 0.6
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }">
                      ${(sourceReliability * 100).toFixed(0)}% reliable
                    </span>
                  ` : ''}
                </div>
              ` : ''}
              
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-gray-500">Escalation Score</span>
                <span class="text-sm font-medium ${
                  props?.escalation_score >= 7 ? 'text-red-400' :
                  props?.escalation_score >= 4 ? 'text-orange-400' :
                  'text-yellow-400'
                }">${Math.round(props?.escalation_score || 5)}/10</span>
              </div>
              ${event?.source_url ? `
                <a href="${event.source_url}" 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   class="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer">
                  View source →
                </a>
              ` : '<div class="text-xs text-gray-500">Click marker for details</div>'}
            `;
            
            // Add event listeners to track popup hover state
            popupContent.addEventListener('mouseenter', () => {
              isPopupHoveredRef.current = true;
              if (popupTimeoutRef.current) {
                clearTimeout(popupTimeoutRef.current);
                popupTimeoutRef.current = null;
              }
            });
            
            popupContent.addEventListener('mouseleave', () => {
              isPopupHoveredRef.current = false;
              // Remove popup after delay if not hovering over marker
              popupTimeoutRef.current = setTimeout(() => {
                if (!isPopupHoveredRef.current && hoverPopupRef.current) {
                  hoverPopupRef.current.remove();
                  hoverPopupRef.current = null;
                }
              }, 200);
            });
            
            popup.setLngLat(coordinates)
              .setDOMContent(popupContent)
              .addTo(mapInstance);
            
            hoverPopupRef.current = popup;
          };
          
          mapInstance.on('mouseenter', 'unclustered-point', (e) => {
            if (!e.features || e.features.length === 0) return;
            
            // Clear any pending popup removal
            if (popupTimeoutRef.current) {
              clearTimeout(popupTimeoutRef.current);
              popupTimeoutRef.current = null;
            }
            
            createEventPopup(e.features[0]);
          });
          
          mapInstance.on('mouseleave', 'unclustered-point', () => {
            // Add a delay before removing popup to allow mouse to reach it
            popupTimeoutRef.current = setTimeout(() => {
              // Check if popup is being hovered
              if (!isPopupHoveredRef.current && hoverPopupRef.current) {
                hoverPopupRef.current.remove();
                hoverPopupRef.current = null;
              }
            }, 200); // 200ms delay
          });

          // Click handlers
          mapInstance.on('click', 'clusters', (e) => {
            const features = mapInstance.queryRenderedFeatures(e.point, {
              layers: ['clusters']
            });
            const clusterId = features[0].properties.cluster_id;
            const source = mapInstance.getSource('events') as mapboxgl.GeoJSONSource;
            source.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err) return;
              mapInstance.easeTo({
                center: features[0].geometry.coordinates,
                zoom: zoom + 0.5, // Zoom a bit more to better separate clusters
                duration: 1000
              });
            });
          });

          mapInstance.on('click', 'unclustered-point', (e) => {
            if (e.features && e.features.length > 0) {
              const feature = e.features[0];
              const event = events.find(ev => ev.id === feature.properties?.id);
              if (event) {
                onEventSelect(event);
              }
            }
          });

          // Change cursor on hover
          mapInstance.on('mouseenter', 'clusters', () => {
            mapInstance.getCanvas().style.cursor = 'pointer';
          });
          mapInstance.on('mouseleave', 'clusters', () => {
            mapInstance.getCanvas().style.cursor = '';
          });
          mapInstance.on('mouseenter', 'unclustered-point', () => {
            mapInstance.getCanvas().style.cursor = 'pointer';
          });
          mapInstance.on('mouseleave', 'unclustered-point', () => {
            mapInstance.getCanvas().style.cursor = '';
          });

          eventSourceRef.current = true;

          // Add arms deals source and layer
          mapInstance.addSource('arms-deals', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          });

          // Add arms deals lines source
          mapInstance.addSource('arms-deals-lines', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          });

          // Add arms deals flow lines layer
          mapInstance.addLayer({
            id: 'arms-deals-lines',
            type: 'line',
            source: 'arms-deals-lines',
            layout: {
              'visibility': 'none' // Hidden by default
            },
            paint: {
              'line-color': [
                'case',
                ['>=', ['get', 'dealValue'], 1000], '#dc2626', // Red for billion+ deals
                ['>=', ['get', 'dealValue'], 500], '#f59e0b',  // Orange for 500M+
                ['>=', ['get', 'dealValue'], 100], '#10b981',  // Green for 100M+
                '#60a5fa' // Blue for smaller deals
              ],
              'line-width': [
                'interpolate',
                ['linear'],
                ['get', 'dealValue'],
                0, 1,
                100, 2,
                500, 3,
                1000, 4
              ],
              'line-opacity': 0.6,
              'line-dasharray': [2, 2]
            }
          });

          // Add arms deals layer with custom icon
          mapInstance.addLayer({
            id: 'arms-deals',
            type: 'circle',
            source: 'arms-deals',
            layout: {
              'visibility': 'none' // Hidden by default
            },
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                2, 6,   // Small at zoom 2
                8, 12,  // Medium at zoom 8
                12, 16  // Larger at zoom 12
              ],
              'circle-color': [
                'case',
                ['>=', ['get', 'dealValue'], 1000], '#dc2626', // Red for billion+ deals
                ['>=', ['get', 'dealValue'], 500], '#f59e0b',  // Orange for 500M+
                ['>=', ['get', 'dealValue'], 100], '#10b981',  // Green for 100M+
                '#60a5fa' // Blue for smaller deals
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.8,
              'circle-stroke-opacity': 0.9
            }
          });


          // Add arms deals labels layer
          mapInstance.addLayer({
            id: 'arms-deals-labels',
            type: 'symbol',
            source: 'arms-deals',
            layout: {
              'text-field': ['concat', '$', ['get', 'dealValue'], 'M'],
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                2, 0,   // Hidden at low zoom
                6, 10,  // Start showing at zoom 6
                12, 12  // Full size at zoom 12
              ],
              'text-offset': [0, 2.2],
              'text-anchor': 'top',
              'text-allow-overlap': false,
              'visibility': 'none' // Hidden by default
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': '#000000',
              'text-halo-width': 2
            }
          });

          // Add hover tooltip for arms deals
          mapInstance.on('mouseenter', 'arms-deals', (e) => {
            if (!e.features || e.features.length === 0) return;
            
            const feature = e.features[0];
            const props = feature.properties;
            
            // Remove any existing popup
            if (hoverPopupRef.current) {
              hoverPopupRef.current.remove();
            }
            
            // Create hover popup
            hoverPopupRef.current = new mapboxgl.Popup({
              closeButton: false,
              closeOnClick: false,
              offset: 15,
              className: 'arms-deal-hover-popup'
            })
              .setLngLat(feature.geometry.coordinates)
              .setHTML(`
                <div class="p-3 max-w-xs">
                  <div class="font-semibold text-white mb-1">${props?.route || 'Arms Deal'}</div>
                  <div class="text-xs text-gray-400 mb-2">${props?.weaponSystem || 'Unknown System'}</div>
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs text-gray-500">Deal Value</span>
                    <span class="text-sm font-medium text-green-400">$${props?.dealValue || 0}M</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-gray-500">Status</span>
                    <span class="text-xs font-medium text-blue-400">${props?.status || 'Unknown'}</span>
                  </div>
                  <div class="text-xs text-gray-500 mt-2">Click for details</div>
                </div>
              `)
              .addTo(mapInstance);
              
            mapInstance.getCanvas().style.cursor = 'pointer';
          });
          
          mapInstance.on('mouseleave', 'arms-deals', () => {
            if (hoverPopupRef.current) {
              hoverPopupRef.current.remove();
              hoverPopupRef.current = null;
            }
            mapInstance.getCanvas().style.cursor = '';
          });

          // Add click handler for arms deals
          mapInstance.on('click', 'arms-deals', (e) => {
            if (e.features && e.features.length > 0) {
              const feature = e.features[0];
              const props = feature.properties;
              
              // Create a modal or detailed popup
              console.log('Arms deal clicked:', props);
              // TODO: Implement modal display for arms deal details
            }
          });
        });

        // Track user interactions
        mapInstance.on('mousedown', () => {
          isUserInteracting.current = true;
        });

        mapInstance.on('touchstart', () => {
          isUserInteracting.current = true;
        });

        mapInstance.on('moveend', () => {
          isUserInteracting.current = false;
        });

        mapInstance.on('error', (e) => {
          console.error('Map error:', e);
        });

        // Store the map instance
        map.current = mapInstance;
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    // Start initialization
    initializeMap();

    // Cleanup
    return () => {
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
      }
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
      if (hoverPopupRef.current) {
        hoverPopupRef.current.remove();
        hoverPopupRef.current = null;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Remove dependencies to prevent map re-initialization

  // Update event click handler  
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing handlers
    map.current.off('click', 'unclustered-point');
    
    // Add new handler with current events
    map.current.on('click', 'unclustered-point', (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const event = events.find(ev => ev.id === feature.properties?.id);
        if (event) {
          onEventSelect(event);
        }
      }
    });
  }, [events, onEventSelect, mapLoaded]);

  // Update bounds change handler
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleMoveEnd = () => {
      const bounds = map.current?.getBounds();
      if (bounds) {
        onBoundsChange({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        });
      }
    };

    map.current.on('moveend', handleMoveEnd);

    return () => {
      map.current?.off('moveend', handleMoveEnd);
    };
  }, [onBoundsChange, mapLoaded]);

  // Handle container resizing
  useEffect(() => {
    if (!mapContainer.current) return;

    resizeObserverRef.current = new ResizeObserver((entries) => {
      if (map.current && entries[0]) {
        const { width, height } = entries[0].contentRect;
        console.log('Container resized:', { width, height });
        
        // Trigger map resize
        setTimeout(() => {
          map.current?.resize();
        }, 100);
      }
    });

    resizeObserverRef.current.observe(mapContainer.current);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  // Memoize GeoJSON features to prevent unnecessary updates
  const conflictZoneFeatures = useMemo(() => {
    return conflictZones.map(zone => {
      // Create circle polygon
      const points = 64;
      const km = zone.radius;
      const ret = [];
      const distanceX = km / (111.320 * Math.cos(zone.center[1] * Math.PI / 180));
      const distanceY = km / 110.574;

      for (let i = 0; i < points; i++) {
        const theta = (i / points) * (2 * Math.PI);
        const x = distanceX * Math.cos(theta);
        const y = distanceY * Math.sin(theta);
        ret.push([zone.center[0] + x, zone.center[1] + y]);
      }
      ret.push(ret[0]);

      return {
        type: 'Feature' as const,
        properties: {
          id: zone.id,
          name: zone.name,
          escalationScore: zone.escalationScore,
          eventCount: zone.eventCount
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [ret]
        }
      };
    });
  }, [conflictZones]);

  // Update conflict zones
  useEffect(() => {
    if (!map.current || !mapLoaded || !zoneSourceRef.current) return;

    const source = map.current.getSource('conflict-zones') as mapboxgl.GeoJSONSource;
    if (!source) return;

    source.setData({
      type: 'FeatureCollection',
      features: conflictZoneFeatures
    });
  }, [conflictZoneFeatures, mapLoaded]);

  // Create GeoJSON features from events
  const eventFeatures = useMemo(() => {
    return events
      .filter(event => event.location?.coordinates && event.location.coordinates.length === 2)
      .map(event => ({
        type: 'Feature' as const,
        properties: {
          id: event.id,
          title: event.title,
          country: event.country,
          escalation_score: (event as any).escalation_score || event.reliability || 5,
          timestamp: event.timestamp,
          recently_moved: recentlyMovedEvents.current.has(event.id),
          source_reliability: (() => {
            const tag = event.tags?.find(t => t?.startsWith('reliability:'));
            return tag ? parseInt(tag.split(':')[1]) / 100 : undefined;
          })(),
          discovery_round: (() => {
            const tag = event.tags?.find(t => t?.startsWith('discovery:'));
            return tag ? parseInt(tag.split('round')[1]) : undefined;
          })()
        },
        geometry: {
          type: 'Point' as const,
          coordinates: event.location!.coordinates
        }
      }));
  }, [events]);

  // Update event data on map
  useEffect(() => {
    if (!map.current || !mapLoaded || !eventSourceRef.current) return;

    const source = map.current.getSource('events') as mapboxgl.GeoJSONSource;
    if (!source) return;

    // Show update indicator for new events
    if (eventFeatures.length > lastEventCount.current && lastEventCount.current > 0) {
      setIsUpdating(true);
      setTimeout(() => setIsUpdating(false), 1000);
    }
    lastEventCount.current = eventFeatures.length;

    // Track position changes
    const currentPositions = new Map<string, [number, number]>();
    let positionChanges = 0;
    
    eventFeatures.forEach(feature => {
      const id = feature.properties.id;
      const coords = feature.geometry.coordinates as [number, number];
      currentPositions.set(id, coords);
      
      // Check if position changed
      const prevCoords = previousEventPositions.current.get(id);
      if (prevCoords && (prevCoords[0] !== coords[0] || prevCoords[1] !== coords[1])) {
        positionChanges++;
        recentlyMovedEvents.current.add(id);
        // Clear the highlight after 5 seconds
        setTimeout(() => {
          recentlyMovedEvents.current.delete(id);
          // Trigger re-render by updating data
          const source = map.current?.getSource('events') as mapboxgl.GeoJSONSource;
          if (source) {
            source.setData({
              type: 'FeatureCollection',
              features: eventFeatures
            });
          }
        }, 5000);
      }
    });
    
    // Update stored positions
    previousEventPositions.current = currentPositions;
    
    source.setData({
      type: 'FeatureCollection',
      features: eventFeatures
    });

    console.log(`Updated map with ${eventFeatures.length} events${positionChanges > 0 ? ` (${positionChanges} position changes)` : ''}`);
    
    // Clean up any lingering hover popups
    if (hoverPopupRef.current) {
      hoverPopupRef.current.remove();
      hoverPopupRef.current = null;
    }
  }, [eventFeatures, mapLoaded]);

  // Update arms deals data on map
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const pointSource = map.current.getSource('arms-deals') as mapboxgl.GeoJSONSource;
    const lineSource = map.current.getSource('arms-deals-lines') as mapboxgl.GeoJSONSource;
    if (!pointSource || !lineSource) return;

    // Transform arms deals to GeoJSON features
    const validDeals = armsDeals.filter(deal => {
      const buyerCoords = getCountryCoordinates(deal.buyerCountry);
      const sellerCoords = getCountryCoordinates(deal.sellerCountry);
      return buyerCoords && sellerCoords;
    });

    // Create point features for markers
    const pointFeatures = validDeals.map(deal => {
      const buyerCoords = getCountryCoordinates(deal.buyerCountry)!;
      const sellerCoords = getCountryCoordinates(deal.sellerCountry)!;
      
      // Check if this is a US-Asia transaction
      const isUSToAsia = (
        (deal.sellerCountry === 'USA' || deal.sellerCountry === 'United States' || 
         deal.sellerCountry === 'US' || deal.sellerCountry === 'U.S.' || deal.sellerCountry === 'U.S.A.') &&
        buyerCoords[0] > 60
      ) || (
        (deal.buyerCountry === 'USA' || deal.buyerCountry === 'United States' || 
         deal.buyerCountry === 'US' || deal.buyerCountry === 'U.S.' || deal.buyerCountry === 'U.S.A.') &&
        sellerCoords[0] > 60
      );
      
      let midpoint: [number, number];
      
      if (isUSToAsia) {
        // For Pacific routes, place marker in the middle of the Pacific
        midpoint = [-175, (buyerCoords[1] + sellerCoords[1]) / 2];
      } else {
        // Regular midpoint calculation
        midpoint = [
          (buyerCoords[0] + sellerCoords[0]) / 2,
          (buyerCoords[1] + sellerCoords[1]) / 2
        ];
      }
      
      return {
        type: 'Feature' as const,
        properties: {
          id: deal.id,
          route: `${deal.sellerCountry} → ${deal.buyerCountry}`,
          dealValue: Math.round(deal.dealValue / 1000000), // Convert to millions
          weaponSystem: deal.weaponSystem,
          status: deal.status,
          sellerCountry: deal.sellerCountry,
          buyerCountry: deal.buyerCountry,
          date: deal.date
        },
        geometry: {
          type: 'Point' as const,
          coordinates: midpoint
        }
      };
    });

    // Create line features for routes
    const lineFeatures = validDeals.map(deal => {
      const buyerCoords = getCountryCoordinates(deal.buyerCountry)!;
      const sellerCoords = getCountryCoordinates(deal.sellerCountry)!;
      
      // Check if this is a US-Asia transaction that should go westward
      const isUSToAsia = (
        (deal.sellerCountry === 'USA' || deal.sellerCountry === 'United States' || 
         deal.sellerCountry === 'US' || deal.sellerCountry === 'U.S.' || deal.sellerCountry === 'U.S.A.') &&
        buyerCoords[0] > 60 // Asian countries are generally east of 60°E
      ) || (
        (deal.buyerCountry === 'USA' || deal.buyerCountry === 'United States' || 
         deal.buyerCountry === 'US' || deal.buyerCountry === 'U.S.' || deal.buyerCountry === 'U.S.A.') &&
        sellerCoords[0] > 60 // Asian countries are generally east of 60°E
      );
      
      let routeCoordinates: [number, number][];
      
      if (isUSToAsia) {
        // Create westward route across Pacific
        const usCoords = sellerCoords[0] < -50 ? sellerCoords : buyerCoords;
        const asiaCoords = sellerCoords[0] > 60 ? sellerCoords : buyerCoords;
        
        // Add waypoints to force westward routing
        // First waypoint: west from US
        const waypoint1: [number, number] = [-160, usCoords[1]];
        // Second waypoint: cross dateline
        const waypoint2: [number, number] = [170, (usCoords[1] + asiaCoords[1]) / 2];
        
        // Order based on who is seller/buyer
        if (sellerCoords[0] < -50) {
          // US is seller
          routeCoordinates = [usCoords, waypoint1, waypoint2, asiaCoords];
        } else {
          // US is buyer
          routeCoordinates = [asiaCoords, waypoint2, waypoint1, usCoords];
        }
      } else {
        // Regular route for non US-Asia transactions
        routeCoordinates = [sellerCoords, buyerCoords];
      }
      
      return {
        type: 'Feature' as const,
        properties: {
          dealValue: Math.round(deal.dealValue / 1000000),
          route: `${deal.sellerCountry} → ${deal.buyerCountry}`
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: routeCoordinates
        }
      };
    });

    pointSource.setData({
      type: 'FeatureCollection',
      features: pointFeatures
    });

    lineSource.setData({
      type: 'FeatureCollection',
      features: lineFeatures
    });

    console.log(`Updated arms deals layer with ${pointFeatures.length} deals`);
  }, [armsDeals, mapLoaded]);


  // Handle selected zone
  useEffect(() => {
    if (!selectedZone || !map.current || !mapLoaded) return;

    // Only fly to zone if user is not currently interacting with the map
    if (!isUserInteracting.current) {
      map.current.flyTo({
        center: selectedZone.center,
        zoom: 6,
        duration: 1500
      });
    }
  }, [selectedZone, mapLoaded]);

  // Handle selected event
  useEffect(() => {
    if (!selectedEvent || !map.current || !mapLoaded) return;

    // Only fly to event if user is not currently interacting with the map
    if (!isUserInteracting.current && selectedEvent.location?.coordinates) {
      const [lng, lat] = selectedEvent.location.coordinates;
      map.current.flyTo({
        center: [lng, lat],
        zoom: 8,
        duration: 1000
      });
    }
  }, [selectedEvent, mapLoaded]);

  // Handle layer visibility changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Update visibility for each layer
    Object.entries(layerStates).forEach(([layerId, isVisible]) => {
      const visibility = isVisible ? 'visible' : 'none';
      
      switch (layerId) {
        case 'events':
          if (map.current!.getLayer('unclustered-point')) {
            map.current!.setLayoutProperty('unclustered-point', 'visibility', visibility);
          }
          if (map.current!.getLayer('clusters')) {
            map.current!.setLayoutProperty('clusters', 'visibility', visibility);
          }
          if (map.current!.getLayer('cluster-count')) {
            map.current!.setLayoutProperty('cluster-count', 'visibility', visibility);
          }
          break;
          
        case 'arms':
          if (map.current!.getLayer('arms-deals-lines')) {
            map.current!.setLayoutProperty('arms-deals-lines', 'visibility', visibility);
          }
          if (map.current!.getLayer('arms-deals')) {
            map.current!.setLayoutProperty('arms-deals', 'visibility', visibility);
          }
          if (map.current!.getLayer('arms-deals-labels')) {
            map.current!.setLayoutProperty('arms-deals-labels', 'visibility', visibility);
          }
          break;
          
        case 'zones':
          if (map.current!.getLayer('conflict-zones-fill')) {
            map.current!.setLayoutProperty('conflict-zones-fill', 'visibility', visibility);
          }
          if (map.current!.getLayer('conflict-zones-border')) {
            map.current!.setLayoutProperty('conflict-zones-border', 'visibility', visibility);
          }
          break;
          
      }
    });
  }, [layerStates, mapLoaded]);

  // Remove the unnecessary interval - data updates are handled by the hook

  // Show error fallback if map failed to load
  if (mapError) {
    return <MapErrorFallback error={mapError} className="w-full h-full" />;
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
      
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10">
          <div className="bg-gray-800 rounded-lg p-4 flex items-center space-x-3">
            <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-white text-sm">Updating intelligence...</span>
          </div>
        </div>
      )}

      {/* Real-time update indicator */}
      <div className={`absolute top-4 left-4 transition-opacity duration-500 ${isUpdating ? 'opacity-100' : 'opacity-0'} z-20`}>
        <div className="bg-blue-500/20 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-blue-400 text-xs font-medium">Updating...</span>
        </div>
      </div>
      

      {/* Legend - responsive positioning */}
      <div className="absolute bottom-32 right-4 bg-gray-800/90 backdrop-blur-sm rounded-lg p-2 md:p-3 text-white text-xs z-10 pointer-events-none hidden md:block">
        <h4 className="font-semibold mb-2">Escalation Levels</h4>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Low (0-3)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span>Medium (4-6)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>High (7-10)</span>
          </div>
        </div>
      </div>

      {/* Live status indicator with event count */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-green-400 text-xs font-medium">LIVE</span>
          {events.length > 0 && (
            <span className="text-gray-400 text-xs">({events.length} visible)</span>
          )}
        </div>
        {/* Date range filter */}
        <select 
          className="bg-gray-800 text-white text-xs px-3 py-2 rounded border border-gray-700 cursor-pointer"
          defaultValue="24h"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>

        {/* Severity filter */}
        <select 
          className="bg-gray-800 text-white text-xs px-3 py-2 rounded border border-gray-700 cursor-pointer"
          defaultValue="all"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical Only</option>
          <option value="high">High & Above</option>
          <option value="medium">Medium & Above</option>
        </select>

        {/* Layer visibility is controlled by MapLayerControls */}
      </div>
    </div>
  );
}