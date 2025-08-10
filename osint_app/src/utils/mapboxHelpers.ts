/**
 * Helper functions for Mapbox to handle development mode issues
 */

/**
 * Safely add a source to the map if it doesn't already exist
 */
export function safeAddSource(map: mapboxgl.Map, id: string, source: any) {
  if (!map.getSource(id)) {
    try {
      map.addSource(id, source);
      return true;
    } catch (e) {
      console.warn(`Failed to add source ${id}:`, e);
      return false;
    }
  }
  return true; // Source already exists
}

/**
 * Safely add a layer to the map if it doesn't already exist
 */
export function safeAddLayer(map: mapboxgl.Map, layer: any, beforeId?: string) {
  if (!map.getLayer(layer.id)) {
    try {
      if (beforeId) {
        map.addLayer(layer, beforeId);
      } else {
        map.addLayer(layer);
      }
      return true;
    } catch (e) {
      console.warn(`Failed to add layer ${layer.id}:`, e);
      return false;
    }
  }
  return true; // Layer already exists
}

/**
 * Safely remove a layer from the map if it exists
 */
export function safeRemoveLayer(map: mapboxgl.Map, id: string) {
  if (map.getLayer(id)) {
    try {
      map.removeLayer(id);
      return true;
    } catch (e) {
      console.warn(`Failed to remove layer ${id}:`, e);
      return false;
    }
  }
  return true; // Layer doesn't exist
}

/**
 * Safely remove a source from the map if it exists
 */
export function safeRemoveSource(map: mapboxgl.Map, id: string) {
  if (map.getSource(id)) {
    try {
      map.removeSource(id);
      return true;
    } catch (e) {
      console.warn(`Failed to remove source ${id}:`, e);
      return false;
    }
  }
  return true; // Source doesn't exist
}

/**
 * Clean up all layers and sources with a given prefix
 */
export function cleanupMapResources(map: mapboxgl.Map, prefix: string) {
  const style = map.getStyle();
  if (!style) return;

  // Remove layers
  const layers = style.layers || [];
  layers.forEach(layer => {
    if (layer.id.startsWith(prefix)) {
      safeRemoveLayer(map, layer.id);
    }
  });

  // Remove sources
  const sources = Object.keys(style.sources || {});
  sources.forEach(sourceId => {
    if (sourceId.startsWith(prefix)) {
      safeRemoveSource(map, sourceId);
    }
  });
}

/**
 * Check if map is properly initialized and ready
 */
export function isMapReady(map: mapboxgl.Map | null): boolean {
  if (!map) return false;
  
  try {
    // Check if map is loaded and style is loaded
    return map.loaded() && map.isStyleLoaded();
  } catch (e) {
    return false;
  }
}