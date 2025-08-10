-- Update events table to make location nullable and add lat/lng columns as alternative
-- This allows for easier data insertion without PostGIS functions

-- Make location nullable
ALTER TABLE events ALTER COLUMN location DROP NOT NULL;

-- Add latitude and longitude columns as an alternative
ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Create indexes on lat/lng for performance
CREATE INDEX IF NOT EXISTS idx_events_latitude ON events(latitude);
CREATE INDEX IF NOT EXISTS idx_events_longitude ON events(longitude);

-- Update the view to include lat/lng columns
CREATE OR REPLACE VIEW events_with_coords AS
SELECT 
    id,
    title,
    summary,
    COALESCE(ST_Y(location::geometry), latitude) as latitude,
    COALESCE(ST_X(location::geometry), longitude) as longitude,
    country,
    region,
    timestamp,
    channel,
    reliability,
    event_classifier,
    severity,
    source_url,
    created_at,
    updated_at
FROM events;

-- Add a trigger to populate location from lat/lng if provided
CREATE OR REPLACE FUNCTION update_location_from_coords()
RETURNS TRIGGER AS $$
BEGIN
    -- If lat/lng are provided but location is not, create location
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL AND NEW.location IS NULL THEN
        NEW.location = ST_GeogFromText('POINT(' || NEW.longitude || ' ' || NEW.latitude || ')');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_location_trigger
BEFORE INSERT OR UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION update_location_from_coords();