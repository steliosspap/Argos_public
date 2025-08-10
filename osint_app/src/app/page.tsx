'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import InteractiveGlobe from '@/components/InteractiveGlobe';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function LandingPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const [hasInviteVerified, setHasInviteVerified] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    // Check if user has verified invite code
    const cookies = document.cookie.split(';');
    const hasInvite = cookies.some(cookie => cookie.trim().startsWith('invite_verified='));
    setHasInviteVerified(hasInvite && !isAuthenticated);
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isAuthenticated]);

  const scrollToPlatform = () => {
    const element = document.getElementById('platform-demo');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <main id="main-content" className="relative overflow-auto">
      <section className="relative min-h-screen" aria-label="Hero section">
        <div className="fixed inset-0 z-0 bg-gradient-to-br from-slate-100 via-blue-100 to-slate-100 dark:from-slate-900 dark:via-blue-900 dark:to-slate-900" />

        <div className="relative z-10 min-h-screen flex flex-col">
          <Navigation />
          
          {/* Welcome banner for invite-verified users */}
          {hasInviteVerified && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative z-20"
            >
              <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-sm border-b border-green-500/30">
                <div className="max-w-7xl mx-auto px-4 py-3">
                  <p className="text-green-400 text-sm flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Welcome to Argos! Your invite has been verified. Create an account to access the full platform.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
                  <span className="bg-gradient-to-r from-gray-900 via-blue-600 to-gray-900 dark:from-white dark:via-blue-100 dark:to-white bg-clip-text text-transparent">
                    ARGOS
                  </span>
                </h1>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                {isAuthenticated && user?.name && (
                  <p className="text-lg sm:text-xl text-gray-700 dark:text-white/80 mb-4 font-medium">
                    Welcome back, {user.name.split(' ')[0]}!
                  </p>
                )}
                <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-gray-900 dark:text-white/90 mb-6 md:mb-8 font-light tracking-wide">
                  Global Conflict Intelligence
                </p>
                <p className="text-base sm:text-lg md:text-xl text-gray-700 dark:text-white/70 mb-8 md:mb-12 max-w-2xl mx-auto font-light leading-relaxed px-4 sm:px-0">
                  Unified intelligence platform for real-time monitoring of global military conflicts, arms trades, and geopolitical events
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.9 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="mb-8 flex flex-col sm:flex-row gap-4 justify-center items-center"
              >
                <Link
                  href="/intelligence-center"
                  className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg hover:from-purple-700 hover:to-purple-800 transform hover:scale-105 active:scale-95 transition-all duration-200 shadow-2xl backdrop-blur-sm border border-white/20 touch-manipulation"
                >
                  <svg className="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Intelligence Center</span>
                  <svg className="ml-2 w-5 h-5 hidden sm:inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                {!isAuthenticated && (
                  <Link
                    href="/signup"
                    className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-gray-900 dark:text-white bg-transparent border-2 border-gray-900/30 dark:border-white/30 rounded-lg hover:bg-gray-900/10 dark:hover:bg-white/10 transform hover:scale-105 active:scale-95 transition-all duration-200 backdrop-blur-sm touch-manipulation"
                  >
                    <span>Sign Up</span>
                    <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                transition={{ duration: 0.8, delay: 1.2 }}
                className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-8 sm:mt-12 px-4 sm:px-0"
              >
                <div className="bg-gray-900/10 dark:bg-white/10 backdrop-blur-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-gray-700 dark:text-white/80 text-xs sm:text-sm font-medium">
                  Real-time Data
                </div>
                <div className="bg-gray-900/10 dark:bg-white/10 backdrop-blur-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-gray-700 dark:text-white/80 text-xs sm:text-sm font-medium">
                  AI-Powered Analysis
                </div>
                <div className="bg-gray-900/10 dark:bg-white/10 backdrop-blur-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-gray-700 dark:text-white/80 text-xs sm:text-sm font-medium">
                  Global Coverage
                </div>
                <div className="bg-gray-900/10 dark:bg-white/10 backdrop-blur-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-gray-700 dark:text-white/80 text-xs sm:text-sm font-medium">
                  Professional Grade
                </div>
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isLoaded ? 1 : 0 }}
            transition={{ duration: 1, delay: 2 }}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20"
          >
            <button
              onClick={scrollToPlatform}
              className="flex flex-col items-center text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <p className="text-xs mb-2 font-medium">Explore Platform</p>
              <motion.div
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </motion.div>
            </button>
          </motion.div>
        </div>
      </section>

      <div id="platform-demo" className="relative bg-gradient-to-b from-gray-100 to-gray-200 dark:from-slate-900 dark:to-slate-800 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Check out the platform
            </h2>
            <p className="text-xl text-gray-700 dark:text-white/70 mb-4 max-w-3xl mx-auto">
              Experience real-time global intelligence at your fingertips
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-gray-600 dark:text-white/60">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm">Live Data Stream</span>
              </div>
              <div className="hidden sm:block w-1 h-1 bg-gray-400 dark:bg-white/30 rounded-full"></div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm">300+ Events Daily</span>
              </div>
              <div className="hidden sm:block w-1 h-1 bg-gray-400 dark:bg-white/30 rounded-full"></div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="text-sm">AI-Powered Analysis</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="relative max-w-6xl mx-auto"
          >
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                🌍 Live Demo
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-800/50 dark:to-slate-900/50 rounded-3xl overflow-hidden border-2 border-blue-500/20 shadow-2xl backdrop-blur-sm">
              <div className="relative h-[600px] w-full">
                <InteractiveGlobe />
                
                {/* Stats overlay */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex flex-wrap justify-center gap-4 bg-black/80 backdrop-blur-sm rounded-lg px-6 py-3">
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">6</div>
                    <div className="text-xs text-white/60 uppercase tracking-wide">Sample Events</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-400">300+</div>
                    <div className="text-xs text-white/60 uppercase tracking-wide">Daily Events</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-400">Real-time</div>
                    <div className="text-xs text-white/60 uppercase tracking-wide">Processing</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-400">AI</div>
                    <div className="text-xs text-white/60 uppercase tracking-wide">Analysis</div>
                  </div>
                </div>

                <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white text-sm max-w-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">Interactive Demo</span>
                  </div>
                  <p className="text-white/70 text-xs">Click any marker to explore real intelligence data</p>
                </div>
                
                {/* Demo mode banner */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-yellow-500/90 backdrop-blur-sm text-black px-4 py-2 rounded-lg shadow-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">This is a limited demo view. Full data requires signup.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-gray-700 dark:text-white/60 mb-4">
                This is just a glimpse. Our platform processes <span className="text-blue-600 dark:text-blue-400 font-semibold">300+ events daily</span> with 
                <span className="text-green-600 dark:text-green-400 font-semibold"> real-time intelligence</span> from global sources.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  href="/intelligence-center"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-purple-800 transform hover:scale-105 transition-all duration-200 shadow-lg"
                >
                  <svg className="mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Access Full Intelligence Center
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                {!isAuthenticated && (
                  <Link
                    href="/signup"
                    className="inline-flex items-center px-6 py-3 bg-transparent border border-gray-300 dark:border-white/20 text-gray-900 dark:text-white font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200"
                  >
                    Create Account
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <footer className="relative bg-gray-100 dark:bg-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center text-gray-600 dark:text-white/60 text-sm">
            <div className="mb-4 md:mb-0">
              <p>&copy; 2025 Argos. Built for global transparency and security.</p>
            </div>
            <div className="flex items-center space-x-6">
              <Link href="/about" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                About
              </Link>
              <span className="text-gray-400 dark:text-white/30">•</span>
              <Link href="/intelligence-center" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Intelligence Center
              </Link>
              <span className="text-gray-400 dark:text-white/30">•</span>
              <Link href="/feedback" className="text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/70 transition-colors text-sm">
                Send Feedback
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}