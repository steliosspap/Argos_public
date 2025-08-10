'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { storage } from '@/utils/storage';
import { MapPin, Clock, AlertTriangle, ExternalLink, RotateCcw, User, Calendar, FileText } from 'lucide-react';

interface ArchivedEvent {
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
  deleted: boolean;
  deleted_at: string;
  deleted_by: string;
  deletion_reason: string;
  deletion_notes?: string;
  deleted_by_email: string;
  deleted_by_name: string;
}

export default function ArchivedEventsPage() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<ArchivedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ArchivedEvent | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      router.push('/login');
    }
  }, [isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchArchivedEvents();
    }
  }, [isAdmin, page]);

  const fetchArchivedEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/events/delete?page=${page}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${storage.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch archived events');
      }

      const data = await response.json();
      setEvents(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch archived events');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreClick = (event: ArchivedEvent) => {
    setSelectedEvent(event);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    if (!selectedEvent) return;

    try {
      const response = await fetch('/api/admin/events/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storage.getAuthToken()}`,
        },
        body: JSON.stringify({
          eventId: selectedEvent.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to restore event');
      }

      // Remove the event from the archived list
      setEvents(events.filter(e => e.id !== selectedEvent.id));
      setShowRestoreModal(false);
      setSelectedEvent(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restore event');
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
      event.region.toLowerCase().includes(query) ||
      event.deletion_reason?.toLowerCase().includes(query) ||
      event.deletion_notes?.toLowerCase().includes(query) ||
      event.deleted_by_email?.toLowerCase().includes(query)
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin: Archived Events</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View and restore deleted events</p>
            </div>
            <div className="flex gap-4">
              <Link
                href="/admin/events"
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Back to Live Events
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
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search archived events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Archived Events List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading archived events...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {filteredEvents.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-12">
                  {searchQuery ? 'No archived events found matching your search.' : 'No archived events.'}
                </p>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-red-200 dark:border-red-800"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {event.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          {event.summary}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestoreClick(event)}
                        className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                        title="Restore event"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restore
                      </button>
                    </div>

                    {/* Deletion Info */}
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-red-900 dark:text-red-100 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Deletion Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                          <User className="w-4 h-4" />
                          <span>Deleted by: {event.deleted_by_name || event.deleted_by_email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                          <Calendar className="w-4 h-4" />
                          <span>Deleted at: {new Date(event.deleted_at).toLocaleString()}</span>
                        </div>
                        {event.deletion_reason && (
                          <div className="col-span-2 text-red-700 dark:text-red-300">
                            <span className="font-medium">Reason:</span> {event.deletion_reason}
                          </div>
                        )}
                        {event.deletion_notes && (
                          <div className="col-span-2 text-red-700 dark:text-red-300">
                            <span className="font-medium">Additional Notes:</span> {event.deletion_notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>{event.region}, {event.country}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(event.timestamp).toLocaleString()}</span>
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

      {/* Restore Confirmation Modal */}
      {showRestoreModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Confirm Restore Event
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to restore this event? It will be made visible again in all live views.
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <p className="font-medium text-gray-900 dark:text-white">{selectedEvent.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {selectedEvent.region}, {selectedEvent.country} - {new Date(selectedEvent.timestamp).toLocaleString()}
              </p>
              {selectedEvent.deletion_reason && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  Was deleted for: {selectedEvent.deletion_reason}
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRestoreModal(false);
                  setSelectedEvent(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Restore Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}