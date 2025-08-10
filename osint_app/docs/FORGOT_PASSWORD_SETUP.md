# Forgot Password Setup Manual

## Overview

This manual provides a comprehensive guide for setting up and configuring the forgot password functionality in the Argos OSINT application. The system allows users to securely reset their passwords via email verification.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database configured
- Email service provider configured (Supabase, Resend, or custom SMTP)
- Environment variables properly set

## Architecture Overview

The forgot password system consists of:

1. **Frontend Components**
   - `/app/forgot-password/page.tsx` - Request password reset form
   - `/app/reset-password/page.tsx` - Set new password form

2. **API Endpoints**
   - `/api/auth/forgot-password/route.ts` - Handles reset requests
   - `/api/auth/reset-password/route.ts` - Processes password updates

3. **Database Schema**
   - Reset token storage in users table
   - Token expiry tracking

4. **Email Service**
   - HTML email templates
   - Multiple provider support

## Setup Instructions

### 1. Database Configuration

First, ensure your database has the necessary columns for password reset:

```sql
-- Add password reset columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
```

### 2. Environment Variables

Configure the following environment variables in your `.env.local` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/argos

# Email Configuration (choose one provider)

# Option 1: Supabase Edge Functions
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Option 2: Resend
RESEND_API_KEY=your-resend-api-key

# Option 3: Custom SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Email Service Setup

The application supports multiple email providers. Configure based on your choice:

#### Using Supabase Edge Functions

1. Deploy the edge function:
```bash
supabase functions deploy send-email
```

2. Ensure environment variables are set as shown above

#### Using Resend

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain
3. Add API key to environment variables

#### Using Custom SMTP

1. Enable 2FA on your email account
2. Generate app-specific password
3. Add SMTP credentials to environment variables

### 4. Frontend Routes

The forgot password flow uses these routes:

- `/forgot-password` - Where users request password reset
- `/reset-password?token=xxx` - Where users set new password

These are automatically available once the application is running.

### 5. Testing the Setup

1. **Start the application:**
```bash
cd osint_app
npm run dev
```

2. **Test password reset flow:**
   - Navigate to http://localhost:3000/login
   - Click "Forgot your password?"
   - Enter a registered email address
   - Check email for reset link
   - Click link and set new password

### 6. Security Considerations

#### Current Security Features

- ✅ Secure token generation (crypto.randomBytes)
- ✅ Token expiry (1 hour)
- ✅ Password hashing (bcrypt, 10 rounds)
- ✅ Input validation (Zod schemas)
- ✅ Security-conscious error messages

#### Recommended Enhancements

1. **Add Rate Limiting:**

```typescript
// In /api/auth/forgot-password/route.ts
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 3,
  interval: 'hour',
  fireImmediately: true,
});

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  
  if (!limiter.tryRemoveTokens(1)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }
  
  // ... existing code
}
```

2. **Add Password Strength Requirements:**

```typescript
// In validation schema
const passwordSchema = z.string()
  .min(8)
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain number')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character');
```

3. **Add Audit Logging:**

```typescript
// Log password reset attempts
await db.insert(audit_logs).values({
  user_id: user.id,
  action: 'password_reset_requested',
  ip_address: request.headers.get('x-forwarded-for'),
  timestamp: new Date(),
});
```

### 7. Troubleshooting

#### Common Issues

1. **Emails not sending:**
   - Check email provider credentials
   - Verify domain is properly configured
   - Check spam folder
   - Review application logs

2. **Reset link not working:**
   - Ensure NEXT_PUBLIC_APP_URL is correct
   - Check token hasn't expired (1 hour limit)
   - Verify database connection

3. **Password not updating:**
   - Check bcrypt is properly installed
   - Verify database write permissions
   - Review API error logs

#### Debug Mode

Enable detailed logging:

```typescript
// In email.ts
const DEBUG_EMAIL = process.env.NODE_ENV === 'development';

if (DEBUG_EMAIL) {
  console.log('Sending email:', { to, subject, token });
}
```

### 8. Customization Options

#### Email Template

Customize the email template in `/lib/email.ts`:

```typescript
function generatePasswordResetEmail(resetUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif;">
      <h2>Password Reset Request</h2>
      <p>Click below to reset your password:</p>
      <a href="${resetUrl}" style="
        display: inline-block;
        padding: 10px 20px;
        background-color: #10b981;
        color: white;
        text-decoration: none;
        border-radius: 5px;
      ">Reset Password</a>
      <p>This link expires in 1 hour.</p>
    </div>
  `;
}
```

#### Token Expiry

Change token expiry duration in `/api/auth/forgot-password/route.ts`:

```typescript
const TOKEN_EXPIRY_HOURS = 1; // Change this value
const tokenExpiry = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
```

#### UI Styling

Modify the forms in:
- `/app/forgot-password/page.tsx`
- `/app/reset-password/page.tsx`

### 9. Production Checklist

Before deploying to production:

- [ ] Set strong, unique environment variables
- [ ] Enable HTTPS for all endpoints
- [ ] Configure production email provider
- [ ] Test with real email addresses
- [ ] Implement rate limiting
- [ ] Set up monitoring and alerts
- [ ] Review security headers
- [ ] Test password reset flow end-to-end
- [ ] Configure proper CORS settings
- [ ] Set up error tracking (e.g., Sentry)

### 10. API Reference

#### POST /api/auth/forgot-password

Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

#### POST /api/auth/reset-password

Reset password with token.

**Request Body:**
```json
{
  "token": "reset-token-here",
  "password": "newSecurePassword123!"
}
```

**Response:**
```json
{
  "message": "Password reset successfully"
}
```

### 11. Maintenance

#### Regular Tasks

1. **Monitor token usage:**
   - Check for expired tokens
   - Clean up old tokens periodically

2. **Review security logs:**
   - Look for suspicious reset attempts
   - Monitor for brute force attacks

3. **Update dependencies:**
   - Keep bcrypt updated
   - Update email provider SDKs

#### Database Cleanup

Run periodically to remove expired tokens:

```sql
UPDATE users 
SET reset_token = NULL, reset_token_expiry = NULL 
WHERE reset_token_expiry < NOW();
```

### 12. Support

For issues or questions:

1. Check application logs in development console
2. Review error messages in network tab
3. Consult the troubleshooting section above
4. Check GitHub issues for similar problems

---

This manual covers the complete setup and configuration of the forgot password functionality. Follow each section carefully and test thoroughly before deploying to production.