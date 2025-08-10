'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface ConflictZone {
  id: string;
  name: string;
  center: [number, number];
  radius: number;
  escalationScore: number;
  eventCount: number;
  lastUpdated: Date;
}

interface IntelligenceSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedZone: ConflictZone | null;
  conflictZones: ConflictZone[];
  isMobile: boolean;
  onZoneSelect: (zone: ConflictZone) => void;
  lastUpdateTime?: Date | null;
  autoRefreshEnabled?: boolean;
  onAutoRefreshToggle?: (enabled: boolean) => void;
}

export default function IntelligenceSidebar({
  isOpen,
  onClose,
  selectedZone,
  conflictZones,
  isMobile,
  onZoneSelect,
  lastUpdateTime,
  autoRefreshEnabled = true,
  onAutoRefreshToggle
}: IntelligenceSidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const getEscalationColor = (score: number): string => {
    if (score >= 7) return 'text-red-500';
    if (score >= 4) return 'text-orange-500';
    return 'text-blue-500';
  };

  const getEscalationBg = (score: number): string => {
    if (score >= 7) return 'bg-red-500/10 border-red-500/20';
    if (score >= 4) return 'bg-orange-500/10 border-orange-500/20';
    return 'bg-blue-500/10 border-blue-500/20';
  };

  // Sort zones by escalation score
  const sortedZones = [...conflictZones].sort((a, b) => b.escalationScore - a.escalationScore);
  
  console.log(`Sidebar: ${conflictZones.length} conflict zones, showing top 5`);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: -240 }}
            animate={{ x: 0 }}
            exit={{ x: -240 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`${
              isMobile ? 'fixed' : 'relative'
            } left-0 top-0 h-full w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-50`}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-900/20 dark:bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">A</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">Argos</span>
                </div>
                {isMobile && (
                  <button
                    onClick={onClose}
                    className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* User Info */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>Welcome, {user?.name ? user.name.split(' ')[0] : user?.username || 'User'}</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-2">
                <div className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-600/30">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Intelligence Center</span>
                </div>

                <Link
                  href="/"
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span>Home</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>

              {/* Conflict Zones Section */}
              <div className="border-t border-gray-200 dark:border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Active Conflict Zones
                </h3>
                <div className="space-y-2">
                  {sortedZones.length > 0 ? (
                    sortedZones.slice(0, 5).map(zone => (
                      <div
                        key={zone.id}
                        onClick={() => onZoneSelect(zone)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedZone?.id === zone.id
                            ? getEscalationBg(zone.escalationScore) + ' border-opacity-50'
                            : 'bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm">{zone.name}</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {zone.eventCount} events
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${getEscalationColor(zone.escalationScore)}`}>
                              {zone.escalationScore.toFixed(1)}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-500">score</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-600 dark:text-gray-500 text-sm">
                      <p>No active conflict zones</p>
                      <p className="text-xs mt-1">Waiting for event data...</p>
                    </div>
                  )}
                </div>
              </div>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
              {/* Auto-refresh toggle */}
              <div className="flex items-center space-x-2 mb-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={autoRefreshEnabled}
                    onChange={(e) => onAutoRefreshToggle?.(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Auto-refresh</span>
              </div>
              
              {/* Last update time */}
              <p className="text-xs text-gray-600 dark:text-gray-500">
                Last update: {lastUpdateTime ? new Date(lastUpdateTime).toLocaleTimeString() : 'Loading...'}
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}