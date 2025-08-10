-- Beta Features Database Setup
-- Add these tables to your existing Supabase database

-- Create beta_signups table
CREATE TABLE IF NOT EXISTS beta_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  affiliation TEXT,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT message_length CHECK (char_length(message) >= 10 AND char_length(message) <= 2000)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_beta_signups_email ON beta_signups(email);
CREATE INDEX IF NOT EXISTS idx_beta_signups_created_at ON beta_signups(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);

-- Enable Row Level Security
ALTER TABLE beta_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for beta_signups
-- Allow anyone to insert (for public beta signup)
CREATE POLICY "Allow public beta signup" ON beta_signups 
  FOR INSERT WITH CHECK (true);

-- Allow only authenticated users to read (for admin panel)
CREATE POLICY "Allow admin read access" ON beta_signups 
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create policies for feedback
-- Allow anyone to insert feedback
CREATE POLICY "Allow public feedback submission" ON feedback 
  FOR INSERT WITH CHECK (true);

-- Allow only authenticated users to read feedback (for admin panel)
CREATE POLICY "Allow admin read access" ON feedback 
  FOR SELECT USING (auth.role() = 'authenticated');

-- Add comments for documentation
COMMENT ON TABLE beta_signups IS 'Stores beta program signup requests';
COMMENT ON TABLE feedback IS 'Stores user feedback and suggestions';
COMMENT ON COLUMN beta_signups.email IS 'User email address (unique constraint)';
COMMENT ON COLUMN beta_signups.affiliation IS 'Optional organization/company affiliation';
COMMENT ON COLUMN feedback.message IS 'User feedback content (10-2000 characters)';
COMMENT ON COLUMN feedback.user_agent IS 'Browser user agent for analytics';
COMMENT ON COLUMN feedback.ip_address IS 'User IP address for spam prevention';