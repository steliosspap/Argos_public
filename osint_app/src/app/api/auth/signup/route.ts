import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { trackUserSession } from '@/lib/invite-codes';
import { signupLimiter } from '@/lib/rate-limit';

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    return NextResponse.json(
      { error: 'JWT_SECRET environment variable is required' },
      { status: 500 }
    );
  }

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfIp = request.headers.get('cf-connecting-ip');
    const ip = forwardedFor?.split(',')[0] || realIp || cfIp || 'unknown';
    
    // Check signup rate limit
    const signupRateLimit = signupLimiter.check(ip);
    if (!signupRateLimit.success) {
      return NextResponse.json(
        { 
          message: 'Too many signup attempts. Please try again later.',
          retryAfter: new Date(signupRateLimit.reset).toISOString()
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((signupRateLimit.reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(signupRateLimit.limit),
            'X-RateLimit-Remaining': String(signupRateLimit.remaining),
            'X-RateLimit-Reset': new Date(signupRateLimit.reset).toISOString(),
          }
        }
      );
    }
    
    const { username, name, email, password } = await request.json();

    // Get invite code from cookie (set by verify-invite endpoint)
    const inviteCodeId = request.cookies.get('invite_code_id')?.value;
    
    if (!inviteCodeId) {
      return NextResponse.json(
        { message: 'Invite verification required. Please verify your invite code first.' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!username || !name || !email || !password) {
      return NextResponse.json(
        { message: 'All fields are required' },
        { status: 400 }
      );
    }

    // Get Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    
    // Check if user already exists in database
    const { data: existingUsers, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .limit(1);

    if (checkError) {
      console.error('Database check error:', checkError);
      return NextResponse.json(
        { message: 'Database error' },
        { status: 500 }
      );
    }

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json(
        { message: 'Username or email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user first (without linking to invite code yet)
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        username,
        name,
        email,
        password_hash: passwordHash
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { message: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Validate the invite code from cookie
    const { data: inviteCode, error: inviteError } = await supabaseAdmin
      .from('invite_codes')
      .select('*')
      .eq('id', inviteCodeId)
      .eq('is_active', true)
      .single();

    if (inviteError || !inviteCode) {
      // If invite code is invalid, delete the user we just created
      await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', newUser.id);
        
      return NextResponse.json(
        { message: 'Invalid or expired invite verification. Please verify your invite code again.' },
        { status: 401 }
      );
    }

    // Check if code has reached max uses
    if (inviteCode.max_uses && inviteCode.current_uses >= inviteCode.max_uses) {
      await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', newUser.id);
        
      return NextResponse.json(
        { message: 'This invite code has been fully redeemed' },
        { status: 400 }
      );
    }

    // Record the redemption
    const userAgent = request.headers.get('user-agent') || undefined;
    
    try {
      // Insert redemption record
      await supabaseAdmin
        .from('invite_redemptions')
        .insert({
          invite_code_id: inviteCode.id,
          user_id: newUser.id,
          ip_address: ip,
          user_agent: userAgent
        });

      // Note: We no longer increment usage count here because it's already
      // incremented when the invite code is verified for site access

      // Update user with invite code reference
      await supabaseAdmin
        .from('users')
        .update({ invite_code_id: inviteCode.id })
        .eq('id', newUser.id);

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          name: newUser.name,
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        },
        JWT_SECRET
      );

      // Track the user session
      await trackUserSession(
        newUser.id,
        token,
        inviteCode.id || undefined,
        {
          ipAddress: ip || undefined,
          userAgent: userAgent || undefined
        }
      );

      return NextResponse.json({ 
        message: 'Signup successful',
        token,
        user: { 
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          name: newUser.name
        }
      });
    } catch (inviteError) {
      // If there's an error validating the invite code, delete the user
      await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', newUser.id);

      console.error('Invite code validation error:', inviteError);
      return NextResponse.json(
        { message: 'Failed to validate invite code' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}