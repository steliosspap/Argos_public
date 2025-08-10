import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Generates a random alphanumeric code
 */
export function generateRandomCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
}

/**
 * Validates invite code format
 */
export function isValidInviteCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{6,8}$/.test(code.toUpperCase());
}

/**
 * Server-side function to create a new invite code
 */
export async function createInviteCode(
  options: {
    createdBy?: string;
    maxUses?: number;
    expiresInDays?: number;
    metadata?: Record<string, any>;
    assignedUserId?: string;
  } = {}
) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Check if the generate_invite_code function exists by trying to use it
  const { data: rpcData, error: rpcError } = await supabase.rpc('generate_invite_code', {
    p_length: 8,
    p_created_by: options.createdBy || null,
    p_max_uses: options.maxUses || 1,
    p_expires_in_days: options.expiresInDays || null,
    p_metadata: options.metadata || {},
  });

  // If RPC function exists and works, use it
  if (!rpcError && rpcData) {
    // If assigning to specific user, update the invite code
    if (options.assignedUserId) {
      const { error: updateError } = await supabase
        .from('invite_codes')
        .update({ 
          assigned_user_id: options.assignedUserId,
          assigned_at: new Date().toISOString()
        })
        .eq('code', rpcData);

      if (updateError) {
        console.error('Failed to assign invite code:', updateError);
      }
    }
    return rpcData;
  }

  // Fallback: Generate code manually if RPC function doesn't exist
  console.warn('RPC function not available, generating code manually');
  
  let code: string;
  let attempts = 0;
  const maxAttempts = 100;

  // Generate unique code
  while (attempts < maxAttempts) {
    code = generateRandomCode(8);
    
    // Check if code already exists
    const { data: existing } = await supabase
      .from('invite_codes')
      .select('id')
      .eq('code', code)
      .single();
    
    if (!existing) {
      break;
    }
    
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Could not generate unique invite code after 100 attempts');
  }

  // Insert the new invite code
  const expiresAt = options.expiresInDays 
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('invite_codes')
    .insert({
      code: code!,
      created_by: options.createdBy || null,
      max_uses: options.maxUses || 1,
      expires_at: expiresAt,
      metadata: options.metadata || {},
      assigned_user_id: options.assignedUserId || null,
      assigned_at: options.assignedUserId ? new Date().toISOString() : null
    })
    .select('code')
    .single();

  if (error) {
    throw new Error(`Failed to create invite code: ${error.message}`);
  }

  return data.code;
}

/**
 * Server-side function to validate and redeem an invite code
 */
export async function validateAndRedeemInviteCode(
  code: string,
  userId: string,
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  }
) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Try RPC function first
  const { data: rpcData, error: rpcError } = await supabase.rpc('validate_and_redeem_invite_code', {
    p_code: code.toUpperCase(),
    p_user_id: userId,
    p_ip_address: metadata?.ipAddress || null,
    p_user_agent: metadata?.userAgent || null,
  });

  if (!rpcError && rpcData && rpcData.length > 0) {
    return {
      isValid: rpcData[0].is_valid,
      errorMessage: rpcData[0].error_message,
      inviteCodeId: rpcData[0].invite_code_id
    };
  }

  // Fallback: Manual validation if RPC function doesn't exist
  console.warn('RPC function not available, validating manually');

  // Get the invite code
  const { data: inviteCode, error: codeError } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (codeError || !inviteCode) {
    return {
      isValid: false,
      errorMessage: 'Invalid or expired invite code',
      inviteCodeId: null
    };
  }

  // Check expiration
  if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
    return {
      isValid: false,
      errorMessage: 'Invite code has expired',
      inviteCodeId: null
    };
  }

  // Check max uses
  if (inviteCode.max_uses && inviteCode.current_uses >= inviteCode.max_uses) {
    return {
      isValid: false,
      errorMessage: 'Invite code has reached maximum uses',
      inviteCodeId: null
    };
  }

  // Check if assigned to specific user
  if (inviteCode.assigned_user_id && inviteCode.assigned_user_id !== userId) {
    return {
      isValid: false,
      errorMessage: 'This invite code is not assigned to you',
      inviteCodeId: null
    };
  }

  // Check if user already redeemed a code
  const { data: existingRedemption } = await supabase
    .from('invite_redemptions')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existingRedemption) {
    return {
      isValid: false,
      errorMessage: 'You have already used an invite code',
      inviteCodeId: null
    };
  }

  // Redeem the code
  const { error: redeemError } = await supabase
    .from('invite_redemptions')
    .insert({
      invite_code_id: inviteCode.id,
      user_id: userId,
      ip_address: metadata?.ipAddress || null,
      user_agent: metadata?.userAgent || null
    });

  if (redeemError) {
    throw new Error(`Failed to redeem invite code: ${redeemError.message}`);
  }

  // Update usage count
  const { error: updateError } = await supabase
    .from('invite_codes')
    .update({ current_uses: inviteCode.current_uses + 1 })
    .eq('id', inviteCode.id);

  if (updateError) {
    console.error('Failed to update usage count:', updateError);
  }

  // Update user with invite code reference
  await supabase
    .from('users')
    .update({ invite_code_id: inviteCode.id })
    .eq('id', userId);

  return {
    isValid: true,
    errorMessage: null,
    inviteCodeId: inviteCode.id
  };
}

/**
 * Track user session with invite code reference
 */
export async function trackUserSession(
  userId: string,
  sessionToken: string,
  inviteCodeId?: string,
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
  }
) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Try RPC function first
  const { data: rpcData, error: rpcError } = await supabase.rpc('track_user_session', {
    p_user_id: userId,
    p_session_token: sessionToken,
    p_invite_code_id: inviteCodeId || null,
    p_ip_address: metadata?.ipAddress || null,
    p_user_agent: metadata?.userAgent || null,
    p_device_fingerprint: metadata?.deviceFingerprint || null,
    p_session_duration_hours: 24,
  });

  if (!rpcError) {
    return rpcData;
  }

  // Fallback: Insert directly if RPC function doesn't exist
  console.warn('RPC function not available, tracking session manually');

  // Deactivate existing sessions with same token
  await supabase
    .from('user_sessions')
    .update({ is_active: false })
    .eq('session_token', sessionToken)
    .eq('is_active', true);

  // Create new session
  const { data, error } = await supabase
    .from('user_sessions')
    .insert({
      user_id: userId,
      invite_code_id: inviteCodeId || null,
      session_token: sessionToken,
      ip_address: metadata?.ipAddress || null,
      user_agent: metadata?.userAgent || null,
      device_fingerprint: metadata?.deviceFingerprint || null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to track user session:', error);
    // Don't throw - session tracking is not critical
  }

  return data?.id;
}

/**
 * Get invite code statistics
 */
export async function getInviteCodeStats(codeId: string) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: code, error: codeError } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('id', codeId)
    .single();

  if (codeError || !code) {
    throw new Error('Invite code not found');
  }

  const { data: redemptions } = await supabase
    .from('invite_redemptions')
    .select('*')
    .eq('invite_code_id', codeId);

  const { data: sessions } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('invite_code_id', codeId);

  return {
    code,
    redemptions: redemptions || [],
    sessions: sessions || [],
    stats: {
      usageRate: code.max_uses ? (code.current_uses / code.max_uses) * 100 : 0,
      isExpired: code.expires_at && new Date(code.expires_at) < new Date(),
      totalSessions: sessions?.length || 0,
      activeSessions: sessions?.filter(s => s.is_active).length || 0,
    }
  };
}