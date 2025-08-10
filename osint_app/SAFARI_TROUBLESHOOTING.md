# Safari Troubleshooting Guide

## Common Safari Issues and Solutions

### 1. 500 Errors from API Routes

**Symptoms:**
- API calls fail with 500 status
- "The string did not match the expected pattern" error
- Works in Chrome/Firefox but not Safari

**Causes:**
- Safari's stricter CORS policies
- Missing or malformed Authorization headers
- Safari's aggressive caching
- Private browsing mode restrictions

**Solutions:**

1. **Check Authorization Headers**
   ```typescript
   // Use the safari-fetch utility
   import { safariJsonFetch } from '@/utils/safari-fetch';
   
   const data = await safariJsonFetch('/api/intel-data', {
     requiresAuth: true
   });
   ```

2. **Add Safari Detection to API Routes**
   ```typescript
   const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
   
   if (isSafari) {
     response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
     response.headers.set('Pragma', 'no-cache');
     response.headers.set('Expires', '0');
   }
   ```

3. **Enable Debug Mode**
   - Add `?debug=true` to your URL to show Safari debugger
   - Check `/api/health` endpoint for system status

### 2. LocalStorage Issues

**Symptoms:**
- Auth tokens not persisting
- Settings not saving
- 401 Unauthorized errors

**Solutions:**
- Use the `storage` utility from `/utils/storage.ts`
- It automatically falls back to memory storage if localStorage is blocked

### 3. Service Worker Issues

**Symptoms:**
- Notification permission errors
- Service worker registration failures

**Solutions:**
- Service worker is configured to not request permissions automatically
- Push notifications are disabled by default for Safari

### 4. Debugging Steps

1. **Check API Health**
   ```bash
   curl -H "User-Agent: Safari" https://yourapp.com/api/health
   ```

2. **Enable Client-Side Debugging**
   - Visit: `https://yourapp.com?debug=true`
   - Check the Safari Debug panel in bottom-right

3. **Server Logs**
   - Look for `[Intel-Data]` prefixed logs
   - Check for "isSafari: true" in request details
   - Monitor authorization header presence

4. **Test Different Safari Modes**
   - Regular browsing
   - Private browsing
   - iOS Safari vs macOS Safari

### 5. API Request Checklist

- [ ] Authorization header is properly formatted: `Bearer <token>`
- [ ] Content-Type is set to `application/json`
- [ ] Accept header includes `application/json`
- [ ] CORS headers are present in response
- [ ] No aggressive caching headers

### 6. Environment Variables

Ensure these are set in production:
```env
NEXT_PUBLIC_SUPABASE_URL=<your-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key>
JWT_SECRET=<your-secret>
```

### 7. Testing Safari Compatibility

Run this in Safari's console:
```javascript
// Test localStorage
try {
  localStorage.setItem('test', 'test');
  console.log('✅ localStorage works');
} catch (e) {
  console.log('❌ localStorage blocked:', e.message);
}

// Test fetch with auth
fetch('/api/health', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('authToken')
  }
}).then(r => r.json()).then(console.log);
```

### 8. Known Safari Limitations

1. **Private Browsing**: localStorage is completely disabled
2. **Intelligent Tracking Prevention**: May block third-party cookies
3. **Cross-Origin Restrictions**: Stricter than other browsers
4. **Cache Behavior**: More aggressive, requires explicit no-cache headers

### 9. Monitoring

Add this to your error tracking:
```typescript
window.addEventListener('unhandledrejection', event => {
  if (isSafari() && event.reason?.message?.includes('500')) {
    console.error('Safari API Error:', {
      url: event.reason.url,
      headers: event.reason.headers,
      timestamp: new Date().toISOString()
    });
  }
});
```