export interface EventFilters {
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  region: string[];
  country: string[];
  severity: string[];
  channel: string[];
  escalationScore: {
    min: number;
    max: number;
  };
  searchQuery: string;
  onlyInMapFrame: boolean;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TimelineState {
  isPlaying: boolean;
  currentTime: Date | null;
  selectedRange: {
    start: Date;
    end: Date;
  } | null;
  playbackSpeed: number;
}