# Mercenary Phase 1 Setup Guide

A comprehensive guide to setting up and running the Mercenary real-time conflict monitoring application locally and deploying it to production.

## 📋 Prerequisites

Before you begin, make sure you have the following installed on your system:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download here](https://git-scm.com/)
- A **Supabase** account - [Sign up here](https://supabase.com/)
- A **Mapbox** account - [Sign up here](https://www.mapbox.com/)

## 🚀 Local Development Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd mercenary.ai-main

# Install dependencies
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory and add the following environment variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Mapbox Configuration  
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
```

#### How to get these values:

**Supabase:**
1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Create a new project or select an existing one
3. Go to Settings → API
4. Copy the Project URL and anon/public key

**Mapbox:**
1. Go to your [Mapbox Account](https://account.mapbox.com/)
2. Navigate to Access Tokens
3. Copy your default public token or create a new one

### 3. Database Setup

#### Option A: Run SQL Scripts Manually

1. Open your Supabase SQL Editor
2. Run the base setup script:

```sql
-- Copy and paste the contents of database/setup.sql
```

3. Run the Phase 1 conflict events script:

```sql
-- Copy and paste the contents of database/phase1-conflict-events.sql
```

#### Option B: Use Supabase CLI (Advanced)

```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Initialize Supabase in your project
supabase init

# Link to your project
supabase link --project-ref your-project-id

# Push database changes
supabase db push
```

### 4. Verify Database Setup

After running the SQL scripts, your Supabase database should have these tables:

- `conflicts` - Original conflict data
- `arms_deals` - Arms trade information  
- `news` - News articles
- `conflict_events` - **New Phase 1 table** for real-time events

You can verify this in your Supabase dashboard under the "Table Editor" section.

### 5. Start Development Server

```bash
npm run dev
```

Your application will be available at `http://localhost:3000`

## 🎯 Testing Phase 1 Features

### 1. Test Live Events Page

Navigate to `/events` to access the new Phase 1 dashboard. You should see:

- **Interactive Map**: Displays conflict events with color-coded markers
- **Filter Sidebar**: Allows filtering by country, region, event type, etc.
- **Live Event Feed**: Twitter-style scrollable feed of recent events
- **Real-time Updates**: Events update automatically via Supabase realtime

### 2. Test Filtering

Try these filtering scenarios:

**Country Filter:**
1. Open the filter sidebar
2. Select one or more countries
3. Verify map and feed update to show only events from selected countries

**Keyword Search:**
1. Enter keywords like "artillery" or "protest" in the search box
2. Verify events are filtered by summary and event type

**Escalation Range:**
1. Adjust the escalation score sliders
2. Verify only events within the range are displayed

**Event Type Filter:**
1. Select specific event types (e.g., "armed_clash", "air_strike")
2. Verify filtering works correctly

### 3. Test Mobile Responsiveness

- **Desktop (1024px+)**: Sidebar always visible, horizontal layout
- **Tablet (768px-1023px)**: Collapsible sidebar, mixed layout
- **Mobile (<768px)**: Full-screen sidebar overlay, vertical stacking

### 4. Test Real-time Features

To test real-time updates:

1. Open the Events page in two browser windows
2. In your Supabase dashboard, go to Table Editor → conflict_events
3. Add a new event manually or update an existing one
4. Both browser windows should update automatically

## 🔧 Troubleshooting

### Common Issues

**1. Map not loading:**
- Verify `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is correctly set
- Check browser console for errors
- Ensure token has proper permissions

**2. Events not loading:**
- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Verify database tables exist
- Check browser network tab for API errors

**3. Real-time not working:**
- Ensure Row Level Security (RLS) policies are set correctly
- Check if realtime is enabled for the conflict_events table
- Verify Supabase realtime subscription in browser console

**4. Build errors:**
- Run `npm run build` to check for TypeScript errors
- Ensure all dependencies are installed: `npm install`
- Check for missing environment variables

**5. Filter sidebar not responsive:**
- Clear browser cache
- Check for console errors
- Verify Tailwind CSS is loading properly

### Database Connection Issues

If you encounter database connection problems:

```bash
# Test connection
curl -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     "YOUR_SUPABASE_URL/rest/v1/conflict_events?select=*&limit=1"
```

### Performance Optimization

For better performance with large datasets:

1. **Enable database indexes** (already included in setup scripts)
2. **Adjust API limits** in `/api/conflict-events/route.ts`
3. **Implement pagination** for very large datasets
4. **Use Mapbox clustering** for dense marker areas

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. **Connect your repository:**
   ```bash
   # Install Vercel CLI
   npm install -g vercel
   
   # Deploy
   vercel
   ```

2. **Add environment variables in Vercel:**
   - Go to your Vercel project dashboard
   - Settings → Environment Variables
   - Add the same variables from your `.env.local`

3. **Configure domain (optional):**
   - Add custom domain in Vercel dashboard
   - Update any CORS settings in Supabase if needed

### Deploy to Netlify

1. **Build the project:**
   ```bash
   npm run build
   npm run export
   ```

2. **Deploy:**
   - Drag the `out` folder to Netlify
   - Or connect your Git repository
   - Add environment variables in Netlify dashboard

### Environment Variables for Production

Make sure these are set in your deployment platform:

```env
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_supabase_key
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

## 📊 Phase 1 Feature Checklist

Verify all Phase 1 features are working:

- ✅ **Country/Region Filtering**: Sidebar with location filters
- ✅ **Keyword Search**: Real-time search through event summaries
- ✅ **Live Event Feed**: Twitter-style scrollable feed
- ✅ **Escalation Visualization**: Color-coded markers and badges
- ✅ **Mobile Responsive**: Collapsible sidebar and mobile-optimized layout
- ✅ **Real-time Updates**: Supabase realtime subscriptions
- ✅ **Interactive Map**: Mapbox with clustering and popups
- ✅ **Filter Persistence**: URL-based filter state (optional enhancement)

## 🔗 Useful Links

- [Supabase Documentation](https://supabase.com/docs)
- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vercel Deployment Guide](https://vercel.com/docs)

## 📞 Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify all environment variables are set correctly
3. Test database connectivity using Supabase dashboard
4. Review the API responses in browser network tab
5. Check this guide's troubleshooting section

## 🔄 Next Steps (Future Phases)

Phase 1 provides the foundation for:

- **Phase 2**: Advanced analytics and reporting
- **Phase 3**: Machine learning-powered predictions
- **Phase 4**: Multi-user collaboration and admin features
- **Phase 5**: API access and third-party integrations

---

**Congratulations!** You've successfully set up Mercenary Phase 1. The application now provides real-time conflict monitoring with advanced filtering, interactive mapping, and mobile-responsive design.