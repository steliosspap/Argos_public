import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    return NextResponse.json(
      { error: 'JWT_SECRET environment variable is required' },
      { status: 500 }
    );
  }

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Get Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    
    // Fetch user from database
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, username, email, name, password_hash, is_active, role')
      .eq('username', username)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json(
        { message: 'Account is deactivated' },
        { status: 403 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login
    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      },
      JWT_SECRET
    );

    const response = NextResponse.json({ 
      message: 'Login successful',
      token,
      user: { 
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name
      }
    });

    // Also set the authToken as an httpOnly cookie for better security
    response.cookies.set('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    // In development, return more detailed error
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        { 
          message: 'Internal server error',
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}