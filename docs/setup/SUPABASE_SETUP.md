# 🏦 Supabase Migration Setup Guide

This guide will walk you through setting up the Supabase PostgreSQL database for the Mercenary app.

## ✅ **What's Already Done**
- ✅ Supabase client installed
- ✅ API routes updated to use Supabase
- ✅ Database schema SQL scripts created
- ✅ Data seeding scripts prepared
- ✅ Type definitions created

## 🚀 **Steps to Complete**

### 1. Create Supabase Account & Project (5 minutes)
1. Go to https://supabase.com
2. Click "Start your project" 
3. Sign up with GitHub/Google or create account
4. Click "New project"
5. Choose your organization
6. Fill in:
   - **Project name**: `mercenary-app`
   - **Database password**: Generate strong password (save it!)
   - **Region**: Choose closest to you
7. Click "Create new project"
8. Wait ~2 minutes for setup to complete

### 2. Get Your Credentials (2 minutes)
1. In your Supabase dashboard, go to **Settings > API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Project API keys > anon public**: `your_anon_key_here`

### 3. Configure Environment Variables (1 minute)
1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
2. Edit `.env.local` and replace with your values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
   ```

### 4. Create Database Tables (3 minutes)
1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy and paste the contents of `database/setup.sql`
4. Click "Run" to create all tables and indexes
5. Verify tables were created in **Table Editor**

### 5. Seed Initial Data (2 minutes)
1. In **SQL Editor**, create another new query
2. Copy and paste the contents of `database/seed.sql`
3. Click "Run" to insert all real-world data
4. Verify data in **Table Editor** > View each table

### 6. Test the Application (2 minutes)
1. Restart your development server:
   ```bash
   npm run dev
   ```
2. Open http://localhost:3000
3. Verify the map shows real conflicts
4. Check arms deals page has real data
5. Verify news feed displays current headlines

### 7. Test Admin Panel (3 minutes)
1. Go to http://localhost:3000/admin
2. Login with password: `admin123`
3. Try adding a new conflict/arms deal/news item
4. Refresh the page to confirm it persists
5. Check the main pages to see your new data

## 🔧 **Database Schema Overview**

### Tables Created:
- **conflicts**: 8 real global conflicts with geographic data
- **arms_deals**: 12 major defense contracts from 2024
- **news**: 10 current military/conflict headlines

### Key Features:
- ✅ UUID primary keys
- ✅ Proper indexes for performance
- ✅ Row Level Security (RLS) enabled
- ✅ Public read access
- ✅ Admin write access

## 🎯 **Success Criteria**
After completing these steps, you should have:
- ✅ Live database with real conflict data
- ✅ Persistent admin panel changes
- ✅ Interactive map with 8 real conflicts
- ✅ Arms deals table with $500B+ in tracked deals
- ✅ Current news headlines from credible sources

## 🐛 **Troubleshooting**

### Error: "Invalid API Key"
- Double-check your `.env.local` file
- Ensure no extra spaces in environment variables
- Restart development server after changes

### Error: "RLS Policy Violation"
- Make sure you ran the complete `setup.sql` script
- Check RLS policies were created in Supabase dashboard

### No Data Showing
- Verify `seed.sql` script ran successfully
- Check browser console for API errors
- Confirm tables have data in Supabase Table Editor

## 📞 **Support**
If you encounter issues:
1. Check browser developer console for errors
2. Check Supabase logs in dashboard
3. Verify all environment variables are correct
4. Ensure both SQL scripts executed successfully

---

**⏱️ Total Setup Time: ~15 minutes**
**🎉 Result: Production-ready database with live data persistence!**