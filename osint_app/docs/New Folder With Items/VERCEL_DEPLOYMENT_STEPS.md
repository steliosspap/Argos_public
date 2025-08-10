# 🚀 VERCEL DEPLOYMENT - NEWS INGESTION SETUP

## Current Status
Your site is deployed at: https://osint-app-jet.vercel.app/

The platform is working, but the news ingestion pipeline needs to be activated.

## 📋 Steps to Enable News Ingestion

### Step 1: Deploy the Updated Code

```bash
# Commit the changes
git add .
git commit -m "Add serverless ingestion endpoint for Vercel"

# Push to trigger auto-deployment
git push
```

### Step 2: Set Environment Variables in Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `osint-app` project
3. Go to Settings → Environment Variables
4. Add these if not already set:
   - `CRON_SECRET` = (generate a random string for security)
   - All other variables from `.env.local` should already be there

### Step 3: Enable Vercel Cron Jobs (Automatic Ingestion)

The cron job is already configured in `vercel.json` to run every hour. After deployment, it will automatically start.

To verify:
1. Go to your Vercel project dashboard
2. Navigate to Functions → Cron Jobs
3. You should see `/api/ingest` scheduled to run hourly

### Step 4: Manual Ingestion (Immediate Testing)

After deployment, you have two ways to trigger ingestion manually:

#### Option A: Use the Ingestion Button (Easy)
1. Go to https://osint-app-jet.vercel.app/intelligence-center
2. Look for the "Run Ingestion" button in the bottom right
3. Click it to manually trigger news ingestion
4. Watch for the success/failure message

#### Option B: Direct API Call
```bash
# Trigger ingestion manually
curl -X POST https://osint-app-jet.vercel.app/api/ingest

# Or with authorization
curl -X POST https://osint-app-jet.vercel.app/api/ingest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 🔍 Monitoring Ingestion

### Check Vercel Function Logs
1. Go to Vercel Dashboard → Functions
2. Click on `/api/ingest`
3. View logs to see ingestion results

### Expected Results
- Each run should process ~50-200 articles
- Extract 5-20 relevant events
- Add them to your database
- New events appear on the map immediately

## 📊 What's Happening

The serverless ingestion endpoint (`/api/ingest`) will:
1. Fetch RSS feeds from 5 major news sources
2. Use OpenAI to extract conflict/security events
3. Check for duplicates using content hashing
4. Insert new events into your Supabase database
5. Events immediately appear on your live map

## 🚨 Troubleshooting

**No new events appearing?**
- Check Vercel function logs for errors
- Verify OpenAI API key is set correctly
- Ensure Supabase credentials are correct

**Rate limits?**
- The endpoint is limited to 60 seconds execution
- Processes up to 50 articles per run
- Runs hourly to avoid API limits

**Manual trigger not working?**
- Make sure you're logged in to the Intelligence Center
- Check browser console for errors
- Try the direct API call method

## ✅ Success Indicators

You'll know it's working when:
1. New events appear on the map after clicking "Run Ingestion"
2. Vercel logs show successful function executions
3. The event count increases in the Intelligence Center
4. Fresh news-based events appear with recent timestamps

## 🎯 Next Steps

Once ingestion is working:
1. Monitor the hourly cron job performance
2. Adjust RSS sources in `/app/api/ingest/route.ts` if needed
3. Consider adding more news sources
4. Set up error alerting via Vercel integrations

The system is designed to continuously feed your platform with fresh intelligence data!