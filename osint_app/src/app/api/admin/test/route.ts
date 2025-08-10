import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ 
      error: 'No authorization header',
      authHeader: authHeader 
    }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return NextResponse.json(
        { error: 'JWT_SECRET environment variable is required' },
        { status: 500 }
      );
    }
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    return NextResponse.json({
      success: true,
      decoded: {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
        exp: decoded.exp,
        iat: decoded.iat
      },
      isAdmin: decoded.role === 'admin',
      tokenFirstChars: token.substring(0, 20) + '...'
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Invalid token',
      message: error.message,
      tokenFirstChars: token.substring(0, 20) + '...'
    }, { status: 401 });
  }
}