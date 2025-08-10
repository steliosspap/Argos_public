'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Removed heroicons import - using inline SVG instead
import LoadingSkeleton from '@/components/LoadingSkeleton';
import { analytics } from '@/utils/analytics';
import { createClient } from '@supabase/supabase-js';

interface UserPreferences {
  regions: string[];
  eventTypes: string[];
  interests: string[];
  severityThreshold: number;
  notificationSettings: {
    emailAlerts: boolean;
    criticalOnly: boolean;
    dailyDigest: boolean;
  };
  displaySettings: {
    autoRefresh: boolean;
    refreshInterval: number;
    defaultView: 'map' | 'timeline' | 'dashboard';
  };
}

const AVAILABLE_REGIONS = [
  'Middle East',
  'Eastern Europe',
  'Western Europe',
  'North America',
  'South America',
  'East Asia',
  'South Asia',
  'Southeast Asia',
  'Africa',
  'Oceania'
];

const EVENT_TYPES = [
  'Military Conflict',
  'Civil Unrest',
  'Diplomatic Tensions',
  'Arms Deals',
  'Cyber Attacks',
  'Economic Sanctions',
  'Humanitarian Crisis',
  'Border Incidents'
];

const INTERESTS = [
  'NATO Operations',
  'UN Peacekeeping',
  'Terrorist Activities',
  'Nuclear Proliferation',
  'Maritime Security',
  'Space Warfare',
  'Hybrid Warfare',
  'Information Warfare',
  'Energy Security',
  'Climate Conflicts',
  'Drone Warfare',
  'PMC Activities'
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AccountPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences>({
    regions: [],
    eventTypes: [],
    interests: [],
    severityThreshold: 5,
    notificationSettings: {
      emailAlerts: false,
      criticalOnly: false,
      dailyDigest: false
    },
    displaySettings: {
      autoRefresh: true,
      refreshInterval: 60,
      defaultView: 'map'
    }
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Track page view
    analytics.trackPageView('account');

    const loadPreferences = async () => {
      try {
        // First try to load from Supabase
        const { data, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user?.id)
          .single();

        if (data && !error) {
          setPreferences({
            regions: data.regions || [],
            eventTypes: data.event_types || [],
            interests: data.interests || [],
            severityThreshold: data.severity_threshold || 5,
            notificationSettings: data.notification_settings || {
              emailAlerts: false,
              criticalOnly: false,
              dailyDigest: false
            },
            displaySettings: data.display_settings || {
              autoRefresh: true,
              refreshInterval: 60,
              defaultView: 'map'
            }
          });
        } else {
          // Fall back to localStorage
          const savedPrefs = localStorage.getItem('userPreferences');
          if (savedPrefs) {
            setPreferences(JSON.parse(savedPrefs));
          }
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
        // Fall back to localStorage
        const savedPrefs = localStorage.getItem('userPreferences');
        if (savedPrefs) {
          setPreferences(JSON.parse(savedPrefs));
        }
      }
      setLoading(false);
    };

    loadPreferences();
  }, [isAuthenticated, router, user]);

  const handleRegionToggle = (region: string) => {
    setPreferences(prev => ({
      ...prev,
      regions: prev.regions.includes(region)
        ? prev.regions.filter(r => r !== region)
        : [...prev.regions, region]
    }));
  };

  const handleEventTypeToggle = (eventType: string) => {
    setPreferences(prev => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(eventType)
        ? prev.eventTypes.filter(e => e !== eventType)
        : [...prev.eventTypes, eventType]
    }));
  };

  const handleInterestToggle = (interest: string) => {
    setPreferences(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleNotificationToggle = (setting: keyof UserPreferences['notificationSettings']) => {
    setPreferences(prev => ({
      ...prev,
      notificationSettings: {
        ...prev.notificationSettings,
        [setting]: !prev.notificationSettings[setting]
      }
    }));
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      // Save to localStorage as backup
      localStorage.setItem('userPreferences', JSON.stringify(preferences));
      
      // Save to Supabase
      if (user?.id) {
        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            regions: preferences.regions,
            event_types: preferences.eventTypes,
            interests: preferences.interests,
            severity_threshold: preferences.severityThreshold,
            notification_settings: preferences.notificationSettings,
            display_settings: preferences.displaySettings,
            updated_at: new Date().toISOString()
          });

        if (error) {
          throw error;
        }
      }

      // Track preference save
      analytics.trackClick('save_preferences', 'success', {
        regionCount: preferences.regions.length,
        eventTypeCount: preferences.eventTypes.length,
        interestCount: preferences.interests.length
      });

      // Show success message
      setTimeout(() => {
        setSaving(false);
        alert('Preferences saved successfully!');
      }, 500);
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSaving(false);
      alert('Failed to save preferences');
      analytics.trackError('save_preferences_failed', { error: error.message });
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <Link
          href="/intelligence-center"
          className="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Intelligence Center
        </Link>

        <h1 className="text-3xl font-bold text-white mb-8">Account Settings</h1>

        {/* User info */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Profile Information</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-400">Email:</span>
              <p className="text-white">{user?.email || 'Not available'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-400">Account created:</span>
              <p className="text-white">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Region preferences */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-lg font-semibold text-white">Regions of Interest</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Select regions you want to monitor for intelligence updates
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {AVAILABLE_REGIONS.map(region => (
              <label
                key={region}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={preferences.regions.includes(region)}
                  onChange={() => handleRegionToggle(region)}
                  className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
                />
                <span className="text-gray-300 text-sm">{region}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Event type preferences */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-lg font-semibold text-white">Event Types</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Choose which types of events you want to track
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {EVENT_TYPES.map(eventType => (
              <label
                key={eventType}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={preferences.eventTypes.includes(eventType)}
                  onChange={() => handleEventTypeToggle(eventType)}
                  className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
                />
                <span className="text-gray-300 text-sm">{eventType}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Interests */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h2 className="text-lg font-semibold text-white">Specific Interests</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Select specific topics you want to follow closely
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {INTERESTS.map(interest => (
              <label
                key={interest}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={preferences.interests.includes(interest)}
                  onChange={() => handleInterestToggle(interest)}
                  className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
                />
                <span className="text-gray-300 text-sm">{interest}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h2 className="text-lg font-semibold text-white">Display Settings</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="flex items-center justify-between cursor-pointer mb-2">
                <div>
                  <span className="text-gray-300">Auto-refresh Dashboard</span>
                  <p className="text-sm text-gray-400">Automatically update data on the dashboard</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.displaySettings.autoRefresh}
                  onChange={() => setPreferences(prev => ({
                    ...prev,
                    displaySettings: {
                      ...prev.displaySettings,
                      autoRefresh: !prev.displaySettings.autoRefresh
                    }
                  }))}
                  className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
                />
              </label>
              {preferences.displaySettings.autoRefresh && (
                <div className="ml-4">
                  <label className="text-sm text-gray-400">
                    Refresh interval (seconds):
                    <input
                      type="number"
                      min="30"
                      max="300"
                      step="30"
                      value={preferences.displaySettings.refreshInterval}
                      onChange={(e) => setPreferences(prev => ({
                        ...prev,
                        displaySettings: {
                          ...prev.displaySettings,
                          refreshInterval: parseInt(e.target.value) || 60
                        }
                      }))}
                      className="ml-2 w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white"
                    />
                  </label>
                </div>
              )}
            </div>
            
            <div>
              <label className="text-gray-300 block mb-2">Default View</label>
              <select
                value={preferences.displaySettings.defaultView}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  displaySettings: {
                    ...prev.displaySettings,
                    defaultView: e.target.value as 'map' | 'timeline' | 'dashboard'
                  }
                }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="map">Map View</option>
                <option value="timeline">Timeline View</option>
                <option value="dashboard">Dashboard View</option>
              </select>
            </div>

            <div>
              <label className="text-gray-300 block mb-2">
                Minimum Severity Threshold
                <span className="ml-2 text-sm text-gray-400">(1-10)</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={preferences.severityThreshold}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  severityThreshold: parseInt(e.target.value)
                }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Low</span>
                <span className="text-white font-medium">{preferences.severityThreshold}</span>
                <span>Critical</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notification settings */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h2 className="text-lg font-semibold text-white">Notification Settings</h2>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-300">Email Alerts</span>
                <p className="text-sm text-gray-400">Receive email notifications for new events</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.notificationSettings.emailAlerts}
                onChange={() => handleNotificationToggle('emailAlerts')}
                className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
              />
            </label>
            
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-300">Critical Events Only</span>
                <p className="text-sm text-gray-400">Only notify for high severity events</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.notificationSettings.criticalOnly}
                onChange={() => handleNotificationToggle('criticalOnly')}
                className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
              />
            </label>
            
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-300">Daily Digest</span>
                <p className="text-sm text-gray-400">Receive a daily summary of events</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.notificationSettings.dailyDigest}
                onChange={() => handleNotificationToggle('dailyDigest')}
                className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
              />
            </label>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            onClick={savePreferences}
            disabled={saving}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              saving
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}