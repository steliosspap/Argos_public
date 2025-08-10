'use client';

import React, { useEffect, useState } from 'react';
import { KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  shortcuts?: KeyboardShortcut[];
}

export default function KeyboardShortcutsModal({ shortcuts = [] }: KeyboardShortcutsModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-shortcuts-modal', handleToggle);
    return () => window.removeEventListener('toggle-shortcuts-modal', handleToggle);
  }, []);

  if (!isOpen) return null;

  const defaultShortcuts = [
    { category: 'General', shortcuts: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['/'], description: 'Focus search' },
      { keys: ['Esc'], description: 'Close modal/overlay' },
    ]},
    { category: 'Navigation', shortcuts: [
      { keys: ['g', 'h'], description: 'Go to Home' },
      { keys: ['g', 'i'], description: 'Go to Intelligence Center' },
      { keys: ['g', 'a'], description: 'Go to Account' },
      { keys: ['g', 'b'], description: 'Go to About' },
    ]},
    { category: 'Actions', shortcuts: shortcuts.map(s => ({
      keys: [
        s.ctrl && 'Ctrl',
        s.alt && 'Alt', 
        s.shift && 'Shift',
        s.key
      ].filter(Boolean),
      description: s.description
    }))}
  ].filter(cat => cat.shortcuts.length > 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-gray-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Keyboard Shortcuts</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {defaultShortcuts.map((category, idx) => (
              <div key={idx}>
                <h3 className="text-sm font-medium text-gray-400 mb-3">{category.category}</h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut, shortcutIdx) => (
                    <div key={shortcutIdx} className="flex items-center justify-between">
                      <span className="text-gray-300">{shortcut.description}</span>
                      <div className="flex items-center space-x-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <React.Fragment key={keyIdx}>
                            {keyIdx > 0 && <span className="text-gray-500 text-xs">then</span>}
                            <kbd className="px-2 py-1 text-sm font-semibold text-gray-300 bg-gray-700 border border-gray-600 rounded">
                              {key}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* Footer */}
          <div className="p-6 border-t border-gray-700 bg-gray-900/50">
            <p className="text-sm text-gray-400 text-center">
              Press <kbd className="px-2 py-1 text-xs font-semibold text-gray-300 bg-gray-700 border border-gray-600 rounded">?</kbd> anytime to show shortcuts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}