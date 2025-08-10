# Email Setup with Supabase

Since you're using Supabase with a custom authentication system, here are the steps to enable email sending for password resets:

## Option 1: Supabase Edge Function (Recommended)

1. **Create a Supabase Edge Function** for sending emails:

```bash
supabase functions new send-email
```

2. **Add this code** to `supabase/functions/send-email/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { to, subject, html } = await req.json()
    
    // Get your email API key from Supabase secrets
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Argos <noreply@argosintel.org>',
        to: [to],
        subject,
        html,
      }),
    })

    if (!res.ok) {
      throw new Error(`Email failed: ${await res.text()}`)
    }

    const data = await res.json()
    
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

3. **Set up secrets** in Supabase:

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
```

4. **Deploy the function**:

```bash
supabase functions deploy send-email
```

## Option 2: Direct Email Provider Integration

1. **Choose an email provider** that Supabase supports:
   - Resend (recommended - modern and simple)
   - SendGrid
   - AWS SES
   - Mailgun

2. **Add environment variables** to your `.env.local`:

```env
# For Resend
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxx

# OR for SendGrid
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxx
```

3. **Update your production environment** variables in Vercel/hosting platform.

## Option 3: Using Supabase's SMTP Configuration

If you have SMTP configured in your Supabase project:

1. Go to Supabase Dashboard > Project Settings > SMTP
2. Configure your SMTP provider
3. Use Supabase's built-in email functionality

## Testing Email in Development

In development mode, emails are logged to the console instead of being sent. You'll see:

```
📧 Email would be sent:
To: user@example.com
Subject: Reset your Argos password
Content preview: <!DOCTYPE html><html><head>...
🔗 Password reset link: http://localhost:3000/reset-password?token=abc123...
```

## Troubleshooting

1. **Check environment variables** are set correctly
2. **Verify email provider API keys** are valid
3. **Check Supabase Edge Function logs**: `supabase functions logs send-email`
4. **Test with curl**:

```bash
curl -i --location --request POST 'https://your-project.supabase.co/functions/v1/send-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"to":"test@example.com","subject":"Test","html":"<p>Test</p>"}'
```

## Security Notes

- Never expose service role keys in client-side code
- Use environment variables for all sensitive keys
- Implement rate limiting for password reset requests
- Consider adding CAPTCHA for additional security