'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { storage } from '@/utils/storage';
import { MapPin, Clock, AlertTriangle, ExternalLink, Trash2, RefreshCw } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  summary: string;
  latitude: number;
  longitude: number;
  country: string;
  region: string;
  timestamp: string;
  channel: string;
  reliability: number;
  severity: string;
  source_url: string;
  created_at: string;
  deleted?: boolean;
}

export default function AdminEventsPage() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionNotes, setDeletionNotes] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '7d' | '30d' | '60d'>('60d');

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      router.push('/login');
    }
  }, [isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchEvents();
    }
  }, [isAdmin, page, sortBy, timeFilter]);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use the dedicated admin API that properly handles sorting and filtering
      const params = new URLSearchParams({
        sortBy,
        timeFilter,
        page: page.toString(),
        limit: '20'  // Reduced from 50 to handle large dataset
      });
      
      const response = await fetch(`/api/admin/events/list?${params}`, {
        headers: {
          'Authorization': `Bearer ${storage.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Failed to fetch events:', data);
        setError(data.error || 'Failed to fetch events');
        if (data.details) {
          console.error('Error details:', data.details);
        }
      } else {
        setEvents(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (event: Event) => {
    setSelectedEvent(event);
    setShowDeleteModal(true);
    setDeletionReason('');
    setDeletionNotes('');
  };

  const confirmDelete = async () => {
    if (!selectedEvent) return;

    try {
      const response = await fetch('/api/admin/events/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storage.getAuthToken()}`,
        },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          deletionReason,
          deletionNotes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Archive event failed:', error);
        throw new Error(error.error || 'Failed to archive event');
      }

      // Remove the event from the list
      setEvents(events.filter(e => e.id !== selectedEvent.id));
      setShowDeleteModal(false);
      setSelectedEvent(null);
      setDeletionReason('');
      setDeletionNotes('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredEvents = events.filter(event => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      event.title.toLowerCase().includes(query) ||
      event.summary.toLowerCase().includes(query) ||
      event.country.toLowerCase().includes(query) ||
      event.region.toLowerCase().includes(query)
    );
  });

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin: Event Management</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and moderate live events</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/admin/test', {
                      headers: {
                        'Authorization': `Bearer ${storage.getAuthToken()}`,
                      },
                    });
                    const data = await response.json();
                    console.log('Auth test result:', data);
                    alert(JSON.stringify(data, null, 2));
                  } catch (error) {
                    console.error('Auth test error:', error);
                  }
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Test Auth
              </button>
              <Link
                href="/admin/events/archived"
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                View Archived Events
              </Link>
              <Link
                href="/intelligence-center"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Back to Intelligence Center
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Search and Filter Controls */}
        <div className="space-y-4 mb-6">
          {/* Search Bar */}
          <input
            type="text"
            placeholder="Search events by title, summary, country, or region..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          {/* Filter Controls */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Time Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="timeFilter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Time Period:
              </label>
              <select
                id="timeFilter"
                value={timeFilter}
                onChange={(e) => {
                  setTimeFilter(e.target.value as any);
                  setPage(1); // Reset to first page
                }}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="60d">Last 60 days</option>
                <option value="all">All time</option>
              </select>
            </div>
            
            {/* Sort Order */}
            <div className="flex items-center gap-2">
              <label htmlFor="sortBy" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sort by:
              </label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
            
            {/* Event Count */}
            <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredEvents.length} events
            </div>
          </div>
        </div>

        {/* Events List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading events...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={fetchEvents}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {filteredEvents.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-12">
                  {searchQuery ? 'No events found matching your search.' : 'No events available.'}
                </p>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {event.title}
                          </h3>
                          <div className="text-sm text-gray-500 dark:text-gray-400 ml-4 whitespace-nowrap">
                            {(() => {
                              const date = new Date(event.timestamp);
                              const now = new Date();
                              const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                              return diffDays > 0 ? `${diffDays} days ago` : 'Today';
                            })()}
                          </div>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          {event.summary}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteClick(event)}
                        className="ml-4 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete event"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>{event.region}, {event.country}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">{new Date(event.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(event.severity)}`}>
                          {event.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <span className="text-xs">Source: {event.channel}</span>
                        {event.source_url && (
                          <a
                            href={event.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Confirm Archive Event
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to archive this event? It will be removed from live views but preserved for future research.
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <p className="font-medium text-gray-900 dark:text-white">{selectedEvent.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {selectedEvent.region}, {selectedEvent.country} - {new Date(selectedEvent.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="mb-4">
              <label htmlFor="deletionReason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Archive Reason (Optional)
              </label>
              <select
                id="deletionReason"
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a reason...</option>
                <option value="Duplicate">Duplicate</option>
                <option value="Irrelevant">Irrelevant</option>
                <option value="Low credibility">Low credibility</option>
                <option value="Incorrect information">Incorrect information</option>
                <option value="Not conflict-related">Not conflict-related</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="deletionNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                id="deletionNotes"
                value={deletionNotes}
                onChange={(e) => setDeletionNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add any additional context for this archival action..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedEvent(null);
                  setDeletionReason('');
                  setDeletionNotes('');
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Archive Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}