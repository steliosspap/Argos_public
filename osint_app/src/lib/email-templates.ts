export const getPasswordResetEmailTemplate = () => {
  return {
    subject: 'Reset your Argos password',
    headers: {
      'List-Unsubscribe': '<mailto:noreply@argosintel.org?subject=Unsubscribe>',
      'X-Priority': '3',
      'X-Mailer': 'Argos Intel Platform',
    },
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your Argos password</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f6f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 40px 20px 20px;">
              <h1 style="margin: 0; color: #1a202c; font-size: 24px;">Argos Intelligence Platform</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <p style="color: #4a5568; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
                Hello,
              </p>
              <p style="color: #4a5568; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
                You requested to reset your password for your Argos account. Click the button below to create a new password:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 14px 28px; background-color: #3182ce; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 6px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #718096; font-size: 14px; line-height: 20px; margin: 20px 0 0;">
                If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.
              </p>
              
              <p style="color: #718096; font-size: 14px; line-height: 20px; margin: 20px 0 0;">
                This link will expire in 1 hour for security reasons.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f7fafc; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
              <p style="color: #718096; font-size: 12px; line-height: 18px; margin: 0; text-align: center;">
                © 2024 Argos Intelligence Platform. All rights reserved.<br>
                This is an automated message, please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `
Reset your Argos password

Hello,

You requested to reset your password for your Argos account. Visit the link below to create a new password:

{{ .ConfirmationURL }}

If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.

This link will expire in 1 hour for security reasons.

© 2024 Argos Intelligence Platform. All rights reserved.
This is an automated message, please do not reply to this email.
    `
  };
};