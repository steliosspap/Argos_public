/**
 * Formatting utilities for display text
 */

/**
 * Converts snake_case or underscore-separated strings to human-readable format
 * Examples:
 * - "civil_unrest" -> "Civil Unrest"
 * - "military_activity" -> "Military Activity"
 * - "cyber_attack" -> "Cyber Attack"
 */
export function formatLabel(label: string): string {
  if (!label) return '';
  
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format an array of labels
 */
export function formatLabels(labels: string[]): string[] {
  return labels.map(formatLabel);
}

/**
 * Format event type labels with special cases
 */
export function formatEventType(eventType: string): string {
  // Special cases that need custom formatting
  const specialCases: Record<string, string> = {
    'ied': 'IED',
    'vbied': 'VBIED',
    'nato': 'NATO',
    'un': 'UN',
    'usa': 'USA',
    'uk': 'UK',
    'uav': 'UAV',
    'atgm': 'ATGM',
    'sam': 'SAM',
  };
  
  // Check if the entire string is a special case
  const lowerLabel = eventType.toLowerCase();
  if (specialCases[lowerLabel]) {
    return specialCases[lowerLabel];
  }
  
  // Otherwise, format normally but preserve special case words
  return eventType
    .split('_')
    .map(word => {
      const lowerWord = word.toLowerCase();
      return specialCases[lowerWord] || 
        (word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    })
    .join(' ');
}

/**
 * Format severity levels
 */
export function formatSeverity(severity: string): string {
  const severityMap: Record<string, string> = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'critical': 'Critical'
  };
  
  return severityMap[severity.toLowerCase()] || formatLabel(severity);
}