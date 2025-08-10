/**
 * Email service configuration
 * Supports multiple providers including Supabase integration
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  // For development, just log the email
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Email would be sent:');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Content preview:', html.substring(0, 200) + '...');
    return true;
  }

  // Production email sending
  try {
    // Option 1: Supabase Edge Function (recommended if you have it set up)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, subject, html }),
      });

      if (response.ok) {
        return true;
      }
    }

    // Option 2: Direct email provider integration
    // Configure based on your Supabase email setup
    if (process.env.EMAIL_PROVIDER === 'resend' && process.env.RESEND_API_KEY) {
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
    }

    console.warn('No email provider configured. Set up Supabase Edge Function or configure EMAIL_PROVIDER.');
    return false;
  } catch (error) {
    console.error('Email service error:', error);
    return false;
  }
}

export function generatePasswordResetEmail(resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 10px;
            padding: 30px;
            margin-top: 20px;
          }
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background-color: #3b82f6;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #666;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <h1>Argos Intelligence</h1>
          </div>
          
          <h2>Reset Your Password</h2>
          
          <p>You requested to reset your password. Click the button below to create a new password:</p>
          
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </div>
          
          <p>If you didn't request this, you can safely ignore this email.</p>
          
          <p>This link will expire in 1 hour for security reasons.</p>
          
          <div class="footer">
            <p>© 2024 Argos Intelligence. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}