import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Verify the JWT token
    let decoded: any;
    try {
      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        return NextResponse.json(
          { error: 'JWT_SECRET environment variable is required' },
          { status: 500 }
        );
      }
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId;

    // Get the preferences from the request body
    const preferences = await request.json();

    // Validate preferences structure
    const validKeys = [
      'emailNotifications',
      'pushNotifications',
      'newsAlerts',
      'escalationAlerts',
      'refreshInterval',
      'theme',
      'language',
      'timezone',
      'mapStyle',
      'autoPlayVideos',
      'showEventLabels',
      'soundAlerts',
      'feedbackPopupShown',
      'blockedSources'
    ];

    // Filter out any invalid keys
    const filteredPreferences = Object.keys(preferences)
      .filter(key => validKeys.includes(key))
      .reduce((obj, key) => {
        obj[key] = preferences[key];
        return obj;
      }, {} as any);

    // Update user preferences in the database
    const { data, error } = await supabase
      .from('users')
      .update({ 
        preferences: filteredPreferences,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating preferences:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      preferences: data.preferences,
      message: 'Preferences updated successfully' 
    });

  } catch (error) {
    console.error('Error in update-preferences endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}