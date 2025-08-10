-- Create beta_signups table for the new landing page
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS beta_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  organization TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_beta_signups_email ON beta_signups(email);
CREATE INDEX IF NOT EXISTS idx_beta_signups_created_at ON beta_signups(created_at DESC);

-- Enable Row Level Security
ALTER TABLE beta_signups ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (insert only, no read for privacy)
CREATE POLICY "Enable insert for all users" ON beta_signups FOR INSERT WITH CHECK (true);

-- Admin policy for read access (optional - for admin panel)
CREATE POLICY "Enable read for authenticated users" ON beta_signups FOR SELECT USING (auth.role() = 'authenticated');

-- Add some sample data (optional - for testing)
INSERT INTO beta_signups (name, email, organization) VALUES
('John Smith', 'john.smith@defense.gov', 'U.S. Department of Defense'),
('Sarah Chen', 'sarah.chen@nato.int', 'NATO Intelligence'),
('Michael Rodriguez', 'mrodriguez@csis.org', 'Center for Strategic Studies'),
('Emma Thompson', 'e.thompson@bbc.co.uk', 'BBC News'),
('David Kim', 'dkim@rand.org', 'RAND Corporation')
ON CONFLICT (email) DO NOTHING;