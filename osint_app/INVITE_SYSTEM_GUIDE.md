# Argos Invite System Guide

## Overview

The Argos application uses a comprehensive invite code system to ensure the site remains private and access is controlled. This guide explains how the system works and how to manage it.

## Key Security Features

### 1. Multi-Layer Protection
- **Invite Code Verification**: Required for initial site access
- **User Authentication**: JWT-based authentication after signup
- **Role-Based Access**: Admin vs regular user permissions
- **Rate Limiting**: Prevents brute force attacks

### 2. Invite Code Features
- 6-8 character alphanumeric codes
- Configurable usage limits (default: single use)
- Optional expiration dates
- Can be assigned to specific users (lockdown mode)
- Full audit trail of redemptions

### 3. Access Flow
1. User visits site → Redirected to `/invite` page
2. User enters valid invite code
3. Cookie set to allow access to signup/login
4. User creates account (invite code is redeemed)
5. JWT token issued for authenticated access

## Generating Invite Codes

### Using the Script

```bash
# Generate 5 single-use codes
npm run generate-invite-codes -- --count 5

# Generate 1 code with 10 uses that expires in 30 days
npm run generate-invite-codes -- --max-uses 10 --expires-days 30

# Generate codes with admin association
npm run generate-invite-codes -- --count 3 --admin-email admin@example.com

# Get help
npm run generate-invite-codes -- --help
```

### Using the Admin API

Admin users can also generate codes through the API:

```bash
POST /api/admin/invite-codes
{
  "count": 5,
  "maxUses": 1,
  "expiresInDays": 30,
  "metadata": {
    "purpose": "beta-testers"
  }
}
```

## Important Security Notes

1. **JWT_SECRET**: Make sure to set a secure JWT_SECRET in your environment variables. A default has been added but should be changed in production.

2. **Database Security**: The invite system uses Row Level Security (RLS) in Supabase to ensure data isolation.

3. **Rate Limiting**:
   - Invite verification: 5 attempts per hour per IP
   - Login: 10 attempts per 15 minutes
   - Signup: 3 attempts per hour

4. **Session Tracking**: All sessions are tracked and linked to invite codes for audit purposes.

## Managing Invite Codes

### Admin Dashboard
Admins can manage invite codes through the admin interface at `/admin/invite-codes`:
- View all codes and their usage statistics
- Generate new codes
- Deactivate codes
- View redemption history
- Monitor active sessions

### Database Queries
For direct database management:

```sql
-- View all active codes
SELECT * FROM invite_codes WHERE is_active = true;

-- Check redemptions
SELECT * FROM invite_redemptions 
JOIN users ON invite_redemptions.user_id = users.id;

-- Deactivate a code
UPDATE invite_codes SET is_active = false WHERE code = 'ABCD1234';
```

## Troubleshooting

### Common Issues

1. **"Invalid invite code" error**
   - Check if code is active in database
   - Verify code hasn't expired
   - Ensure code hasn't reached max uses

2. **Users can't access after entering valid code**
   - Check browser cookies are enabled
   - Verify middleware is running correctly
   - Check for rate limiting

3. **Signup fails after invite verification**
   - Fixed bug where `inviteValidation` was undefined
   - Ensure JWT_SECRET is set in environment

## Production Checklist

- [ ] Set secure JWT_SECRET in production environment
- [ ] Configure proper CORS settings
- [ ] Enable HTTPS for secure cookies
- [ ] Set up monitoring for failed invite attempts
- [ ] Regular audit of invite code usage
- [ ] Backup invite code database regularly

## Emergency Access

If you get locked out:
1. Access the database directly through Supabase dashboard
2. Generate a new invite code using SQL:
   ```sql
   SELECT generate_invite_code(8, NULL, 1, 7, '{"purpose": "emergency"}');
   ```
3. Or temporarily disable invite checking in middleware (not recommended)