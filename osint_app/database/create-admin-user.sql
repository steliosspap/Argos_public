-- Create default admin user
-- Password: admin123 (bcrypt hash with 10 rounds)
-- This hash was generated from 'admin123' using bcrypt

DO $$
BEGIN
  -- Check if admin user already exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin') THEN
    INSERT INTO users (
      username,
      email,
      name,
      password_hash,
      role,
      is_active
    ) VALUES (
      'admin',
      'admin@argos.ai',
      'System Administrator',
      '$2a$10$X0bMN3JZ7WvPKjEZB9qIluUKxJvFXkYR0yGzBh6MffElT6TsPuXhm',
      'admin',
      true
    );
  END IF;
END $$;