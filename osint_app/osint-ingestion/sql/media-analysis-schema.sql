-- Media Analysis Extension Schema
-- Adds tables and columns to support BigSister integration for media analysis

-- 1. Media Assets table
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id),
  url TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'image', 'video', 'audio'
  file_hash VARCHAR(64), -- SHA256 hash for deduplication
  metadata JSONB DEFAULT '{}', -- All extracted metadata
  exif_data JSONB DEFAULT '{}', -- Specific EXIF metadata
  geolocation JSONB, -- {latitude, longitude, accuracy}
  timestamp_metadata JSONB, -- {created, modified, taken}
  anomalies JSONB DEFAULT '[]', -- Array of detected anomalies
  steganography_risk VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high'
  thumbnail_data TEXT, -- Base64 encoded thumbnail
  analysis_timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(file_hash)
);

CREATE INDEX idx_media_assets_article ON media_assets(article_id);
CREATE INDEX idx_media_assets_hash ON media_assets(file_hash);
CREATE INDEX idx_media_assets_geolocation ON media_assets USING GIN(geolocation);

-- 2. Media Analysis Results table
CREATE TABLE IF NOT EXISTS media_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id UUID REFERENCES media_assets(id),
  analysis_type VARCHAR(50) NOT NULL, -- 'metadata', 'steganography', 'reverse_search'
  tool_used VARCHAR(100), -- 'exiftool', 'steghide', 'binwalk', etc.
  results JSONB NOT NULL,
  confidence_score DECIMAL(3,2),
  processing_time_ms INTEGER,
  error_log TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analysis_results_asset ON media_analysis_results(media_asset_id);
CREATE INDEX idx_analysis_results_type ON media_analysis_results(analysis_type);

-- 3. Steganography Findings table
CREATE TABLE IF NOT EXISTS steganography_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id UUID REFERENCES media_assets(id),
  detection_tool VARCHAR(50) NOT NULL, -- 'steghide', 'binwalk', 'zsteg'
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high'
  finding_type VARCHAR(100), -- 'embedded_data', 'suspicious_pattern', etc.
  description TEXT,
  offset_location VARCHAR(50), -- For binwalk findings
  extracted_content BYTEA, -- Actual extracted data if any
  passphrase_hint TEXT, -- If passphrase was derived from metadata
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_steg_findings_asset ON steganography_findings(media_asset_id);
CREATE INDEX idx_steg_findings_severity ON steganography_findings(severity);

-- 4. Reverse Image Search Results
CREATE TABLE IF NOT EXISTS reverse_image_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id UUID REFERENCES media_assets(id),
  search_engine VARCHAR(50), -- 'google', 'tineye', 'bing'
  result_url TEXT,
  result_title TEXT,
  result_description TEXT,
  similarity_score DECIMAL(3,2),
  first_seen_date DATE,
  domain VARCHAR(255),
  is_original BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reverse_results_asset ON reverse_image_results(media_asset_id);
CREATE INDEX idx_reverse_results_domain ON reverse_image_results(domain);

-- 5. Media Anomalies table
CREATE TABLE IF NOT EXISTS media_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id UUID REFERENCES media_assets(id),
  anomaly_type VARCHAR(100) NOT NULL, -- 'timestamp_mismatch', 'metadata_tampering', etc.
  field_name VARCHAR(100),
  expected_value TEXT,
  actual_value TEXT,
  time_difference_seconds INTEGER, -- For timestamp anomalies
  severity VARCHAR(20) DEFAULT 'medium',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_anomalies_asset ON media_anomalies(media_asset_id);
CREATE INDEX idx_anomalies_type ON media_anomalies(anomaly_type);

-- 6. Add media analysis columns to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS has_media_analysis BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS media_analysis_summary JSONB DEFAULT '{}';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS media_geolocation_count INTEGER DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS media_anomaly_count INTEGER DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS media_steganography_alerts INTEGER DEFAULT 0;

-- 7. Create view for articles with suspicious media
CREATE OR REPLACE VIEW suspicious_media_articles AS
SELECT 
  a.id,
  a.headline,
  a.url,
  a.published_date,
  COUNT(DISTINCT ma.id) as total_media_assets,
  COUNT(DISTINCT CASE WHEN ma.steganography_risk IN ('medium', 'high') THEN ma.id END) as suspicious_media_count,
  COUNT(DISTINCT man.id) as total_anomalies,
  ARRAY_AGG(DISTINCT ma.steganography_risk) FILTER (WHERE ma.steganography_risk != 'low') as risk_levels
FROM articles a
JOIN media_assets ma ON ma.article_id = a.id
LEFT JOIN media_anomalies man ON man.media_asset_id = ma.id
WHERE ma.steganography_risk != 'low' OR man.id IS NOT NULL
GROUP BY a.id, a.headline, a.url, a.published_date
ORDER BY suspicious_media_count DESC, total_anomalies DESC;

-- 8. Function to calculate media trust score
CREATE OR REPLACE FUNCTION calculate_media_trust_score(p_article_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_trust_score DECIMAL := 1.0;
  v_media_count INTEGER;
  v_anomaly_count INTEGER;
  v_high_risk_count INTEGER;
  v_verified_count INTEGER;
BEGIN
  -- Get media statistics
  SELECT 
    COUNT(DISTINCT ma.id),
    COUNT(DISTINCT man.id),
    COUNT(DISTINCT CASE WHEN ma.steganography_risk = 'high' THEN ma.id END)
  INTO v_media_count, v_anomaly_count, v_high_risk_count
  FROM media_assets ma
  LEFT JOIN media_anomalies man ON man.media_asset_id = ma.id
  WHERE ma.article_id = p_article_id;
  
  -- Get verified media count (those with reverse image search results)
  SELECT COUNT(DISTINCT ma.id)
  INTO v_verified_count
  FROM media_assets ma
  JOIN reverse_image_results rir ON rir.media_asset_id = ma.id
  WHERE ma.article_id = p_article_id;
  
  -- Calculate trust score
  IF v_media_count > 0 THEN
    -- Deduct for anomalies (max 0.3 deduction)
    v_trust_score := v_trust_score - LEAST(0.3, (v_anomaly_count::DECIMAL / v_media_count) * 0.3);
    
    -- Deduct for high risk steganography (max 0.4 deduction)
    v_trust_score := v_trust_score - LEAST(0.4, (v_high_risk_count::DECIMAL / v_media_count) * 0.4);
    
    -- Add bonus for verified images (max 0.2 bonus)
    v_trust_score := v_trust_score + LEAST(0.2, (v_verified_count::DECIMAL / v_media_count) * 0.2);
  END IF;
  
  RETURN GREATEST(0, LEAST(1, v_trust_score));
END;
$$ LANGUAGE plpgsql;

-- 9. Indexes for performance
CREATE INDEX idx_media_assets_steganography ON media_assets(steganography_risk) WHERE steganography_risk != 'low';
CREATE INDEX idx_articles_media_analysis ON articles(has_media_analysis) WHERE has_media_analysis = true;