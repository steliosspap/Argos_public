# Argos Database Schema Documentation

This document contains the complete schema of the Argos Supabase PostgreSQL database. This is the single source of truth for all database operations.

## Key Tables for Conflict Monitoring

### 1. `conflicts` Table
The main table for tracking conflicts with escalation scores:

```sql
public.conflicts
- id                        uuid (PK)
- name                      text
- country                   text  
- region                    text
- latitude                  double precision
- longitude                 double precision
- conflict_type             text
- status                    text
- description               text
- casualties                integer
- start_date                timestamp without time zone
- updated_at                timestamp without time zone
- created_at                timestamp without time zone
- escalation_score          integer
- source_article_id         uuid
- headline_hash             character varying
- sync_source               character varying (default: 'manual')
- auto_generated            boolean (default: false)
- last_news_update          timestamp with time zone
- conflict_hash             character varying
- confidence_score          numeric (default: 0.0)
- previous_escalation_score  numeric
- escalation_event_ids      text[]
- escalation_last_calculated timestamp with time zone
```

### 2. `events` Table
Stores individual events with location and severity data:

```sql
public.events
- id                   uuid (PK)
- title                text
- summary              text
- location             geometry(POINT)
- country              text
- region               text
- timestamp            timestamp with time zone
- channel              text
- reliability          integer
- event_classifier     text[]
- severity             text
- source_url           text
- created_at           timestamp with time zone
- updated_at           timestamp with time zone
- latitude             numeric
- longitude            numeric
- escalation_score     smallint (default: 1)
- content_hash         character varying
- city                 character varying
- timestamp_date       date
- version              integer (default: 1)
- last_modified        timestamp with time zone
```

### 3. `news` Table
Raw news articles that feed into the system:

```sql
public.news
- id                    integer (PK)
- title                 character varying
- summary               text
- url                   character varying
- published_at          timestamp with time zone
- source                character varying
- source_type           character varying
- country               character varying
- region                character varying
- latitude              numeric
- longitude             numeric
- location_confidence   numeric
- content_type          character varying
- tags                  text[]
- priority              character varying
- confidence_score      numeric
- relevance_score       numeric
- escalation_score      numeric
- content_hash          character varying
- raw_content           text
- author                character varying
- category              character varying
- guid                  character varying
- language              character varying
- processed_at          timestamp with time zone
- fetched_at            timestamp with time zone
- created_at            timestamp with time zone
- updated_at            timestamp with time zone
- date                  timestamp without time zone
- content               text
- ai_summary            text
- primary_source        text
- source_count          integer (default: 1)
- is_multi_source       boolean (default: false)
```

### 4. `conflict_events` Table
Detailed conflict event tracking:

```sql
public.conflict_events
- id                      integer (PK)
- title                   character varying
- description             text
- url                     character varying
- event_date              timestamp with time zone
- source                  character varying
- source_type             character varying
- country                 character varying
- region                  character varying
- latitude                numeric
- longitude               numeric
- location_confidence     numeric
- event_type              character varying
- severity_level          character varying
- escalation_level        integer
- casualties_reported     integer (default: 0)
- casualties_killed       integer (default: 0)
- casualties_wounded      integer (default: 0)
- participants            text[]
- tags                    text[]
- confidence_score        numeric
- verification_status     character varying
- content_hash            character varying
- raw_content             text
- external_id             character varying
- language                character varying
- escalation_factors      text[]
- processed_at            timestamp with time zone
- fetched_at              timestamp with time zone
- created_at              timestamp with time zone
- updated_at              timestamp with time zone
- timestamp               timestamp without time zone
- summary                 text
- reliability             integer (default: 5)
```

### 5. Supporting Tables

- `conflict_sync_log` - Logs sync operations
- `analytics_events` - Tracks user analytics
- `user_preferences` - User settings
- `news_sources` - Multi-source news tracking
- `event_versions` - Event version history

## Important Notes

1. **No `conflict_zones` table exists** - The system uses the `conflicts` table
2. **Escalation scores** are stored as `integer` in the `conflicts` table
3. **Events** use `smallint` for escalation_score (1-10 range)
4. **Location data** is stored as both:
   - `geometry(POINT)` in PostGIS format for the `location` column
   - Separate `latitude` and `longitude` numeric columns
5. **Multi-source support** exists through `news_sources` table and flags in `news` table

## Key Relationships

- `conflicts.source_article_id` → `news.id`
- `news_sources.news_id` → `news.id`
- `event_versions.event_id` → `events.id`

## Active Conflicts View

There's a view `active_conflicts` that filters the conflicts table:
```sql
public.active_conflicts (VIEW)
- Shows only conflicts where status = 'active'
- Includes all columns from conflicts table
```