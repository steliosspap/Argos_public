# ⚡ Quick Deploy Summary - mercenaryai.org

## 🎯 Action Items for You

### 1. Deploy to Vercel (10 minutes)
```bash
# 1. Go to vercel.com and import your GitHub repo
# 2. Add these environment variables in Vercel dashboard:

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here

# 3. Deploy and get temporary URL (e.g., mercenary-abc123.vercel.app)
# 4. Test the temporary URL works
```

### 2. Configure Domain in Vercel (2 minutes)
```bash
# In Vercel dashboard → Domains:
# Add: mercenaryai.org
# Add: www.mercenaryai.org

# Vercel will show DNS records like:
Type: A
Name: @  
Value: 76.76.19.61

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 3. Update DNS in Namecheap (5 minutes)
```bash
# 1. Login to namecheap.com
# 2. Domain List → Manage mercenaryai.org → Advanced DNS
# 3. Delete existing A/CNAME records for @ and www
# 4. Add the EXACT records Vercel showed you
# 5. Save changes
```

### 4. Wait & Test (30-60 minutes)
```bash
# DNS propagation takes time
# Test when ready:
https://mercenaryai.org
https://www.mercenaryai.org (should redirect)

# Verify:
✅ Green SSL lock
✅ Map loads with data
✅ All pages work
✅ Forms submit successfully
```

## 🔧 Files Added for Deployment

- `vercel.json` - Deployment configuration
- `next.config.js` - Updated with security headers
- `.env.production.example` - Production environment template
- `scripts/validate-production.js` - Post-deploy validation
- `DEPLOYMENT_GUIDE.md` - Complete step-by-step guide

## 🧪 Test After Deployment

```bash
# Run validation (after deployment)
npm run validate-production

# Manual checks:
□ Homepage map shows conflicts
□ News page displays articles  
□ Analytics charts load
□ Signup form works
□ Admin panel requires password
□ Mobile responsive
```

## 🚀 Expected Result

**Live site**: https://mercenaryai.org
- Real-time conflict map
- Live news intelligence
- Analytics dashboard
- Beta signup forms
- Admin access control

**Time to deploy**: ~1 hour total (mostly waiting for DNS)

---

Need the detailed guide? See `DEPLOYMENT_GUIDE.md` for complete instructions.