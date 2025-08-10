'use client';

import { useEffect } from 'react';
import Link from 'next/link';
// Removed heroicons import - using inline SVG instead
import { motion } from 'framer-motion';
import { analytics } from '@/utils/analytics';

export default function AboutPage() {
  useEffect(() => {
    // Track page view
    analytics.trackPageView('about');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">About Argos</h1>
          <p className="text-xl text-gray-400">Factual, apolitical intelligence for a transparent world</p>
        </motion.div>

        {/* Content sections */}
        <div className="space-y-8">
          {/* Mission */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-gray-800 rounded-lg p-6 shadow-lg"
          >
            <h2 className="text-2xl font-semibold text-white mb-4">Our Mission</h2>
            <p className="text-gray-300 leading-relaxed">
              Argos provides real-time, AI-powered intelligence analysis from open-source data worldwide. 
              We believe in democratizing access to critical information, enabling individuals, organizations, 
              and governments to make informed decisions based on factual, unbiased intelligence.
            </p>
          </motion.section>

          {/* What We Do */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-gray-800 rounded-lg p-6 shadow-lg"
          >
            <h2 className="text-2xl font-semibold text-white mb-4">What We Do</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Real-Time Event Monitoring</h3>
                <p>Track global events as they unfold with our advanced monitoring system processing 300+ events daily from trusted news sources worldwide.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-2">AI-Powered Analysis</h3>
                <p>Our sophisticated AI models analyze, categorize, and assess the severity of events, providing actionable intelligence with escalation scoring.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Arms Trade Intelligence</h3>
                <p>Monitor global arms transfers and defense procurement activities with detailed tracking of deals, deliveries, and strategic implications.</p>
              </div>
            </div>
          </motion.section>

          {/* The Name Argos */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-gray-800 rounded-lg p-6 shadow-lg"
          >
            <h2 className="text-2xl font-semibold text-white mb-4">Why Argos?</h2>
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                Our name derives from <span className="text-white font-medium">Argos Panoptes</span> (Ancient Greek: Ἄργος Πανόπτης, 
                "All-seeing Argos"), the many-eyed giant from Greek mythology known for his perpetual vigilance.
              </p>
              <p className="leading-relaxed">
                Argos served the goddess Hera as a watchman, with countless eyes covering his body. His unique gift allowed 
                him to keep watch constantly—while some eyes slept, others remained open, making him the perfect guardian. 
                His most famous task was watching over Io, whom Zeus had transformed into a heifer.
              </p>
              <p className="leading-relaxed">
                Just as Argos could see everything happening around him simultaneously, our platform monitors global events 
                24/7, tracking conflicts, analyzing patterns, and providing comprehensive intelligence coverage. We chose this 
                name because, like the mythological giant, we maintain constant vigilance over world events, ensuring nothing 
                escapes our notice.
              </p>
              <p className="italic text-gray-400">
                "After Argos was slain by Hermes, Hera honored her faithful servant by placing his hundred eyes on the 
                peacock's tail—a reminder that true vigilance lives on, transformed but never forgotten."
              </p>
            </div>
          </motion.section>

          {/* Principles */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-gray-800 rounded-lg p-6 shadow-lg"
          >
            <h2 className="text-2xl font-semibold text-white mb-4">Our Principles</h2>
            <div className="space-y-3">
              <div className="flex items-start">
                <span className="text-blue-400 mr-3">✓</span>
                <div>
                  <h3 className="text-white font-medium">Factual Accuracy</h3>
                  <p className="text-gray-400 text-sm">We prioritize verified information from credible sources</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-blue-400 mr-3">✓</span>
                <div>
                  <h3 className="text-white font-medium">Political Neutrality</h3>
                  <p className="text-gray-400 text-sm">Our platform remains apolitical, focusing solely on facts</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-blue-400 mr-3">✓</span>
                <div>
                  <h3 className="text-white font-medium">Transparency</h3>
                  <p className="text-gray-400 text-sm">All data sources and methodologies are open and auditable</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-blue-400 mr-3">✓</span>
                <div>
                  <h3 className="text-white font-medium">Global Perspective</h3>
                  <p className="text-gray-400 text-sm">We provide comprehensive coverage across all regions</p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Data Sources */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-gray-800 rounded-lg p-6 shadow-lg"
          >
            <h2 className="text-2xl font-semibold text-white mb-4">Data Sources</h2>
            <p className="text-gray-300 mb-4">
              We aggregate intelligence from 50+ verified sources including:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-700/50 rounded p-2 text-center text-gray-300">Reuters</div>
              <div className="bg-gray-700/50 rounded p-2 text-center text-gray-300">AP News</div>
              <div className="bg-gray-700/50 rounded p-2 text-center text-gray-300">BBC</div>
              <div className="bg-gray-700/50 rounded p-2 text-center text-gray-300">Al Jazeera</div>
              <div className="bg-gray-700/50 rounded p-2 text-center text-gray-300">Defense.gov</div>
              <div className="bg-gray-700/50 rounded p-2 text-center text-gray-300">UN Reports</div>
              <div className="bg-gray-700/50 rounded p-2 text-center text-gray-300">SIPRI</div>
              <div className="bg-gray-700/50 rounded p-2 text-center text-gray-300">Jane's</div>
            </div>
          </motion.section>

          {/* Contact & Support */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="bg-gray-800 rounded-lg p-6 shadow-lg"
          >
            <h2 className="text-2xl font-semibold text-white mb-4">Support</h2>
            <div className="space-y-3 text-gray-300">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <Link href="/feedback" className="hover:text-white transition-colors">
                  Send Feedback
                </Link>
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>24/7 Monitoring • Real-time Updates</span>
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Continuous Intelligence Coverage</span>
              </div>
            </div>
          </motion.section>

          {/* Disclosure */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-6"
          >
            <h2 className="text-xl font-semibold text-white mb-3">Disclosure</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              Argos is a factual, apolitical platform sourcing open data from publicly available news sources, 
              government reports, and verified intelligence feeds. We do not generate news or intelligence; 
              we aggregate, analyze, and present existing information in an accessible format. All analysis 
              is performed by AI models trained to identify patterns and assess severity based on historical data.
            </p>
          </motion.section>

          {/* Version Info */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="bg-gray-800 rounded-lg p-6 shadow-lg"
          >
            <h2 className="text-xl font-semibold text-white mb-3">Version Information</h2>
            <div className="space-y-2 text-sm text-gray-300">
              <div>
                <span className="text-gray-400">Platform Version:</span> <span className="font-mono">2.0.0</span>
              </div>
              <div>
                <span className="text-gray-400">API Version:</span> <span className="font-mono">v2</span>
              </div>
              <div>
                <span className="text-gray-400">Last Updated:</span> <span className="font-mono">{new Date().toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-gray-400">Status:</span> <span className="text-green-400">Operational</span>
              </div>
            </div>
          </motion.section>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="mt-12 text-center"
        >
          <Link
            href="/intelligence-center"
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            onClick={() => analytics.trackClick('about_cta', 'intelligence_center')}
          >
            Explore Intelligence Center
            <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <p className="mt-4 text-sm text-gray-400">
            Join thousands of analysts, researchers, and decision-makers using Argos
          </p>
        </motion.div>
      </div>
    </div>
  );
}