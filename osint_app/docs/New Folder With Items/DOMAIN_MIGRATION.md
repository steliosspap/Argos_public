# Domain Migration to argosintel.org

## ✅ Completed Updates

### 1. **Environment Variables**
- ✅ Updated `ALERT_EMAIL` in `.env` from `stelios@mercenaryai.org` to `stelios@argosintel.org`

### 2. **Logo References**
- ✅ Updated `/public/manifest.json` - replaced all `mercenary-logo.png` references with `argos-logo.png`
- ✅ Updated `/public/sw.js` - replaced `mercenary-logo.png` with `argos-logo.png`
- ✅ Renamed logo file from `mercenary-logo.png` to `argos-logo.png`

### 3. **Domain Configuration**
- ✅ Updated `scripts/validate-production.js` - changed DOMAIN from `mercenaryai.org` to `argosintel.org`
- ✅ Verified `vercel.json` - already has redirect from `www.argosintel.org` to `argosintel.org`

### 4. **Site Metadata**
- ✅ Site already branded as "Argos" throughout the application
- ✅ No hardcoded references to old domain found

## 🔧 Next Steps for Domain Launch

### 1. **Vercel Configuration**
1. Add custom domain in Vercel dashboard:
   - Go to Settings → Domains
   - Add `argosintel.org` and `www.argosintel.org`
   - Configure DNS as instructed by Vercel

### 2. **DNS Configuration**
Add these DNS records at your domain registrar:
```
A     @     76.76.21.21
CNAME www   cname.vercel-dns.com
```

### 3. **External Services**
Update domain whitelisting in:
- **Supabase**: Add `argosintel.org` to allowed URLs
- **Mapbox**: Add `argosintel.org` to allowed domains
- **OpenAI**: Update if domain restrictions are set

### 4. **SSL Certificate**
- Vercel will automatically provision SSL certificate once DNS is configured

### 5. **Logo File**
- Create new `argos-logo.png` file to replace the current logo
- Ensure it matches the dimensions: 192x192, 512x512 for different manifest icons

## 📝 Checklist Before Going Live

- [ ] DNS records configured
- [ ] Domain added to Vercel
- [ ] SSL certificate active
- [ ] Supabase URLs whitelist updated
- [ ] Mapbox domains updated
- [ ] New logo file created and uploaded
- [ ] Test redirect from www to non-www
- [ ] Test all API endpoints work with new domain
- [ ] Update any GitHub secrets if needed

## 🚀 Current Status

The application is fully prepared for the domain migration. All internal references have been updated to use the Argos branding and the new domain structure.