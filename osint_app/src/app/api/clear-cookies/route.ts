import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();
  
  // Clear all auth-related cookies
  const cookiesToClear = [
    'invite_verified',
    'invite_code_id',
    'authToken',
    'refreshToken',
  ];
  
  cookiesToClear.forEach(cookieName => {
    cookieStore.set(cookieName, '', {
      maxAge: 0,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
  });
  
  return NextResponse.json({ 
    message: 'All cookies cleared',
    redirect: '/invite'
  });
}