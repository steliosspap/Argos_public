-- Add preferences column to users table for storing user preferences including blocked sources
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Create index for preferences to optimize queries
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN (preferences);

-- Update the users table policies to include preferences
-- This is already covered by existing policies since they allow users to update their own profile