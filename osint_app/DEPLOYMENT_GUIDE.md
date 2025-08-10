# 🚀 ARGOS DEPLOYMENT GUIDE

## ✅ Build Status: SUCCESSFUL

The platform now builds successfully and is ready for deployment!

## 📋 Manual Deployment Steps

### Option 1: Deploy to Vercel (Recommended - Easiest)

1. **Install Vercel CLI** (if not already installed):
```bash
npm i -g vercel
```

2. **Deploy to Vercel**:
```bash
vercel --prod
```

3. **Follow the prompts**:
   - Link to existing project or create new
   - Select the `osint_app` directory
   - Use default settings
   - Vercel will automatically detect Next.js

4. **Set Environment Variables** in Vercel Dashboard:
   - Go to your project settings
   - Navigate to Environment Variables
   - Add all variables from `.env.local`

### Option 2: Deploy to Netlify

1. **Build the project**:
```bash
npm run build
```

2. **Install Netlify CLI**:
```bash
npm i -g netlify-cli
```

3. **Deploy**:
```bash
netlify deploy --prod --dir=.next
```

### Option 3: Deploy to Custom VPS

1. **Build the project**:
```bash
npm run build
```

2. **Install PM2** (process manager):
```bash
npm install -g pm2
```

3. **Start the production server**:
```bash
pm2 start npm --name "argos" -- start
```

4. **Set up Nginx** as reverse proxy:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔐 Environment Variables

Make sure these are set in your deployment platform:

```env
# From .env.local
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_KEY=your_service_key
OPENAI_API_KEY=your_api_key
```

## 🚀 Start Mass Data Ingestion

After deployment, SSH into your server or use a cron job service to start the continuous ingestion:

### Local/VPS Deployment:
```bash
# Start continuous ingestion (every hour)
nohup node scripts/continuous-ingestion.js start > ingestion.log 2>&1 &

# Or use PM2
pm2 start scripts/continuous-ingestion.js --name "argos-ingestion"
```

### For Vercel/Netlify:
Use a separate service like:
- **GitHub Actions** (create workflow)
- **Render** (background worker)
- **Railway** (worker dyno)
- **Heroku** (worker process)

Example GitHub Action for hourly ingestion:
```yaml
name: Hourly News Ingestion
on:
  schedule:
    - cron: '0 * * * *'  # Every hour
jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: node scripts/mass-fetcher.js
      - run: node scripts/ingest-news.js --batch-file data/rss-ingestion/*.json
    env:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

## 📊 Post-Deployment Checklist

- [ ] Verify the site is accessible
- [ ] Test login/signup functionality
- [ ] Check map is loading with events
- [ ] Verify Intelligence Center shows data
- [ ] Start continuous ingestion
- [ ] Monitor first ingestion cycle
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure custom domain
- [ ] Enable SSL certificate

## 🎉 Deployment Complete!

Your Argos Intelligence Platform is now live and ready to continuously ingest global intelligence data!

## 🆘 Troubleshooting

**Build warnings about viewport/themeColor**: These are Next.js 14 deprecation warnings and can be safely ignored.

**Environment variables not working**: Double-check they're added to your deployment platform's environment settings.

**Maps not loading**: Verify NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is set correctly.

**No events showing**: Run the ingestion pipeline manually first to populate initial data.