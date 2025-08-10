'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MapLayer {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

interface MapLayerControlsProps {
  onLayerToggle: (layerId: string, enabled: boolean) => void;
  className?: string;
}

export default function MapLayerControls({ onLayerToggle, className = '' }: MapLayerControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [layers, setLayers] = useState<MapLayer[]>([
    { id: 'events', name: 'Conflict Events', icon: '', enabled: true },
    { id: 'arms', name: 'Arms Deals', icon: '', enabled: false },
    { id: 'zones', name: 'Conflict Zones', icon: '', enabled: true },
  ]);

  const handleToggle = (layerId: string) => {
    setLayers(prev => {
      const updated = prev.map(layer => 
        layer.id === layerId ? { ...layer, enabled: !layer.enabled } : layer
      );
      const toggledLayer = updated.find(l => l.id === layerId);
      if (toggledLayer) {
        onLayerToggle(layerId, toggledLayer.enabled);
      }
      return updated;
    });
  };

  const enabledCount = layers.filter(l => l.enabled).length;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="block bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg transition-all duration-200 cursor-pointer select-none"
        aria-label="Toggle map layers"
        aria-expanded={isExpanded}
        type="button"
      >
        <div className="flex items-center space-x-2 p-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
            />
          </svg>
          <span className="text-sm font-medium whitespace-nowrap">
            <span className="hidden sm:inline">Layers</span>
            <span className="sm:hidden">Layers</span>
            <span className="ml-1">({enabledCount})</span>
          </span>
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 right-0 bg-gray-800 rounded-lg shadow-xl p-4 min-w-[240px] z-50"
          >
            <h3 className="text-sm font-semibold text-white mb-3">Map Layers</h3>
            <div className="space-y-2">
              {layers.map(layer => (
                <label
                  key={layer.id}
                  className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={layer.enabled}
                    onChange={() => handleToggle(layer.id)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-gray-300 flex-1">{layer.name}</span>
                </label>
              ))}
            </div>
            
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className="text-xs text-gray-400">
                Toggle map layers to customize your view
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}