# Production Deployment Checklist for Safari Compatibility

## Pre-Deployment Verification

### 1. Environment Variables
Ensure these are set in your production environment (Vercel, AWS, etc.):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-jwt-secret
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

### 2. Build Test
```bash
# Clean previous builds
rm -rf .next

# Set production env for test
export NODE_ENV=production

# Build
npm run build

# Look for any errors, especially:
# - Dynamic server usage errors (should be fixed)
# - Missing environment variables
# - Type errors
```

### 3. Local Production Test
```bash
# Start in production mode
npm run start

# Test in Safari
open -a Safari http://localhost:3000

# Test key endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/news
curl http://localhost:3000/api/arms-deals
curl http://localhost:3000/api/events?limit=10
```

## Production Configuration

### 1. Vercel Configuration
Create `vercel.json` if using Vercel:

```json
{
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "JWT_SECRET": "@jwt-secret"
  },
  "functions": {
    "src/app/api/*/route.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    }
  ]
}
```

### 2. Next.js Config
Ensure `next.config.js` has:

```javascript
module.exports = {
  // ... other config
  experimental: {
    // Ensure server components work properly
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Headers for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
    ]
  },
}
```

## Safari-Specific Checks

### 1. API Response Format
All API routes must:
- ✅ Have `export const dynamic = 'force-dynamic'`
- ✅ Return JSON even on errors
- ✅ Include proper Content-Type headers
- ✅ Handle missing Supabase client gracefully

### 2. Frontend Fetch Calls
All fetch calls must:
- ✅ Include `Accept: application/json` header
- ✅ Check response content-type before parsing
- ✅ Handle non-JSON responses
- ✅ Use consistent auth token key (`authToken`)

### 3. Middleware
- ✅ Safari detection works
- ✅ CORS headers are set properly
- ✅ No forced Content-Type override
- ✅ Logging works for debugging

## Production Testing

### 1. After Deployment
```bash
# Test health endpoint
curl https://your-domain.com/api/health

# Test with Safari user agent
curl -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15" \
  https://your-domain.com/api/news

# Check response headers
curl -I https://your-domain.com/api/news
```

### 2. Safari Browser Testing
1. Clear all Safari data: **Develop > Empty Caches**
2. Test in regular mode
3. Test in private browsing mode
4. Check console for errors
5. Verify Network tab shows JSON responses

### 3. Monitor Production Logs
Look for:
- `[Middleware] Safari requests`
- `[API Error]` messages
- `Supabase client not initialized` errors
- Any 500 errors from Safari user agents

## Potential Production Issues

### Issue 1: Environment Variables Not Loading
**Symptom**: "Database connection not configured" errors

**Fix**: 
- Verify env vars in deployment platform
- Check build logs for warnings
- Ensure `NEXT_PUBLIC_` prefix for client-side vars

### Issue 2: CORS Errors in Safari
**Symptom**: "Failed to fetch" or CORS errors

**Fix**:
- Check middleware is deployed
- Verify CORS headers in production
- Check if CDN is stripping headers

### Issue 3: HTML Error Pages
**Symptom**: "String did not match expected pattern"

**Fix**:
- Ensure all routes have `force-dynamic`
- Check error handling returns JSON
- Verify no custom error pages intercept API routes

## Quick Diagnostics

Visit these URLs in Safari after deployment:

1. **Health Check**: `https://your-domain.com/api/health`
   - Should return JSON with system status

2. **Safari Test Page**: `https://your-domain.com/safari-test`
   - Run all compatibility tests

3. **Debug Mode**: `https://your-domain.com?debug=true`
   - Shows Safari debug panel (dev only)

## Emergency Fixes

If Safari breaks in production:

### 1. Quick Middleware Fix
Add to your API routes:
```typescript
// Emergency Safari fix
const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache'
};

return new Response(JSON.stringify(data), { headers });
```

### 2. Disable Problematic Features
Set environment variable:
```
SAFARI_FALLBACK_MODE=true
```

Then check in routes:
```typescript
if (process.env.SAFARI_FALLBACK_MODE === 'true') {
  // Simplified response for Safari
}
```

## Success Criteria

- [ ] No 500 errors in Safari
- [ ] All API responses are JSON
- [ ] Auth works in Safari private mode
- [ ] No notification permission prompts
- [ ] Intelligence center loads data
- [ ] No console errors in Safari

## Final Build Command

```bash
# Production build with all checks
NODE_ENV=production npm run build && npm run start
```

Test thoroughly before deploying!