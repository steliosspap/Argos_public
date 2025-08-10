-- Migration: Add invite code system for beta access
-- Date: 2025-07-17

-- Create invite_codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(8) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP,
  max_uses INTEGER DEFAULT 1, -- Default to single use
  current_uses INTEGER DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  
  -- Lockdown mode: link code to specific user
  assigned_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP,
  
  CONSTRAINT valid_uses CHECK (current_uses <= max_uses OR max_uses IS NULL),
  CONSTRAINT code_format CHECK (code ~ '^[A-Z0-9]{6,8}$')
);

-- Create invite_redemptions table for tracking usage
CREATE TABLE IF NOT EXISTS invite_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id uuid NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMP DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  
  -- Ensure one code per user in lockdown mode
  UNIQUE(user_id)
);

-- Create invite_verifications table for tracking verification attempts
CREATE TABLE IF NOT EXISTS invite_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id uuid NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  verified_at TIMESTAMP DEFAULT now()
);

-- Create user_sessions table to track sessions per account
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code_id uuid REFERENCES invite_codes(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now(),
  last_activity TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  -- Track device/browser fingerprint for better session management
  device_fingerprint TEXT
);

-- Add invite_code_used column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS invite_code_id uuid REFERENCES invite_codes(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_invite_codes_active ON invite_codes(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_invite_codes_assigned_user ON invite_codes(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invite_redemptions_user ON invite_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_invite_redemptions_code ON invite_redemptions(invite_code_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at);

-- Function to validate and redeem invite code
CREATE OR REPLACE FUNCTION validate_and_redeem_invite_code(
  p_code VARCHAR(8),
  p_user_id uuid,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT,
  invite_code_id uuid
) AS $$
DECLARE
  v_invite_code RECORD;
  v_existing_redemption RECORD;
BEGIN
  -- Check if code exists and is active
  SELECT * INTO v_invite_code
  FROM invite_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid or expired invite code', NULL::uuid;
    RETURN;
  END IF;
  
  -- Check if code has reached max uses
  IF v_invite_code.max_uses IS NOT NULL AND v_invite_code.current_uses >= v_invite_code.max_uses THEN
    RETURN QUERY SELECT false, 'Invite code has reached maximum uses', NULL::uuid;
    RETURN;
  END IF;
  
  -- In lockdown mode, check if code is assigned to a specific user
  IF v_invite_code.assigned_user_id IS NOT NULL AND v_invite_code.assigned_user_id != p_user_id THEN
    RETURN QUERY SELECT false, 'This invite code is not assigned to you', NULL::uuid;
    RETURN;
  END IF;
  
  -- Check if user has already used any invite code (one code per user in lockdown)
  SELECT * INTO v_existing_redemption
  FROM invite_redemptions
  WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT false, 'You have already used an invite code', NULL::uuid;
    RETURN;
  END IF;
  
  -- Redeem the code
  INSERT INTO invite_redemptions (invite_code_id, user_id, ip_address, user_agent)
  VALUES (v_invite_code.id, p_user_id, p_ip_address, p_user_agent);
  
  -- Update usage count
  UPDATE invite_codes
  SET current_uses = current_uses + 1
  WHERE id = v_invite_code.id;
  
  -- Update user with invite code reference
  UPDATE users
  SET invite_code_id = v_invite_code.id
  WHERE id = p_user_id;
  
  RETURN QUERY SELECT true, NULL::TEXT, v_invite_code.id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION generate_invite_code(
  p_length INTEGER DEFAULT 8,
  p_created_by uuid DEFAULT NULL,
  p_max_uses INTEGER DEFAULT 1,
  p_expires_in_days INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS VARCHAR(8) AS $$
DECLARE
  v_code VARCHAR(8);
  v_chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_attempts INTEGER := 0;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..p_length LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::INTEGER, 1);
    END LOOP;
    
    -- Try to insert with this code
    BEGIN
      INSERT INTO invite_codes (code, created_by, max_uses, expires_at, metadata)
      VALUES (
        v_code, 
        p_created_by, 
        p_max_uses,
        CASE WHEN p_expires_in_days IS NOT NULL 
          THEN now() + (p_expires_in_days || ' days')::INTERVAL 
          ELSE NULL 
        END,
        p_metadata
      );
      
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      v_attempts := v_attempts + 1;
      IF v_attempts > 100 THEN
        RAISE EXCEPTION 'Could not generate unique invite code after 100 attempts';
      END IF;
      -- Continue loop to try another code
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to track user sessions
CREATE OR REPLACE FUNCTION track_user_session(
  p_user_id uuid,
  p_session_token TEXT,
  p_invite_code_id uuid DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL,
  p_session_duration_hours INTEGER DEFAULT 24
) RETURNS uuid AS $$
DECLARE
  v_session_id uuid;
BEGIN
  -- Deactivate any existing sessions with the same token
  UPDATE user_sessions
  SET is_active = false
  WHERE session_token = p_session_token
    AND is_active = true;
  
  -- Create new session
  INSERT INTO user_sessions (
    user_id,
    invite_code_id,
    session_token,
    ip_address,
    user_agent,
    device_fingerprint,
    expires_at
  ) VALUES (
    p_user_id,
    p_invite_code_id,
    p_session_token,
    p_ip_address,
    p_user_agent,
    p_device_fingerprint,
    now() + (p_session_duration_hours || ' hours')::INTERVAL
  ) RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- View for session analytics
CREATE OR REPLACE VIEW user_session_analytics AS
SELECT 
  u.id as user_id,
  u.username,
  u.email,
  ic.code as invite_code,
  COUNT(DISTINCT us.id) as total_sessions,
  COUNT(DISTINCT us.id) FILTER (WHERE us.is_active = true) as active_sessions,
  COUNT(DISTINCT us.ip_address) as unique_ips,
  COUNT(DISTINCT us.device_fingerprint) as unique_devices,
  MAX(us.created_at) as last_session_created,
  MAX(us.last_activity) as last_activity
FROM users u
LEFT JOIN invite_codes ic ON u.invite_code_id = ic.id
LEFT JOIN user_sessions us ON u.id = us.user_id
GROUP BY u.id, u.username, u.email, ic.code;

-- Enable Row Level Security
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for invite_codes
CREATE POLICY "Admins can manage invite codes" ON invite_codes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Users can view their assigned invite codes" ON invite_codes
  FOR SELECT USING (assigned_user_id = auth.uid());

-- Policies for invite_redemptions
CREATE POLICY "Users can view own redemptions" ON invite_redemptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all redemptions" ON invite_redemptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Policies for user_sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all sessions" ON user_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT ON user_session_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION validate_and_redeem_invite_code TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invite_code TO authenticated;
GRANT EXECUTE ON FUNCTION track_user_session TO authenticated;