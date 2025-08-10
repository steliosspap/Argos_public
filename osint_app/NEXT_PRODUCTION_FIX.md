# Next.js Production Build Fixes

## Issues Fixed

1. **Dynamic Server Usage Errors**
   - Added `export const dynamic = 'force-dynamic'` to all API routes
   - This prevents Next.js from trying to statically render API routes

2. **Viewport Warnings**
   - Moved viewport configuration from metadata to separate viewport export
   - Added metadataBase URL for proper social media image resolution

## Key Changes

### API Routes
All API routes now include:
```typescript
// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
```

### Layout Configuration
```typescript
// src/app/layout.tsx
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://argosintel.org'),
  // ... rest of metadata
}
```

## Environment Variables for Production

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-jwt-secret

# Optional but recommended
NEXT_PUBLIC_APP_URL=https://your-production-url.com
NODE_ENV=production
```

## Build and Test

```bash
# Clean build
rm -rf .next

# Build
npm run build

# Test locally
npm run start

# Test Safari
open -a Safari http://localhost:3000
```

## Deployment Checklist

- [ ] All API routes have `dynamic = 'force-dynamic'`
- [ ] Environment variables are set in production
- [ ] No build errors about dynamic server usage
- [ ] No viewport warnings in build output
- [ ] Safari test page works: `/safari-test`
- [ ] API health check passes: `/api/health`

## Quick Fix Script

Run this to add dynamic export to any new API routes:
```bash
./scripts/fix-dynamic-routes.sh
```

## Vercel Deployment

If using Vercel, add to `vercel.json`:
```json
{
  "functions": {
    "src/app/api/*/route.ts": {
      "runtime": "nodejs18.x"
    }
  }
}
```