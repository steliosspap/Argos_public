export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 48) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return past.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: past.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

export function isWithinTimeRange(date: string | Date, range: string): boolean {
  const now = new Date();
  const eventDate = new Date(date);
  const diffMs = now.getTime() - eventDate.getTime();
  
  switch (range) {
    case '1h':
      return diffMs <= 60 * 60 * 1000;
    case '24h':
      return diffMs <= 24 * 60 * 60 * 1000;
    case '7d':
      return diffMs <= 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return diffMs <= 30 * 24 * 60 * 60 * 1000;
    default:
      return true;
  }
}

// Enhanced date formatting functions
export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function formatDateCompact(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

export function getDayOfWeek(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export function getTimeAgoDetailed(date: string | Date): { value: number; unit: string } {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMonths > 0) {
    return { value: diffMonths, unit: 'month' };
  } else if (diffWeeks > 0) {
    return { value: diffWeeks, unit: 'week' };
  } else if (diffDays > 0) {
    return { value: diffDays, unit: 'day' };
  } else if (diffHours > 0) {
    return { value: diffHours, unit: 'hour' };
  } else if (diffMins > 0) {
    return { value: diffMins, unit: 'minute' };
  } else {
    return { value: diffSecs, unit: 'second' };
  }
}