/**
 * Escalation scoring utilities with time-weighted moving average
 * Implements asymmetric behavior: quick to rise, slow to decay
 * 
 * Key features:
 * - Escalations happen quickly (especially for critical events)
 * - De-escalations happen very slowly (48hr window before decay starts)
 * - Critical events (score >= 8) cause immediate escalation
 * - High conflict zones have a score floor to prevent rapid collapse
 * - 99% inertia when de-escalating after periods of no activity
 */

interface EscalationEvent {
  escalation_score: number;
  timestamp: string;
  id: string;
}

interface EscalationState {
  score: number;
  lastUpdated: string;
  eventIds: string[];
}

// Constants for escalation calculation
const INERTIA_FACTOR = 0.75; // Weight for previous score (75%)
const NEW_EVENT_FACTOR = 0.25; // Weight for new events (25%)
const DECAY_WINDOW_HOURS = 48; // Hours before decay starts (increased to 48 hours)
const DECAY_RATE_PER_HOUR = 0.002; // 0.2% decay per hour after window (reduced from 0.5%)
const MIN_SCORE = 1;
const MAX_SCORE = 10;
const MIN_EVENT_INTERVAL_HOURS = 6; // Minimum hours between events to prevent score inflation
const ESCALATION_BOOST_FACTOR = 1.5; // Multiplier for rapid escalation
const CRITICAL_EVENT_THRESHOLD = 8; // Events with score >= 8 cause immediate escalation

/**
 * Calculate time-weighted escalation score with inertia
 * @param previousState Previous escalation state
 * @param newEvents New events to incorporate
 * @returns Updated escalation state
 */
export function calculateEscalationScore(
  previousState: EscalationState | null,
  newEvents: EscalationEvent[]
): EscalationState {
  const now = new Date();
  
  // If no previous state, calculate initial score
  if (!previousState || newEvents.length === 0) {
    const avgScore = newEvents.length > 0
      ? newEvents.reduce((sum, e) => sum + e.escalation_score, 0) / newEvents.length
      : MIN_SCORE;
    
    return {
      score: Math.max(MIN_SCORE, Math.min(MAX_SCORE, avgScore)),
      lastUpdated: now.toISOString(),
      eventIds: newEvents.map(e => e.id)
    };
  }
  
  // Calculate time decay with persistence for high scores
  const lastUpdate = new Date(previousState.lastUpdated);
  const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
  
  let decayedScore = previousState.score;
  if (hoursSinceUpdate > DECAY_WINDOW_HOURS) {
    const decayHours = hoursSinceUpdate - DECAY_WINDOW_HOURS;
    
    // Apply different decay rates based on escalation level
    let effectiveDecayRate = DECAY_RATE_PER_HOUR;
    if (previousState.score >= 8) {
      // Critical escalation decays very slowly
      effectiveDecayRate = DECAY_RATE_PER_HOUR * 0.25; // 75% slower
    } else if (previousState.score >= 6) {
      // High escalation decays slowly
      effectiveDecayRate = DECAY_RATE_PER_HOUR * 0.5; // 50% slower
    }
    
    const decayFactor = Math.pow(1 - effectiveDecayRate, decayHours);
    decayedScore = previousState.score * decayFactor;
    
    // Set a floor based on the peak score to prevent complete collapse
    const scoreFloor = previousState.score >= 8 ? 5 : 
                      previousState.score >= 6 ? 3 : 
                      MIN_SCORE;
    decayedScore = Math.max(decayedScore, scoreFloor);
  }
  
  // Get only new events (not already processed)
  const processedIds = new Set(previousState.eventIds);
  const genuinelyNewEvents = newEvents.filter(e => !processedIds.has(e.id));
  
  // If no new events, just return decayed score
  if (genuinelyNewEvents.length === 0) {
    return {
      score: Math.max(MIN_SCORE, Math.min(MAX_SCORE, decayedScore)),
      lastUpdated: now.toISOString(),
      eventIds: previousState.eventIds
    };
  }
  
  // Calculate new events average
  const newEventsAvg = genuinelyNewEvents.reduce((sum, e) => sum + e.escalation_score, 0) / genuinelyNewEvents.length;
  
  // Check for critical events that should cause immediate escalation
  const hasCriticalEvent = genuinelyNewEvents.some(e => e.escalation_score >= CRITICAL_EVENT_THRESHOLD);
  
  // Apply time-weighted moving average with stronger asymmetric behavior
  let combinedScore: number;
  if (newEventsAvg > decayedScore || hasCriticalEvent) {
    // Escalation rises quickly - use dynamic weighting based on severity
    const severityMultiplier = Math.min((newEventsAvg - decayedScore) / 3, 1);
    let dynamicNewEventFactor = NEW_EVENT_FACTOR * (1 + severityMultiplier);
    
    // Critical events cause immediate escalation
    if (hasCriticalEvent) {
      dynamicNewEventFactor = Math.min(dynamicNewEventFactor * ESCALATION_BOOST_FACTOR, 0.8);
    }
    
    const dynamicInertiaFactor = 1 - dynamicNewEventFactor;
    combinedScore = dynamicInertiaFactor * decayedScore + dynamicNewEventFactor * newEventsAvg;
    
    // Ensure critical events push score up significantly
    if (hasCriticalEvent && combinedScore < 7) {
      combinedScore = Math.min(7 + (newEventsAvg - 7) * 0.5, MAX_SCORE);
    }
  } else {
    // De-escalation is much slower - increase inertia significantly
    const slowDecayInertia = 0.95; // 95% weight on previous when de-escalating
    
    // Further slow decay if no events for a while
    const eventGap = hoursSinceUpdate > MIN_EVENT_INTERVAL_HOURS;
    const finalInertia = eventGap ? 0.99 : slowDecayInertia; // 99% if long gap (even slower)
    
    combinedScore = finalInertia * decayedScore + (1 - finalInertia) * newEventsAvg;
  }
  
  // Apply a minimum threshold to prevent rapid drops
  if (decayedScore > 7 && combinedScore < decayedScore - 0.5) {
    // For high escalation zones, limit drops to 0.5 per update
    combinedScore = decayedScore - 0.5;
  }
  
  // Update event IDs list (keep last 100 to prevent unbounded growth)
  const updatedEventIds = [...previousState.eventIds, ...genuinelyNewEvents.map(e => e.id)]
    .slice(-100);
  
  return {
    score: Math.max(MIN_SCORE, Math.min(MAX_SCORE, combinedScore)),
    lastUpdated: now.toISOString(),
    eventIds: updatedEventIds
  };
}

/**
 * Get escalation trend description
 * @param currentScore Current escalation score
 * @param previousScore Previous escalation score (optional)
 * @returns Human-readable trend description
 */
export function getEscalationTrend(currentScore: number, previousScore?: number): string {
  if (!previousScore) {
    return getEscalationLevel(currentScore);
  }
  
  const diff = currentScore - previousScore;
  const trend = diff > 0.5 ? '↑' : diff < -0.5 ? '↓' : '→';
  
  return `${getEscalationLevel(currentScore)} ${trend}`;
}

/**
 * Get human-readable escalation level
 * @param score Escalation score (1-10)
 * @returns Escalation level description
 */
export function getEscalationLevel(score: number): string {
  if (score >= 9) return 'Critical';
  if (score >= 7) return 'High';
  if (score >= 4) return 'Moderate';
  return 'Low';
}

/**
 * Get escalation color for UI
 * @param score Escalation score (1-10)
 * @returns Tailwind color class
 */
export function getEscalationColor(score: number): string {
  if (score >= 9) return 'text-red-600 bg-red-100';
  if (score >= 7) return 'text-orange-600 bg-orange-100';
  if (score >= 4) return 'text-yellow-600 bg-yellow-100';
  return 'text-blue-600 bg-blue-100';
}

/**
 * Format escalation score for display
 * @param score Escalation score
 * @returns Formatted string
 */
export function formatEscalationScore(score: number): string {
  return score.toFixed(1);
}

/**
 * Store escalation state in localStorage
 * @param zoneId Conflict zone identifier
 * @param state Escalation state to store
 */
export function storeEscalationState(zoneId: string, state: EscalationState): void {
  if (typeof window === 'undefined') return;
  
  const key = `escalation_${zoneId}`;
  localStorage.setItem(key, JSON.stringify(state));
}

/**
 * Retrieve escalation state from localStorage
 * @param zoneId Conflict zone identifier
 * @returns Stored escalation state or null
 */
export function getStoredEscalationState(zoneId: string): EscalationState | null {
  if (typeof window === 'undefined') return null;
  
  const key = `escalation_${zoneId}`;
  const stored = localStorage.getItem(key);
  
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}