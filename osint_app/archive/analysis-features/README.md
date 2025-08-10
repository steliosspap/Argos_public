# Analysis Features Archive

This directory contains archived analysis features that were removed from the main build but preserved for future use.

## Archived Components

### API Routes
- **batch-route.ts**: Batch analysis endpoint for processing multiple articles
- **bias-route.ts**: Individual article bias and fact-checking analysis
- **analyze-news-route.ts**: Cron job for automated news analysis

### Hooks
- **useNewsAnalysis.ts**: React hook for fetching and triggering article analysis

## Dependencies Required

These features depend on:
- `@/lib/analysis-pipeline` module (not included)
- OpenAI API for bias analysis
- Google API for fact-checking
- Supabase for storing analysis results

## Database Schema

The features expect these tables:
- `news_analysis`: Stores analysis results
- `news` table with `has_analysis` boolean column

## Environment Variables

Required environment variables:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: gpt-4o)
- `GOOGLE_API_KEY`
- `GOOGLE_SEARCH_ENGINE_ID`
- `CRON_SECRET` (optional, for cron authentication)

## Restoration Instructions

To restore these features:
1. Create the `analysis-pipeline` module in `src/lib/`
2. Move the archived files back to their original locations
3. Ensure all environment variables are set
4. Create necessary database tables
5. Update any imports in other components that use the analysis features