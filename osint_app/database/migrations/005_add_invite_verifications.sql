-- Migration: Add invite_verifications table
-- Date: 2025-07-17

-- Create invite_verifications table for tracking verification attempts
CREATE TABLE IF NOT EXISTS invite_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id uuid NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  verified_at TIMESTAMP DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_invite_verifications_code ON invite_verifications(invite_code_id);
CREATE INDEX IF NOT EXISTS idx_invite_verifications_verified_at ON invite_verifications(verified_at);

-- Enable Row Level Security
ALTER TABLE invite_verifications ENABLE ROW LEVEL SECURITY;

-- Policies for invite_verifications
CREATE POLICY "Admins can view all verifications" ON invite_verifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT ON invite_verifications TO authenticated;