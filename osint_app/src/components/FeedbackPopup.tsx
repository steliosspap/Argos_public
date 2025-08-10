'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

const POPUP_DELAY = 3 * 60 * 1000; // 3 minutes - reasonable time for user to explore
const FEEDBACK_POPUP_KEY = 'feedbackPopupShown';

export default function FeedbackPopup() {
  const [showPopup, setShowPopup] = useState(false);
  const [hasCheckedPreferences, setHasCheckedPreferences] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || hasCheckedPreferences) return;

    const checkPopupStatus = async () => {
      try {
        // Fetch user preferences from database
        const response = await fetch('/api/account/get-preferences', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          const preferences = data.preferences || {};
          
          setHasCheckedPreferences(true);
          
          // If popup has already been shown, don't show it again
          if (preferences[FEEDBACK_POPUP_KEY]) {
            return;
          }

          // Set timer to show popup
          const timer = setTimeout(() => {
            setShowPopup(true);
          }, POPUP_DELAY);

          return () => clearTimeout(timer);
        }
      } catch (error) {
        console.error('Error checking feedback popup status:', error);
        // Fall back to localStorage check
        const localKey = `${FEEDBACK_POPUP_KEY}_${user.username}`;
        if (!localStorage.getItem(localKey)) {
          const timer = setTimeout(() => {
            setShowPopup(true);
          }, POPUP_DELAY);
          return () => clearTimeout(timer);
        }
      }
    };

    checkPopupStatus();
  }, [user, hasCheckedPreferences]);

  const handleClose = async () => {
    if (!user) return;

    try {
      // Get auth token
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No auth token');
      }

      // Update preferences in database
      const response = await fetch('/api/account/update-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          [FEEDBACK_POPUP_KEY]: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      // Also store in localStorage as backup
      const localKey = `${FEEDBACK_POPUP_KEY}_${user.username}`;
      localStorage.setItem(localKey, 'true');
      
    } catch (error) {
      console.error('Error updating feedback popup status:', error);
      // Even if the API call fails, still store in localStorage
      const localKey = `${FEEDBACK_POPUP_KEY}_${user.username}`;
      localStorage.setItem(localKey, 'true');
    }
    
    setShowPopup(false);
  };

  if (!showPopup || !user) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Popup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-800 shadow-2xl"
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Icon */}
          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>

          {/* Content */}
          <h3 className="text-xl font-bold text-white mb-2">
            How's your experience so far?
          </h3>
          <p className="text-gray-400 mb-6">
            We're constantly improving Argos based on user feedback. Your insights help us build a better intelligence platform.
          </p>

          {/* Actions */}
          <div className="flex flex-col space-y-3">
            <Link
              href="/feedback"
              onClick={handleClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors text-center"
            >
              Share Feedback
            </Link>
            <button
              onClick={handleClose}
              className="w-full text-gray-400 hover:text-white py-2 px-4 rounded-lg transition-colors"
            >
              Maybe Later
            </button>
          </div>

          {/* Note */}
          <p className="text-xs text-gray-500 mt-4 text-center">
            This popup will only appear once
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}