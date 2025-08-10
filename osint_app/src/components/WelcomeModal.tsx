'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface WelcomeModalProps {
  onClose: () => void;
}

export default function WelcomeModal({ onClose }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { user } = useAuth();

  const steps = [
    {
      title: "Welcome to Argos Intelligence Center",
      content: "Your real-time window into global military conflicts and geopolitical events.",
      image: (
        <div className="w-32 h-32 mx-auto mb-6 bg-blue-500/20 rounded-full flex items-center justify-center">
          <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
      )
    },
    {
      title: "Interactive Conflict Map",
      content: "Click on markers to view detailed event information. Use the zone clusters to explore conflict areas.",
      image: (
        <div className="w-32 h-32 mx-auto mb-6 bg-purple-500/20 rounded-full flex items-center justify-center">
          <svg className="w-16 h-16 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
            />
          </svg>
        </div>
      )
    },
    {
      title: "Real-Time Intelligence",
      content: "Events are updated every 5 minutes. Use filters to focus on specific time ranges and severity levels.",
      image: (
        <div className="w-32 h-32 mx-auto mb-6 bg-orange-500/20 rounded-full flex items-center justify-center">
          <svg className="w-16 h-16 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
      )
    },
    {
      title: "Search & Filter",
      content: "Use the search bar to find specific events, locations, or keywords. Apply filters to narrow down results.",
      image: (
        <div className="w-32 h-32 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
          <svg className="w-16 h-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" 
            />
          </svg>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = async () => {
    // Mark as seen in user metadata
    if (user) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', user.id)
          .single();

        const metadata = profile?.metadata || {};
        metadata.welcome_modal_shown = true;

        await supabase
          .from('profiles')
          .update({ metadata })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error updating welcome modal status:', error);
      }
    }
    
    // Also set in localStorage as backup
    if (typeof window !== 'undefined') {
      localStorage.setItem('welcome_modal_shown', 'true');
    }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      aria-describedby="welcome-modal-description"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="bg-gray-900 rounded-xl p-8 max-w-md w-full shadow-2xl border border-gray-800"
        role="document"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            {steps[currentStep].image}
            
            <h2 className="text-2xl font-bold text-white mb-4" id="welcome-modal-title">
              {steps[currentStep].title}
            </h2>
            
            <p className="text-gray-400 mb-8" id="welcome-modal-description">
              {steps[currentStep].content}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Progress dots */}
        <div className="flex justify-center space-x-2 mb-6" role="tablist" aria-label="Welcome steps">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-2 h-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                index === currentStep ? 'bg-blue-500' : 'bg-gray-600'
              }`}
              role="tab"
              aria-selected={index === currentStep}
              aria-label={`Step ${index + 1} of ${steps.length}: ${steps[index].title}`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded"
            aria-label="Skip welcome tutorial"
          >
            Skip
          </button>
          
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            aria-label={currentStep === steps.length - 1 ? 'Complete tutorial and get started' : `Go to next step: ${steps[Math.min(currentStep + 1, steps.length - 1)].title}`}
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}