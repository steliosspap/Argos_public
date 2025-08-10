-- Argos Database Setup Script
-- Run this in Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create conflicts table
CREATE TABLE IF NOT EXISTS conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('border', 'civil_war', 'occupation', 'insurgency', 'territorial_dispute', 'other')),
  status TEXT NOT NULL CHECK (status IN ('active', 'ceasefire', 'resolved')),
  description TEXT NOT NULL,
  casualties INTEGER,
  start_date TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- Create arms_deals table
CREATE TABLE IF NOT EXISTS arms_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date TIMESTAMP NOT NULL,
  buyer_country TEXT NOT NULL,
  seller_country TEXT,
  seller_company TEXT,
  weapon_system TEXT NOT NULL,
  deal_value NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  source_link TEXT,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'pending', 'cancelled')) DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT now()
);

-- Create news table
CREATE TABLE IF NOT EXISTS news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline TEXT NOT NULL,
  source TEXT NOT NULL,
  region TEXT,
  date TIMESTAMP NOT NULL,
  url TEXT,
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
CREATE INDEX IF NOT EXISTS idx_conflicts_region ON conflicts(region);
CREATE INDEX IF NOT EXISTS idx_conflicts_updated_at ON conflicts(updated_at);

CREATE INDEX IF NOT EXISTS idx_arms_deals_buyer_country ON arms_deals(buyer_country);
CREATE INDEX IF NOT EXISTS idx_arms_deals_seller_country ON arms_deals(seller_country);
CREATE INDEX IF NOT EXISTS idx_arms_deals_date ON arms_deals(date);
CREATE INDEX IF NOT EXISTS idx_arms_deals_status ON arms_deals(status);

CREATE INDEX IF NOT EXISTS idx_news_source ON news(source);
CREATE INDEX IF NOT EXISTS idx_news_region ON news(region);
CREATE INDEX IF NOT EXISTS idx_news_date ON news(date);

-- Enable Row Level Security (RLS)
ALTER TABLE conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE arms_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Enable read access for all users" ON conflicts FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON arms_deals FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON news FOR SELECT USING (true);

-- Create policies for admin insert/update/delete (you can modify these based on your auth requirements)
CREATE POLICY "Enable insert for authenticated users" ON conflicts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON conflicts FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON conflicts FOR DELETE USING (true);

CREATE POLICY "Enable insert for authenticated users" ON arms_deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON arms_deals FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON arms_deals FOR DELETE USING (true);

CREATE POLICY "Enable insert for authenticated users" ON news FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON news FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON news FOR DELETE USING (true);