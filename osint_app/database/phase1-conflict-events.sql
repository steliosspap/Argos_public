-- Phase 1: Create conflict_events table for real-time conflict monitoring
-- Run this in Supabase SQL Editor after setup.sql

-- Create conflict_events table
CREATE TABLE IF NOT EXISTS conflict_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT now(),
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  summary TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reliability INTEGER CHECK (reliability >= 1 AND reliability <= 10) DEFAULT 5,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  source_type TEXT NOT NULL DEFAULT 'open_source',
  affiliation TEXT,
  escalation_score INTEGER CHECK (escalation_score >= 0 AND escalation_score <= 10),
  country TEXT,
  region TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conflict_events_timestamp ON conflict_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_conflict_events_country ON conflict_events(country);
CREATE INDEX IF NOT EXISTS idx_conflict_events_region ON conflict_events(region);
CREATE INDEX IF NOT EXISTS idx_conflict_events_event_type ON conflict_events(event_type);
CREATE INDEX IF NOT EXISTS idx_conflict_events_escalation_score ON conflict_events(escalation_score);
CREATE INDEX IF NOT EXISTS idx_conflict_events_severity ON conflict_events(severity);
CREATE INDEX IF NOT EXISTS idx_conflict_events_location ON conflict_events(lat, lng);

-- Full text search index for summary and event_type
CREATE INDEX IF NOT EXISTS idx_conflict_events_search ON conflict_events USING gin(to_tsvector('english', summary || ' ' || event_type));

-- Enable Row Level Security
ALTER TABLE conflict_events ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Enable read access for all users" ON conflict_events FOR SELECT USING (true);

-- Create policies for admin operations
CREATE POLICY "Enable insert for authenticated users" ON conflict_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON conflict_events FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON conflict_events FOR DELETE USING (true);

-- Enable realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE conflict_events;

-- Insert some sample data
INSERT INTO conflict_events (timestamp, lat, lng, summary, event_type, reliability, severity, source_type, affiliation, escalation_score, country, region) VALUES
('2024-01-15 08:30:00', 34.5553, 69.2075, 'Small arms fire reported near government compound', 'armed_clash', 7, 'medium', 'news_report', 'unknown', 4, 'Afghanistan', 'Central Asia'),
('2024-01-15 09:15:00', 36.2048, 138.2529, 'Protest gathering at central square', 'civil_unrest', 8, 'low', 'social_media', 'civilian', 2, 'Japan', 'East Asia'),
('2024-01-15 10:45:00', 50.4501, 30.5234, 'Artillery exchange reported along contact line', 'artillery_fire', 9, 'high', 'military_report', 'military', 7, 'Ukraine', 'Eastern Europe'),
('2024-01-15 11:20:00', 33.3152, 44.3661, 'IED explosion targeting convoy', 'explosive_device', 8, 'high', 'news_report', 'insurgent', 6, 'Iraq', 'Middle East'),
('2024-01-15 12:00:00', 15.5527, 32.5599, 'Air strike on suspected militant positions', 'air_strike', 9, 'critical', 'military_report', 'military', 8, 'Sudan', 'North Africa'),
('2024-01-15 13:30:00', 6.5244, 3.3792, 'Kidnapping incident in rural area', 'kidnapping', 6, 'medium', 'news_report', 'criminal', 5, 'Nigeria', 'West Africa'),
('2024-01-15 14:15:00', 31.2357, 121.4944, 'Naval vessel movement in disputed waters', 'military_movement', 7, 'medium', 'satellite_imagery', 'military', 3, 'China', 'East Asia'),
('2024-01-15 15:45:00', 55.7558, 37.6176, 'Large scale military exercise begins', 'military_exercise', 9, 'low', 'official_announcement', 'military', 1, 'Russia', 'Eastern Europe'),
('2024-01-15 16:30:00', 23.8859, 45.0792, 'Cross-border shelling incident', 'artillery_fire', 8, 'high', 'news_report', 'military', 7, 'Saudi Arabia', 'Middle East'),
('2024-01-15 17:00:00', -14.2350, -51.9253, 'Peaceful demonstration in capital', 'civil_unrest', 9, 'low', 'news_report', 'civilian', 1, 'Brazil', 'South America');

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update the updated_at column
CREATE TRIGGER update_conflict_events_updated_at 
BEFORE UPDATE ON conflict_events 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();