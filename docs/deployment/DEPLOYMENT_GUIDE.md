# 🚀 Mercenary Deployment Guide - mercenaryai.org

Complete step-by-step guide to deploy your Mercenary app to production on `mercenaryai.org`.

---

## 📋 Pre-Deployment Checklist

### ✅ Required Items
- [ ] Namecheap domain `mercenaryai.org` registered
- [ ] Supabase project with production database
- [ ] Mapbox account with production token
- [ ] Vercel account (free tier works)
- [ ] GitHub repository with latest code

---

## 🛠️ Step 1: Prepare Production Environment

### 1.1 Verify Build Success
```bash
# Test production build locally
npm run build
npm start

# Visit http://localhost:3000 to verify everything works
```

### 1.2 Environment Variables Ready
You'll need these values for Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- `OPENAI_API_KEY` (optional, for news summarization)

---

## 🚀 Step 2: Deploy to Vercel

### 2.1 Connect GitHub Repository
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"New Project"**
3. **Import** your Mercenary repository from GitHub
4. Select the repository and click **"Import"**

### 2.2 Configure Project Settings
```
Project Name: mercenary
Framework Preset: Next.js
Root Directory: ./
Build Command: npm run build
Output Directory: .next
Install Command: npm ci
```

### 2.3 Add Environment Variables
In Vercel dashboard → Project → Settings → Environment Variables:

```bash
# Production Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiI...

# Optional (if you have them configured)
OPENAI_API_KEY=sk-...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

**Important**: Set Environment for **"Production"**, **"Preview"**, and **"Development"**

### 2.4 Deploy
1. Click **"Deploy"** 
2. Wait 2-3 minutes for build to complete
3. You'll get a temporary URL like: `https://mercenary-abc123.vercel.app`
4. Test this URL to ensure everything works

---

## 🌐 Step 3: Configure Custom Domain

### 3.1 Add Domain in Vercel
1. In Vercel dashboard → Project → Settings → **Domains**
2. Click **"Add"**
3. Enter: `mercenaryai.org`
4. Click **"Add"**
5. Also add: `www.mercenaryai.org` (will auto-redirect to main domain)

### 3.2 Vercel Will Show Required DNS Records
You'll see something like:
```
Type: A
Name: @
Value: 76.76.19.61

Type: CNAME  
Name: www
Value: cname.vercel-dns.com
```

**Note**: Your IP addresses will be different. Copy the exact values Vercel shows you.

---

## 🔧 Step 4: Configure DNS in Namecheap

### 4.1 Access Namecheap DNS Management
1. Login to [namecheap.com](https://namecheap.com)
2. Go to **Domain List**
3. Click **"Manage"** next to `mercenaryai.org`
4. Go to **Advanced DNS** tab

### 4.2 Add DNS Records
Delete any existing A or CNAME records for `@` and `www`, then add:

```
Type: A Record
Host: @
Value: [IP address from Vercel]
TTL: Automatic (or 300)

Type: CNAME Record  
Host: www
Value: cname.vercel-dns.com
TTL: Automatic (or 300)
```

### 4.3 Optional: Add Security Records
```
Type: TXT Record
Host: @
Value: v=spf1 include:_spf.google.com ~all
TTL: Automatic

Type: CNAME Record
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@mercenaryai.org
TTL: Automatic
```

### 4.4 Save Changes
- Click **"Save All Changes"**
- DNS propagation takes 5-60 minutes

---

## ⏱️ Step 5: Wait and Verify

### 5.1 Check DNS Propagation
```bash
# Check if DNS is working (wait 5-60 minutes)
nslookup mercenaryai.org
dig mercenaryai.org

# Should show Vercel's IP address
```

### 5.2 Test Domain
- Visit `https://mercenaryai.org` (may take up to 1 hour)
- Verify SSL certificate is working (green lock icon)
- Test `https://www.mercenaryai.org` redirects to main domain

---

## 🧪 Step 6: Production Testing

### 6.1 Test All Pages
- [ ] **Homepage** (`/`): Map loads with real conflict data
- [ ] **News** (`/news`): Articles display with escalation scores  
- [ ] **Analytics** (`/analytics`): Charts and data load correctly
- [ ] **Arms Deals** (`/arms-deals`): Table displays transaction data
- [ ] **Signup** (`/signup`): Form submits to Supabase
- [ ] **Feedback** (`/feedback`): Form submits successfully
- [ ] **Admin** (`/admin`): Password protection works

### 6.2 Test Database Connectivity
```bash
# Check browser console on homepage
# Should see: "Successfully loaded X conflicts from Supabase"
# No CORS errors or 500 status codes
```

### 6.3 Test Real-Time Features
- [ ] Map markers appear with correct colors
- [ ] Escalation scores display properly
- [ ] "Refresh Now" button works
- [ ] Auto-refresh indicator shows
- [ ] Tooltips display conflict details

### 6.4 Test Forms
- [ ] Beta signup form submits without errors
- [ ] Feedback form sends data to database
- [ ] Admin login works with correct password

---

## 🔒 Step 7: Security & Performance

### 7.1 Verify HTTPS
- All pages should show green lock icon
- Mixed content warnings should not appear
- HTTP requests should auto-redirect to HTTPS

### 7.2 Test Performance
```bash
# Check Core Web Vitals
Google PageSpeed Insights: https://pagespeed.web.dev/
Enter: https://mercenaryai.org

# Target scores:
- Performance: >90
- Accessibility: >95
- Best Practices: >95
- SEO: >90
```

### 7.3 Test on Mobile
- [ ] Responsive design works on mobile
- [ ] Map is touch-friendly
- [ ] Forms work on mobile browsers
- [ ] Navigation menu functions properly

---

## 🐛 Troubleshooting

### DNS Not Working?
```bash
# Check current DNS
nslookup mercenaryai.org

# If still showing old records:
1. Wait longer (up to 24 hours)
2. Clear browser cache
3. Try incognito/private browsing
4. Test from different device/network
```

### Vercel Build Failing?
```bash
# Check build logs in Vercel dashboard
# Common fixes:
1. Verify all environment variables are set
2. Check for TypeScript errors
3. Ensure package.json scripts are correct
4. Test build locally: npm run build
```

### Supabase Connection Issues?
```bash
# Check browser console for errors
# Verify in Vercel dashboard:
1. Environment variables are correct
2. Supabase URL includes https://
3. Anon key is complete and untruncated
4. Test connection in Supabase dashboard
```

### 500 Internal Server Error?
```bash
# Check Vercel function logs
# In Vercel dashboard → Functions → View logs
# Common causes:
1. Missing environment variables
2. Database connection issues
3. API route errors
4. Supabase RLS policy blocks
```

---

## ✅ Post-Deployment Checklist

### Production Validation
- [ ] `https://mercenaryai.org` loads successfully
- [ ] SSL certificate is valid and secure
- [ ] `www.mercenaryai.org` redirects to main domain
- [ ] All pages load without errors
- [ ] Real-time map displays conflict data
- [ ] News articles show with summaries and scores
- [ ] Analytics dashboard loads with charts
- [ ] Forms submit to Supabase successfully
- [ ] Admin panel requires password
- [ ] Mobile responsiveness works
- [ ] Performance scores are good (>80)

### Monitoring Setup
- [ ] Set up Vercel analytics (optional)
- [ ] Configure Supabase monitoring
- [ ] Test conflict sync scripts work in production
- [ ] Verify automated news ingestion pipeline

---

## 🚀 Success!

Your Mercenary app should now be live at:
- **Primary**: https://mercenaryai.org
- **Redirect**: https://www.mercenaryai.org → https://mercenaryai.org

### Next Steps
1. **Monitor Performance**: Check Vercel analytics and Supabase usage
2. **Set Up Monitoring**: Configure alerts for downtime
3. **Analytics**: Set up Google Analytics if desired
4. **Backup**: Ensure database backups are configured
5. **Updates**: Set up automated deployment on git push

---

## 📞 Support

If you encounter issues:

1. **Vercel Issues**: Check [Vercel Documentation](https://vercel.com/docs)
2. **DNS Issues**: Contact Namecheap support
3. **Supabase Issues**: Check [Supabase Status](https://status.supabase.com)
4. **Build Errors**: Review Vercel build logs in dashboard

**🎉 Congratulations! Your global conflict intelligence platform is now live at mercenaryai.org!**