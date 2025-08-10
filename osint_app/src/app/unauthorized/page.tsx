'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full text-center"
      >
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-white/70 mb-8">
            You don't have permission to access this page. This area is restricted to authorized personnel only.
          </p>
          
          <div className="space-y-4">
            <button
              onClick={() => router.back()}
              className="w-full bg-white/10 text-white py-3 px-4 rounded-lg font-medium hover:bg-white/20 transition-colors"
            >
              Go Back
            </button>
            
            <Link
              href="/intelligence-center"
              className="block w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Return to Intelligence Center
            </Link>
          </div>
        </div>
        
        <p className="mt-6 text-white/50 text-sm">
          If you believe this is an error, please contact your administrator.
        </p>
      </motion.div>
    </div>
  );
}