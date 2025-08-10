import { supabase } from './supabase';

/**
 * Triggers a password reset email for the given email address
 * @param email - The email address to send the reset link to
 * @returns Promise that resolves with success status and optional error message
 */
export async function triggerPasswordReset(email: string): Promise<{ 
  success: boolean; 
  message: string;
  error?: string;
}> {
  try {
    console.log('[triggerPasswordReset] Starting password reset for:', email);
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[triggerPasswordReset] Invalid email format');
      return {
        success: false,
        message: 'Invalid email format',
        error: 'Please provide a valid email address'
      };
    }

    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`;
    console.log('[triggerPasswordReset] Redirect URL:', redirectTo);

    // Send password reset email via Supabase Auth
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo,
    });

    console.log('[triggerPasswordReset] Supabase response:', { data, error });

    if (error) {
      console.error('[triggerPasswordReset] Supabase error:', error.message, error.status);
      // Don't expose specific errors to prevent email enumeration
      return {
        success: true, // Return success to prevent email enumeration
        message: 'If an account exists with this email, a password reset link has been sent.'
      };
    }

    // Log success
    console.log('✅ [triggerPasswordReset] Password reset email sent successfully to:', email);

    return {
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    };
  } catch (error) {
    console.error('[triggerPasswordReset] Unexpected error:', error);
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: 'Please try again later'
    };
  }
}

/**
 * Updates the user's password (requires valid recovery session)
 * @param newPassword - The new password to set
 * @returns Promise that resolves with success status and optional error message
 */
export async function updatePassword(newPassword: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    // Validate password strength
    if (newPassword.length < 8) {
      return {
        success: false,
        message: 'Password too short',
        error: 'Password must be at least 8 characters long'
      };
    }

    // Update password via Supabase Auth
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('Password update error:', error);
      return {
        success: false,
        message: 'Failed to update password',
        error: error.message || 'Please try again'
      };
    }

    return {
      success: true,
      message: 'Password updated successfully'
    };
  } catch (error) {
    console.error('Unexpected error in updatePassword:', error);
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: 'Please try again later'
    };
  }
}

/**
 * Checks if the current session is a valid password recovery session
 * @returns Promise that resolves with session validity status
 */
export async function checkPasswordRecoverySession(): Promise<{
  isValid: boolean;
  error?: string;
}> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session check error:', error);
      return {
        isValid: false,
        error: 'Unable to verify session'
      };
    }

    // Check if we have a session
    if (session) {
      return { isValid: true };
    }

    // Check for recovery token in URL hash (for direct email links)
    if (typeof window !== 'undefined') {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      if (accessToken && type === 'recovery') {
        return { isValid: true };
      }
    }

    return {
      isValid: false,
      error: 'Invalid or expired reset link'
    };
  } catch (error) {
    console.error('Unexpected error in checkPasswordRecoverySession:', error);
    return {
      isValid: false,
      error: 'Unable to verify session'
    };
  }
}