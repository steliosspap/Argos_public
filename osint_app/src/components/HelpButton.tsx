'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Tooltip from './Tooltip';

interface HelpSection {
  title: string;
  items: {
    icon: React.ReactNode;
    text: string;
  }[];
}

export default function HelpButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  const helpSections: HelpSection[] = [
    {
      title: "Map Controls",
      items: [
        {
          icon: "🖱️",
          text: "Click and drag to pan the map"
        },
        {
          icon: "🔍",
          text: "Scroll or pinch to zoom in/out"
        },
        {
          icon: "📍",
          text: "Click markers to view event details"
        },
        {
          icon: "🎯",
          text: "Click conflict zones to filter events"
        }
      ]
    },
    {
      title: "Filters & Search",
      items: [
        {
          icon: "🔎",
          text: "Search events by title, location, or keywords"
        },
        {
          icon: "⏰",
          text: "Filter by time range: 1h, 24h, 7d, 30d"
        },
        {
          icon: "⚠️",
          text: "Filter by severity: Critical, High, Medium"
        },
        {
          icon: "🌍",
          text: "Click zones to filter by location"
        }
      ]
    },
    {
      title: "Intelligence Dashboard",
      items: [
        {
          icon: "📊",
          text: "Timeline: View chronological events"
        },
        {
          icon: "📋",
          text: "Intelligence: Conflict assessment summary"
        },
        {
          icon: "💰",
          text: "Arms: Track weapons transfers"
        },
        {
          icon: "📰",
          text: "News: Latest regional updates"
        }
      ]
    },
    {
      title: "Keyboard Shortcuts",
      items: [
        {
          icon: "⌨️",
          text: "/ - Focus search bar"
        },
        {
          icon: "⌨️",
          text: "ESC - Close modals"
        },
        {
          icon: "⌨️",
          text: "? - Toggle help"
        },
        {
          icon: "⌨️",
          text: "R - Refresh data"
        }
      ]
    }
  ];

  // Keyboard shortcut handler
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === '?') {
      setIsOpen(!isOpen);
    }
  };

  // Add keyboard listener
  useState(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  });

  return (
    <>
      {/* Help Button */}
      <Tooltip content="Help (press ?)" position="left">
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 z-40 p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </button>
      </Tooltip>

      {/* Help Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsOpen(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl border border-gray-800"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Help & Shortcuts</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Section Tabs */}
              <div className="flex space-x-2 mb-6 overflow-x-auto">
                {helpSections.map((section, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveSection(index)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                      activeSection === index
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[50vh]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {helpSections[activeSection].items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-3 p-3 bg-gray-800/50 rounded-lg"
                      >
                        <span className="text-2xl flex-shrink-0">{item.icon}</span>
                        <p className="text-sm text-gray-300">{item.text}</p>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 text-center">
                  Press ? at any time to toggle this help menu
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}