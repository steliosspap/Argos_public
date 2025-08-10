'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { storage } from '@/utils/storage';

export default function AccountSettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const { setTheme, mounted } = useTheme();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: false,
    newsAlerts: true,
    escalationAlerts: true,
    refreshInterval: '5',
    theme: (typeof window !== 'undefined' ? localStorage.getItem('theme') : 'dark') as 'dark' | 'light' || 'dark',
    language: 'en',
    timezone: 'UTC',
    mapStyle: 'satellite',
    autoPlayVideos: false,
    showEventLabels: true,
    soundAlerts: false,
    blockedSources: ['nakedcapitalism'] as string[],
  });
  
  const [newBlockedSource, setNewBlockedSource] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (user) {
      setFormData(prev => ({
        ...prev,
        username: user.username || '',
        email: user.email || '',
      }));
    }
  }, [isAuthenticated, user, router]);

  // Fetch user preferences on component mount
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!isAuthenticated) return;
      
      try {
        const response = await fetch('/api/account/get-preferences', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.preferences) {
            setPreferences(prev => ({
              ...prev,
              ...data.preferences,
              // Ensure blockedSources is an array, defaulting to ['nakedcapitalism'] if not present
              blockedSources: data.preferences.blockedSources || ['nakedcapitalism']
            }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
      }
    };
    
    fetchPreferences();
  }, [isAuthenticated]);

  // Sync theme from context once when component mounts
  useEffect(() => {
    if (mounted) {
      // Only sync if the current preference doesn't match the actual theme
      const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      if (preferences.theme !== currentTheme) {
        setPreferences(prev => ({
          ...prev,
          theme: currentTheme
        }));
      }
    }
  }, [mounted]); // Remove theme from dependencies to prevent loops

  // Handle theme changes only when user changes the dropdown
  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setPreferences(prev => ({ ...prev, theme: newTheme }));
    setTheme(newTheme);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/account/update-profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storage.getAuthToken()}`,
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('Profile updated successfully');
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storage.getAuthToken()}`,
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('Password changed successfully');
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferencesUpdate = async () => {
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/account/update-preferences', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storage.getAuthToken()}`,
        },
        body: JSON.stringify(preferences),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('Preferences updated successfully');
      } else {
        setError(data.error || 'Failed to update preferences');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
            <Link
              href="/intelligence-center"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Back to Intelligence Center
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {message && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 rounded-lg">
            <p className="text-green-700 dark:text-green-400">{message}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Profile Information */}
        <section className="bg-white dark:bg-gray-900 rounded-lg p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Update Profile
            </button>
          </form>
        </section>

        {/* Change Password */}
        <section className="bg-white dark:bg-gray-900 rounded-lg p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={formData.currentPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength={8}
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength={8}
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Change Password
            </button>
          </form>
        </section>

        {/* Display Preferences */}
        <section className="bg-white dark:bg-gray-900 rounded-lg p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Display Preferences</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="theme" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Theme
              </label>
              <select
                id="theme"
                value={preferences.theme}
                onChange={(e) => handleThemeChange(e.target.value as 'dark' | 'light')}
                className="w-48 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Language
              </label>
              <select
                id="language"
                value={preferences.language}
                onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value }))}
                className="w-48 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ar">العربية</option>
                <option value="zh">中文</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Timezone
              </label>
              <select
                id="timezone"
                value={preferences.timezone}
                onChange={(e) => setPreferences(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-48 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Asia/Shanghai">Shanghai</option>
              </select>
            </div>
            
            <button
              onClick={handlePreferencesUpdate}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Save Display Preferences
            </button>
          </div>
        </section>

        {/* Map Preferences */}
        <section className="bg-white dark:bg-gray-900 rounded-lg p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Map Preferences</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="mapStyle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Map Style
              </label>
              <select
                id="mapStyle"
                value={preferences.mapStyle}
                onChange={(e) => setPreferences(prev => ({ ...prev, mapStyle: e.target.value }))}
                className="w-48 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="satellite">Satellite</option>
                <option value="streets">Streets</option>
                <option value="dark">Dark</option>
                <option value="terrain">Terrain</option>
              </select>
            </div>
            
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.showEventLabels}
                onChange={(e) => setPreferences(prev => ({ ...prev, showEventLabels: e.target.checked }))}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">Show event labels on map</span>
            </label>
            
            
            <button
              onClick={handlePreferencesUpdate}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Save Map Preferences
            </button>
          </div>
        </section>

        {/* Notification Preferences */}
        <section className="bg-white dark:bg-gray-900 rounded-lg p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Notification Preferences</h2>
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.emailNotifications}
                onChange={(e) => setPreferences(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">Email notifications</span>
            </label>
            
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.pushNotifications}
                onChange={(e) => setPreferences(prev => ({ ...prev, pushNotifications: e.target.checked }))}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">Push notifications</span>
            </label>
            
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.newsAlerts}
                onChange={(e) => setPreferences(prev => ({ ...prev, newsAlerts: e.target.checked }))}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">Breaking news alerts</span>
            </label>
            
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.escalationAlerts}
                onChange={(e) => setPreferences(prev => ({ ...prev, escalationAlerts: e.target.checked }))}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">High escalation alerts</span>
            </label>
            
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.soundAlerts}
                onChange={(e) => setPreferences(prev => ({ ...prev, soundAlerts: e.target.checked }))}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">Sound alerts for critical events</span>
            </label>
            
            <div className="pt-4">
              <label htmlFor="refreshInterval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data refresh interval (minutes)
              </label>
              <select
                id="refreshInterval"
                value={preferences.refreshInterval}
                onChange={(e) => setPreferences(prev => ({ ...prev, refreshInterval: e.target.value }))}
                className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">1</option>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="30">30</option>
              </select>
            </div>
            
            <button
              onClick={handlePreferencesUpdate}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Save Notification Preferences
            </button>
          </div>
        </section>

        {/* Content Source Preferences */}
        <section className="bg-white dark:bg-gray-900 rounded-lg p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Content Source Preferences</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Blocked Sources</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Add news sources you want to exclude from your feed. Content from these sources will not appear in your news feed.
              </p>
              
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Enter source name (e.g., nakedcapitalism)"
                  value={newBlockedSource}
                  onChange={(e) => setNewBlockedSource(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newBlockedSource.trim()) {
                      setPreferences(prev => ({
                        ...prev,
                        blockedSources: [...prev.blockedSources, newBlockedSource.trim().toLowerCase()]
                      }));
                      setNewBlockedSource('');
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    if (newBlockedSource.trim()) {
                      setPreferences(prev => ({
                        ...prev,
                        blockedSources: [...prev.blockedSources, newBlockedSource.trim().toLowerCase()]
                      }));
                      setNewBlockedSource('');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
              
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {preferences.blockedSources.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No blocked sources</p>
                ) : (
                  preferences.blockedSources.map((source, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
                      <span className="text-gray-700 dark:text-gray-300">{source}</span>
                      <button
                        onClick={() => {
                          setPreferences(prev => ({
                            ...prev,
                            blockedSources: prev.blockedSources.filter((_, i) => i !== index)
                          }));
                        }}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <button
              onClick={handlePreferencesUpdate}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Save Source Preferences
            </button>
          </div>
        </section>

        {/* Data Management */}
        <section className="bg-white dark:bg-gray-900 rounded-lg p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Data Management</h2>
          <div className="space-y-4">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Export Your Data</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Download all your account data, preferences, and activity history in JSON format.
              </p>
              <button
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors flex items-center gap-2"
                onClick={() => {
                  // Handle data export
                  alert('Data export functionality coming soon');
                }}
              >
                Export Data
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">Coming Soon</span>
              </button>
            </div>
            
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Danger Zone</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <button
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            onClick={() => {
              if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                // Handle account deletion
              }
            }}
          >
            Delete Account
          </button>
        </section>
      </div>
    </div>
  );
}