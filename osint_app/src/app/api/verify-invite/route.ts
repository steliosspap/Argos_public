import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { inviteCodeLimiter } from '@/lib/rate-limit';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfIp = request.headers.get('cf-connecting-ip');
    const ip = forwardedFor?.split(',')[0] || realIp || cfIp || 'unknown';
    
    // Check rate limit
    const rateLimit = inviteCodeLimiter.check(ip);
    if (!rateLimit.success) {
      return NextResponse.json(
        { 
          message: 'Too many attempts. Please try again later.',
          retryAfter: new Date(rateLimit.reset).toISOString()
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)),
          }
        }
      );
    }

    const { inviteCode } = await request.json();

    if (!inviteCode) {
      return NextResponse.json(
        { message: 'Invite code is required' },
        { status: 400 }
      );
    }

    // Get Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();

    // Check if invite code exists and is valid
    const { data: code, error } = await supabaseAdmin
      .from('invite_codes')
      .select('*')
      .eq('code', inviteCode.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !code) {
      return NextResponse.json(
        { message: 'Invalid invite code' },
        { status: 400 }
      );
    }

    // Check if code is expired
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return NextResponse.json(
        { message: 'This invite code has expired' },
        { status: 400 }
      );
    }

    // Check if code has reached max uses
    if (code.max_uses && code.current_uses >= code.max_uses) {
      return NextResponse.json(
        { message: 'This invite code has been fully redeemed' },
        { status: 400 }
      );
    }

    // Generate a session token for invite verification
    const verificationToken = `${code.id}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    
    // Set cookie to mark user as having valid invite
    const cookieStore = cookies();
    cookieStore.set('invite_verified', verificationToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });

    // Store the invite code ID for potential future tracking
    cookieStore.set('invite_code_id', code.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });

    // Log the verification (if table exists)
    try {
      await supabaseAdmin
        .from('invite_verifications')
        .insert({
          invite_code_id: code.id,
          ip_address: ip,
          user_agent: request.headers.get('user-agent'),
          verified_at: new Date().toISOString()
        });
    } catch (verifyLogError) {
      console.log('[verify-invite] Could not log verification (table might not exist):', verifyLogError);
    }

    // Increment usage count since this code grants access to the site
    console.log(`[verify-invite] Updating usage for code ${code.code}: ${code.current_uses} -> ${code.current_uses + 1}`);
    console.log(`[verify-invite] Code ID: ${code.id}`);
    
    const updateData: any = { 
      current_uses: code.current_uses + 1
    };
    
    // Note: last_used_at column doesn't exist yet, so we won't include it
    // updateData.last_used_at = new Date().toISOString();
    
    console.log(`[verify-invite] Update data:`, updateData);
    
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from('invite_codes')
      .update(updateData)
      .eq('id', code.id)
      .select();

    if (updateError) {
      console.error('[verify-invite] Failed to update invite code usage:', updateError);
      console.error('[verify-invite] Update error details:', JSON.stringify(updateError, null, 2));
      // Don't fail the request if we can't update the count
    } else {
      console.log(`[verify-invite] Successfully updated usage for code ${code.code}`);
      console.log(`[verify-invite] Update result:`, updateResult);
      
      // Verify the update worked
      const { data: verifyUpdate } = await supabaseAdmin
        .from('invite_codes')
        .select('current_uses')
        .eq('id', code.id)
        .single();
      
      console.log(`[verify-invite] Verified usage count: ${verifyUpdate?.current_uses}`);
    }

    // If the code has reached max uses after this use, deactivate it
    if (code.max_uses && (code.current_uses + 1) >= code.max_uses) {
      await supabaseAdmin
        .from('invite_codes')
        .update({ is_active: false })
        .eq('id', code.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Invite code verified successfully'
    });

  } catch (error) {
    console.error('Invite verification error:', error);
    return NextResponse.json(
      { message: 'An error occurred while verifying the invite code' },
      { status: 500 }
    );
  }
}