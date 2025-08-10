-- Create search_queries table for audit tracking

CREATE TABLE IF NOT EXISTS search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  query_type VARCHAR(50), -- 'broad', 'targeted', 'llm_generated'
  subject VARCHAR(255),
  modifier VARCHAR(255),
  round_number INTEGER,
  results_count INTEGER DEFAULT 0,
  relevant_count INTEGER DEFAULT 0,
  articles_collected INTEGER DEFAULT 0,
  events_extracted INTEGER DEFAULT 0,
  executed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_search_queries_type ON search_queries(query_type);
CREATE INDEX idx_search_queries_executed ON search_queries(executed_at);
CREATE INDEX idx_search_queries_subject ON search_queries(subject);