# API Route Update Example

To ensure your API routes work properly in Safari in production, wrap them with the `withApiHandler` function:

## Before:
```typescript
// src/app/api/news/route.ts
export async function GET(request: NextRequest) {
  try {
    // Your logic here
    return NextResponse.json({ data: newsData });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

## After:
```typescript
// src/app/api/news/route.ts
import { withApiHandler, withOptionsHandler } from '@/utils/api-wrapper';

export const GET = withApiHandler(async (request) => {
  // Your existing logic here
  return NextResponse.json({ data: newsData });
});

// Add OPTIONS handler for Safari preflight requests
export const OPTIONS = withOptionsHandler(['GET']);
```

## Benefits:
1. **Automatic JSON validation** - Ensures response is always JSON
2. **Safari detection** - Applies Safari-specific headers
3. **Error handling** - Catches errors and returns JSON
4. **Logging** - Logs Safari requests in production
5. **Performance monitoring** - Tracks slow requests

## Quick Migration:
```bash
# Update all API routes
find src/app/api -name "route.ts" -exec echo "Update: {}" \;
```

## Testing:
After updating, test with:
```bash
curl -H "User-Agent: Safari/605.1.15" http://localhost:3000/api/news
```