'use client';

import React from 'react';
// Removed heroicons import - using inline SVG instead
import Tooltip from '@/components/Tooltip';

interface Tab {
  id: string;
  label: string;
  tooltip?: string;
}

interface TabsWithTooltipsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export default function TabsWithTooltips({ 
  tabs, 
  activeTab, 
  onTabChange,
  className = ''
}: TabsWithTooltipsProps) {
  return (
    <div className={`border-b border-gray-700 ${className}`}>
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              group inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }
            `}
          >
            <span>{tab.label}</span>
            {tab.tooltip && (
              <Tooltip content={tab.tooltip}>
                <svg className="ml-2 w-4 h-4 text-gray-500 hover:text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </Tooltip>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}