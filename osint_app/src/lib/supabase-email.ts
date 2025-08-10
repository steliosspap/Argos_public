/**
 * Supabase Email Configuration Guide
 * 
 * Since you're using custom auth (not Supabase Auth), here are your options:
 * 
 * 1. SMTP Configuration in Supabase Dashboard:
 *    - Go to Supabase Dashboard > Settings > SMTP
 *    - Configure with providers like SendGrid, Mailgun, AWS SES, etc.
 *    - Then use Supabase Edge Functions to send emails
 * 
 * 2. Direct Integration with Email Provider:
 *    - Use the same email provider that Supabase uses
 *    - Configure it directly in your application
 * 
 * 3. Supabase Edge Function for Email:
 *    - Create an edge function that handles email sending
 *    - Call it from your application
 */

// Example Supabase Edge Function approach
export async function sendEmailViaSupabase(to: string, subject: string, html: string): Promise<boolean> {
  try {
    // This would call a Supabase Edge Function
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, subject, html }),
    });

    if (!response.ok) {
      throw new Error('Failed to send email via Supabase');
    }

    return true;
  } catch (error) {
    console.error('Supabase email error:', error);
    return false;
  }
}

// Example Edge Function code (deploy this to Supabase):
export const edgeFunctionExample = `
// supabase/functions/send-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  try {
    const { to, subject, html } = await req.json()
    
    // Use your SMTP configuration here
    // This example uses Resend (configure in Supabase secrets)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${RESEND_API_KEY}\`,
      },
      body: JSON.stringify({
        from: 'Argos <noreply@argosintel.org>',
        to,
        subject,
        html,
      }),
    })

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
`;

// For immediate use, here's a simpler approach using environment variables
export async function sendEmailDirect(to: string, subject: string, html: string): Promise<boolean> {
  // Check if we have email configuration
  const emailProvider = process.env.EMAIL_PROVIDER; // 'resend', 'sendgrid', 'ses', etc.
  
  switch (emailProvider) {
    case 'resend':
      return await sendViaResend(to, subject, html);
    case 'sendgrid':
      return await sendViaSendGrid(to, subject, html);
    default:
      console.warn('No email provider configured. Set EMAIL_PROVIDER in environment variables.');
      return false;
  }
}

async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Argos <noreply@argosintel.org>',
        to: [to],
        subject,
        html,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Resend error:', error);
    return false;
  }
}

async function sendViaSendGrid(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
        }],
        from: { email: 'noreply@argosintel.org', name: 'Argos' },
        subject,
        content: [{
          type: 'text/html',
          value: html,
        }],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('SendGrid error:', error);
    return false;
  }
}