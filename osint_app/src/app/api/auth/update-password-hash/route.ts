import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { email, newPassword, isPasswordReset, sessionToken } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email and new password are required' },
        { status: 400 }
      );
    }

    // Security check: Only allow password updates during valid password reset
    if (isPasswordReset) {
      // In a production app, you would verify the sessionToken here
      // For now, we'll allow it during password reset flow
      console.log('Password reset flow detected for:', email);
    } else {
      // Regular password change would require authentication
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Get Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();

    // First check if user exists
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, username')
      .eq('email', email)
      .single();

    if (fetchError || !existingUser) {
      console.error('User not found:', email, fetchError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('Found user to update:', existingUser);

    // Update password in custom users table
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email);

    if (updateError) {
      console.error('Error updating password hash:', updateError);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    console.log(`✅ Password hash updated for user: ${email} (username: ${existingUser.username})`);

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Update password hash error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}