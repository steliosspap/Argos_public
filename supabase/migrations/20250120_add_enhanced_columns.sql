-- Add enhanced ingestion columns to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS discovery_round INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS source_reliability DECIMAL(3,2) DEFAULT 0.60;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_discovery_round ON public.events(discovery_round);
CREATE INDEX IF NOT EXISTS idx_events_source_reliability ON public.events(source_reliability DESC);

-- Add comment
COMMENT ON COLUMN public.events.discovery_round IS 'Which round of search discovered this event (1=broad, 2=targeted)';
COMMENT ON COLUMN public.events.source_reliability IS 'Reliability score of the source (0-1)';

-- Update existing events to have default values
UPDATE public.events 
SET discovery_round = 1,
    source_reliability = 0.60
WHERE discovery_round IS NULL;