import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

// This webhook is called by Supabase when auth events happen
// You need to configure this in Supabase Dashboard under Authentication > Webhooks

function verifyWebhookSignature(request: NextRequest, secret: string): boolean {
  const signature = request.headers.get('webhook-signature');
  if (!signature) return false;
  
  // Implement webhook signature verification based on Supabase's method
  // For now, we'll skip verification in development
  if (process.env.NODE_ENV === 'development') return true;
  
  return true; // Implement proper verification in production
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (optional but recommended)
    const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
    if (webhookSecret && !verifyWebhookSignature(request, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = await request.json();
    console.log('Webhook received:', payload.type);

    // Handle password update events
    if (payload.type === 'user.updated' && payload.record?.email) {
      const { email, raw_user_meta_data } = payload.record;
      
      // Check if this is a password update
      if (raw_user_meta_data?.password_updated) {
        console.log(`Password update detected for user: ${email}`);
        
        // Get the new password from metadata (if available)
        // Note: Supabase doesn't send the actual password in webhooks for security
        // We'll need a different approach
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}