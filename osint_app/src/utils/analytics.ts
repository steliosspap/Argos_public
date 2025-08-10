// Simple analytics tracking utility for OSINT app
// This tracks user interactions to help improve the app

interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
}

class Analytics {
  private queue: AnalyticsEvent[] = [];
  private isEnabled: boolean = true;
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Check if analytics should be enabled (e.g., based on user preferences)
    if (typeof window !== 'undefined') {
      this.isEnabled = localStorage.getItem('analytics_enabled') !== 'false';
      
      // Send queued events before page unload
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  track(event: AnalyticsEvent) {
    if (!this.isEnabled) return;

    // Add timestamp
    const eventWithTime = {
      ...event,
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(),
    };

    this.queue.push(eventWithTime);

    // Batch events - send after 1 second of inactivity or when queue reaches 10 events
    if (this.queue.length >= 10) {
      this.flush();
    } else {
      this.scheduleBatch();
    }
  }

  // Track specific events
  trackClick(element: string, label?: string, metadata?: Record<string, any>) {
    this.track({
      category: 'UI',
      action: 'click',
      label: label || element,
      metadata: { element, ...metadata }
    });
  }

  trackPageView(page: string, metadata?: Record<string, any>) {
    this.track({
      category: 'Navigation',
      action: 'page_view',
      label: page,
      metadata
    });
  }

  trackSearch(query: string, resultCount: number) {
    this.track({
      category: 'Search',
      action: 'search',
      label: query,
      value: resultCount,
      metadata: { query, resultCount }
    });
  }

  trackFilter(filterType: string, filterValue: string) {
    this.track({
      category: 'Filters',
      action: 'apply_filter',
      label: filterType,
      metadata: { filterType, filterValue }
    });
  }

  trackError(error: string, context?: Record<string, any>) {
    this.track({
      category: 'Errors',
      action: 'error',
      label: error,
      metadata: context
    });
  }

  trackEventInteraction(eventId: string, action: 'view' | 'expand' | 'share' | 'bookmark') {
    this.track({
      category: 'Events',
      action: `event_${action}`,
      label: eventId,
      metadata: { eventId, action }
    });
  }

  trackArmsDealInteraction(dealId: string, action: 'view' | 'expand' | 'modal') {
    this.track({
      category: 'ArmsDeals',
      action: `deal_${action}`,
      label: dealId,
      metadata: { dealId, action }
    });
  }

  trackMapInteraction(action: 'zoom' | 'pan' | 'marker_click' | 'zone_select', metadata?: Record<string, any>) {
    this.track({
      category: 'Map',
      action: `map_${action}`,
      metadata
    });
  }

  private scheduleBatch() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.flush();
    }, 1000);
  }

  private async flush() {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    try {
      // In production, this would send to your analytics endpoint
      // For now, we'll just log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Analytics Events:', events);
      } else {
        // Send to analytics endpoint
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events }),
          keepalive: true // Ensures request completes even if page unloads
        });
      }
    } catch (error) {
      console.error('Failed to send analytics:', error);
      // Re-queue events on failure
      this.queue.unshift(...events);
    }
  }

  private getSessionId(): string {
    if (typeof window === 'undefined') return '';
    
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }

  // Allow users to opt out
  disable() {
    this.isEnabled = false;
    if (typeof window !== 'undefined') {
      localStorage.setItem('analytics_enabled', 'false');
    }
  }

  enable() {
    this.isEnabled = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem('analytics_enabled', 'true');
    }
  }

  isTrackingEnabled() {
    return this.isEnabled;
  }
}

// Export singleton instance
export const analytics = new Analytics();