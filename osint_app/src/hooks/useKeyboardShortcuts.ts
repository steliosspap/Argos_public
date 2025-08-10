import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { analytics } from '@/utils/analytics';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: '/',
    description: 'Focus search',
    action: () => {
      const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  },
  {
    key: 'Escape',
    description: 'Close modal/overlay',
    action: () => {
      // Close any open modals
      const closeButton = document.querySelector('[aria-label="Close"], button:has(svg[viewBox*="6 18L18 6"])') as HTMLButtonElement;
      if (closeButton) {
        closeButton.click();
      }
    }
  },
  {
    key: '?',
    shift: true,
    description: 'Show keyboard shortcuts',
    action: () => {
      // Toggle help modal
      const event = new CustomEvent('toggle-shortcuts-modal');
      window.dispatchEvent(event);
    }
  }
];

export function useKeyboardShortcuts(customShortcuts: KeyboardShortcut[] = []) {
  const router = useRouter();

  // Navigation shortcuts
  const navigationShortcuts: KeyboardShortcut[] = [
    {
      key: 'g',
      description: 'Go to...',
      action: () => {} // This is a prefix key
    },
    {
      key: 'h',
      description: 'Go to Home',
      action: () => {
        router.push('/');
        analytics.trackClick('keyboard_shortcut', 'navigate_home');
      }
    },
    {
      key: 'i',
      description: 'Go to Intelligence Center',
      action: () => {
        router.push('/intelligence-center');
        analytics.trackClick('keyboard_shortcut', 'navigate_intelligence');
      }
    },
    {
      key: 'a',
      description: 'Go to Account',
      action: () => {
        router.push('/account');
        analytics.trackClick('keyboard_shortcut', 'navigate_account');
      }
    },
    {
      key: 'b',
      description: 'Go to About',
      action: () => {
        router.push('/about');
        analytics.trackClick('keyboard_shortcut', 'navigate_about');
      }
    }
  ];

  const allShortcuts = [...DEFAULT_SHORTCUTS, ...navigationShortcuts, ...customShortcuts];

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      // Exception for Escape key
      if (event.key !== 'Escape') {
        return;
      }
    }

    // Check for 'g' prefix for navigation
    const isGPrefix = window.lastKeyPressed === 'g' && Date.now() - window.lastKeyPressTime < 1000;
    
    if (event.key === 'g' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      window.lastKeyPressed = 'g';
      window.lastKeyPressTime = Date.now();
      return;
    }

    // Find matching shortcut
    const shortcut = allShortcuts.find(s => {
      if (isGPrefix && ['h', 'i', 'a', 'b'].includes(s.key)) {
        return s.key === event.key;
      }
      
      return s.key === event.key &&
        !!s.ctrl === event.ctrlKey &&
        !!s.alt === event.altKey &&
        !!s.shift === event.shiftKey;
    });

    if (shortcut) {
      event.preventDefault();
      shortcut.action();
      
      // Reset g prefix
      if (isGPrefix) {
        window.lastKeyPressed = '';
      }
    }
  }, [allShortcuts, router]);

  useEffect(() => {
    // Add window properties for tracking g prefix
    if (typeof window !== 'undefined') {
      window.lastKeyPressed = '';
      window.lastKeyPressTime = 0;
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  return allShortcuts;
}

// Declare window properties
declare global {
  interface Window {
    lastKeyPressed: string;
    lastKeyPressTime: number;
  }
}