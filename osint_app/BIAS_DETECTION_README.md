# Argos AI - Media Bias Detection & News Corroboration System

## Overview

The Argos AI bias detection and news corroboration system provides comprehensive analysis of news articles to:

1. **Detect Media Bias**: Analyze political lean, sensationalism, and other forms of bias
2. **Verify Facts**: Cross-reference claims with multiple sources
3. **Support Multiple Languages**: Analyze content in various languages
4. **Provide Trust Scores**: Calculate overall reliability metrics

## Architecture

### Core Modules

1. **BiasDetector** (`src/lib/bias-detection/bias-detector.ts`)
   - Analyzes articles for various types of bias
   - Combines rule-based and LLM-based approaches
   - Returns bias scores from -5 (far left) to +5 (far right)

2. **FactChecker** (`src/lib/corroboration/fact-checker.ts`)
   - Extracts key claims from articles
   - Searches for corroborating evidence
   - Verifies claims across multiple sources
   - Provides geographic coverage analysis

3. **MultiLanguageAnalyzer** (`src/lib/translation/multi-language-analyzer.ts`)
   - Detects article language
   - Translates content for analysis
   - Supports cross-lingual fact-checking

4. **AnalysisPipeline** (`src/lib/analysis-pipeline.ts`)
   - Orchestrates bias detection and fact-checking
   - Calculates overall trust scores
   - Stores results in database

### API Endpoints

- `POST /api/analysis/bias` - Analyze a single article
- `GET /api/analysis/bias?url=<article_url>` - Get existing analysis
- `POST /api/analysis/batch` - Analyze multiple articles from database
- `GET /api/cron/analyze-news` - Automated analysis (cron job)

### Frontend Components

- **BiasMeter** - Visual bias indicator with detailed breakdown
- **VerificationBadge** - Shows fact-check status and evidence
- **CompactBiasIndicator** - Inline bias/verification display for news cards
- **AnalysisPanel** - Detailed analysis view with claims breakdown

## Database Schema

```sql
-- Bias analysis storage
CREATE TABLE bias_analyses (
  id UUID PRIMARY KEY,
  article_url TEXT UNIQUE,
  overall_bias NUMERIC,
  bias_category TEXT,
  confidence NUMERIC,
  analysis JSONB,
  created_at TIMESTAMP
);

-- Fact-check results
CREATE TABLE fact_check_results (
  id UUID PRIMARY KEY,
  article_url TEXT UNIQUE,
  overall_verification TEXT,
  verification_score NUMERIC,
  claims JSONB,
  corroborating_sources JSONB,
  created_at TIMESTAMP
);
```

## Configuration

### Required Environment Variables

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o  # or gpt-4

# Google Search Configuration
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# Cron Job Security (optional)
CRON_SECRET=your_cron_secret
```

## Usage

### Analyzing Articles Programmatically

```javascript
import { AnalysisPipeline } from '@/lib/analysis-pipeline';

const pipeline = new AnalysisPipeline({
  openaiApiKey: process.env.OPENAI_API_KEY,
  googleApiKey: process.env.GOOGLE_API_KEY,
  googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY
});

const result = await pipeline.analyzeArticle({
  title: "Article Title",
  content: "Article content...",
  source: "News Source",
  url: "https://example.com/article"
});

console.log('Bias Score:', result.biasAnalysis.overallBias);
console.log('Verification:', result.factCheckResult.overallVerification);
console.log('Trust Score:', result.overallTrustScore);
```

### Frontend Integration

The bias and verification indicators are automatically displayed in the Intelligence Center for analyzed articles:

1. News cards show compact bias/verification badges
2. Clicking on an article can reveal detailed analysis
3. Analysis is fetched on-demand or pre-computed via cron jobs

## Bias Detection Methodology

### Types of Bias Detected

1. **Political Bias**: Left/right political lean based on language patterns
2. **Sensationalism**: Exaggerated or shocking language
3. **Emotional Manipulation**: Appeals to fear, anger, etc.
4. **Source Imbalance**: Lack of diverse perspectives
5. **Fact Selection**: Cherry-picking facts to support a narrative

### Scoring System

- **Bias Score**: -5 (far left) to +5 (far right)
  - -5 to -4: Far Left
  - -4 to -2: Left
  - -2 to -0.5: Lean Left
  - -0.5 to +0.5: Center
  - +0.5 to +2: Lean Right
  - +2 to +4: Right
  - +4 to +5: Far Right

### Confidence Levels

- Combines rule-based and LLM analysis
- Higher confidence when methods agree
- Cached results for performance

## Fact-Checking Process

1. **Claim Extraction**: Identifies verifiable claims (who, what, when, where)
2. **Evidence Search**: Queries multiple sources for each claim
3. **Evidence Analysis**: Compares claims with found evidence
4. **Status Assignment**:
   - **Verified**: Multiple credible sources confirm
   - **Partially Verified**: Some evidence supports, some unclear
   - **Disputed**: Conflicting reports from sources
   - **Unverified**: Insufficient evidence found

## Multi-Language Support

### Supported Languages

- Primary analysis in English
- Auto-detection for 20+ languages
- Translation for non-English content
- Cross-lingual fact-checking

### Language-Specific Features

- Cultural bias indicators
- Regional source credibility
- Multilingual evidence search

## Testing

### Run Test Script

```bash
node scripts/test-bias-analysis.js
```

This tests:
- Bias detection on sample articles
- Fact-checking functionality
- Batch processing
- API endpoints

### Manual Testing

1. Navigate to Intelligence Center
2. View news articles with analysis badges
3. Click articles to see detailed analysis
4. Check cron job logs for automated analysis

## Performance Considerations

### Caching

- Analysis results cached in database
- 7-day cache validity
- Avoids redundant API calls

### Rate Limiting

- OpenAI API: ~3 requests/second
- Google Search API: 100 queries/day (free tier)
- Batch processing with delays

### Optimization Tips

1. Use batch analysis for multiple articles
2. Enable caching for repeated URLs
3. Schedule cron jobs during off-peak hours
4. Monitor API usage and costs

## Troubleshooting

### Common Issues

1. **No analysis shown**: Check if article has `source_url` field
2. **Slow analysis**: Normal for first-time analysis (30-60s)
3. **API errors**: Verify environment variables and API limits
4. **Missing languages**: Ensure translation is enabled

### Debug Mode

Set verbose logging in analysis pipeline:

```javascript
const pipeline = new AnalysisPipeline({
  // ... config
  verbose: true
});
```

## Future Enhancements

1. **Visual Bias Detection**: Analyze images/videos for bias
2. **Real-time Alerts**: Notify when stories have conflicting coverage  
3. **Bias Trends**: Track bias patterns over time
4. **User Feedback**: Incorporate user corrections
5. **Advanced Framing Analysis**: Detect subtle framing techniques

## Security Considerations

- API keys stored securely in environment variables
- Service role required for database writes
- Public read access for analysis results
- Rate limiting prevents abuse

## Credits

This system implements research from:
- Political bias detection using transformer models
- Cross-lingual fake news detection techniques
- Source credibility assessment methods
- Multi-aspect bias classification approaches