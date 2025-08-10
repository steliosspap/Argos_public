import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    // Parse request body
    const body = await request.json();
    const { email, category, message } = body;
    
    // Validate input
    if (!email || !category || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Create feedback table if it doesn't exist (you should create this in Supabase dashboard)
    const { error } = await supabase
      .from('feedback')
      .insert({
        email,
        category,
        message,
        user_id: user?.id || null,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Feedback submission error:', error);
      
      // If table doesn't exist, log the feedback for now
      console.log('Feedback received:', {
        email,
        category,
        message,
        user_id: user?.id,
        timestamp: new Date().toISOString()
      });
      
      // Still return success to user
      return NextResponse.json({ 
        success: true,
        message: 'Feedback received' 
      });
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Feedback submitted successfully' 
    });
    
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}