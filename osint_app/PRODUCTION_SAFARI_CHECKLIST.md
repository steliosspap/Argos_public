# Production Safari Deployment Checklist

## Pre-Deployment Verification

### 1. Environment Variables
Ensure these are set in your production environment:
```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
JWT_SECRET=<your-jwt-secret>
NODE_ENV=production
```

### 2. Build Testing
```bash
# Build in production mode
npm run build

# Test production build locally
npm run start

# Test in Safari with production build
open -a Safari http://localhost:3000
```

### 3. Safari-Specific Testing URLs
After deployment, test these in Safari:
- `/safari-test` - Comprehensive API testing
- `/api/health` - Health check endpoint
- `/?debug=true` - Enable debug panel

## Production Configuration

### 1. Next.js Config
Ensure your `next.config.js` includes:
```javascript
module.exports = {
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Content-Type', value: 'application/json; charset=utf-8' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' }
      ]
    }
  ]
}
```

### 2. Vercel/Deployment Platform Settings
If using Vercel, add these headers in `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Content-Type", "value": "application/json; charset=utf-8" },
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    }
  ]
}
```

### 3. CDN/Proxy Configuration
If using a CDN or proxy:
- Disable response caching for `/api/*` routes
- Preserve all headers, especially `Content-Type`
- Don't modify JSON responses

## Post-Deployment Testing

### 1. Safari Desktop Testing
1. Clear all Safari data: Develop > Empty Caches
2. Test in regular browsing mode
3. Test in private browsing mode
4. Check console for errors

### 2. Safari iOS Testing
1. Test on real iOS device (not simulator)
2. Test with content blockers enabled
3. Test with "Prevent Cross-Site Tracking" enabled

### 3. API Response Verification
Run this in Safari console:
```javascript
// Test API responses
const tests = ['/api/health', '/api/news', '/api/arms-deals', '/api/events'];
for (const endpoint of tests) {
  fetch(endpoint)
    .then(r => {
      console.log(endpoint, {
        status: r.status,
        contentType: r.headers.get('content-type'),
        ok: r.ok
      });
      return r.text();
    })
    .then(text => {
      try {
        JSON.parse(text);
        console.log('✅ Valid JSON');
      } catch {
        console.error('❌ Invalid JSON:', text.substring(0, 100));
      }
    });
}
```

## Monitoring

### 1. Error Tracking
Add Safari-specific error tracking:
```javascript
if (window.safari || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
  window.addEventListener('unhandledrejection', event => {
    // Log to your error tracking service
    console.error('Safari Error:', event.reason);
  });
}
```

### 2. Server Logs
Monitor for:
- `[Middleware] Safari requests`
- `[Supabase] Missing environment variables`
- 500 errors from `/api/*` routes

### 3. Key Metrics
- Safari API success rate
- Response times for Safari vs other browsers
- JSON parsing errors

## Rollback Plan

If Safari issues persist:

### 1. Quick Fix
Add this to your API routes temporarily:
```typescript
export async function GET(request: NextRequest) {
  try {
    // Your existing code
  } catch (error) {
    // Force JSON response
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
```

### 2. Disable Features
In `middleware.ts`, add:
```typescript
if (isSafari && process.env.SAFARI_DISABLE === 'true') {
  return NextResponse.json({ 
    error: 'Safari temporarily unsupported' 
  }, { status: 503 });
}
```

### 3. Static Fallback
Serve static JSON files for Safari if APIs fail.

## Success Criteria

- [ ] No "string did not match expected pattern" errors
- [ ] All API endpoints return valid JSON
- [ ] Authentication works in Safari private mode
- [ ] No 500 errors in production logs
- [ ] Safari debug panel shows all green checks