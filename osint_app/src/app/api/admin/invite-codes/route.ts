import { NextRequest, NextResponse } from 'next/server';
import { withAdminRole } from '@/lib/api/auth';
import { createInviteCode } from '@/lib/invite-codes';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET /api/admin/invite-codes - List all invite codes
export const GET = withAdminRole(async (context) => {
  try {
    console.log('[GET /api/admin/invite-codes] Starting...');
    
    const supabaseAdmin = getSupabaseAdmin();
    
    // First, try a simple query to see if the table exists
    const { data: testData, error: testError } = await supabaseAdmin
      .from('invite_codes')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('[GET /api/admin/invite-codes] Test query failed:', testError);
    }
    
    const { data: inviteCodes, error } = await supabaseAdmin
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/admin/invite-codes] Failed to fetch invite codes:', error);
      throw new Error(`Failed to fetch invite codes: ${error.message}`);
    }

    console.log(`[GET /api/admin/invite-codes] Found ${inviteCodes?.length || 0} invite codes`);

    // Get session stats for each code (simplified to avoid join errors)
    const codesWithStats = await Promise.all(
      (inviteCodes || []).map(async (code) => {
        let sessions = [];
        try {
          const { data } = await supabaseAdmin
            .from('user_sessions')
            .select('id, is_active')
            .eq('invite_code_id', code.id);
          sessions = data || [];
        } catch (err) {
          console.warn('Failed to get sessions for code:', code.id);
        }
        
        return {
          ...code,
          stats: {
            totalSessions: sessions.length,
            activeSessions: sessions.filter((s: any) => s.is_active).length,
            usageRate: code.max_uses ? (code.current_uses / code.max_uses) * 100 : 0,
            isExpired: code.expires_at && new Date(code.expires_at) < new Date(),
          }
        };
      })
    );

    return codesWithStats;
  } catch (error: any) {
    console.error('[GET /api/admin/invite-codes] Unexpected error:', error);
    throw error;
  }
});

// POST /api/admin/invite-codes - Generate new invite codes
export const POST = withAdminRole(async (context) => {
  try {
    console.log('[POST /api/admin/invite-codes] Starting...');
    
    const body = await context.request.json();
    const {
      count = 1,
      maxUses = 1,
      expiresInDays,
      metadata = {},
      assignedUserId
    } = body;

    console.log('[POST /api/admin/invite-codes] Generating codes:', { count, maxUses, expiresInDays });

    const codes = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const code = await createInviteCode({
          createdBy: context.user.id,
          maxUses,
          expiresInDays,
          metadata: {
            ...metadata,
            createdByAdmin: context.user.email,
            createdAt: new Date().toISOString()
          },
          assignedUserId
        });
        
        codes.push(code);
        console.log(`[POST /api/admin/invite-codes] Generated code ${i + 1}:`, code);
      } catch (error: any) {
        console.error('[POST /api/admin/invite-codes] Failed to generate invite code:', error);
        // Continue generating other codes even if one fails
      }
    }

    console.log(`[POST /api/admin/invite-codes] Successfully generated ${codes.length} codes`);

    return {
      success: true,
      generated: codes.length,
      codes
    };
  } catch (error: any) {
    console.error('[POST /api/admin/invite-codes] Unexpected error:', error);
    throw error;
  }
});

// PATCH /api/admin/invite-codes/:id - Update invite code
export const PATCH = withAdminRole(async (context) => {
  try {
    const url = new URL(context.request.url);
    const codeId = url.pathname.split('/').pop();
    
    if (!codeId || codeId === 'invite-codes') {
      throw new Error('Invite code ID is required');
    }

    const body = await context.request.json();
    const { isActive, maxUses, expiresAt, assignedUserId } = body;

    const supabaseAdmin = getSupabaseAdmin();
    
    const updateData: any = {};
    if (typeof isActive !== 'undefined') updateData.is_active = isActive;
    if (typeof maxUses !== 'undefined') updateData.max_uses = maxUses;
    if (expiresAt !== undefined) updateData.expires_at = expiresAt;
    if (assignedUserId !== undefined) {
      updateData.assigned_user_id = assignedUserId;
      updateData.assigned_at = assignedUserId ? new Date().toISOString() : null;
    }

    const { data, error } = await supabaseAdmin
      .from('invite_codes')
      .update(updateData)
      .eq('id', codeId)
      .select()
      .single();

    if (error) {
      console.error('[PATCH /api/admin/invite-codes] Update failed:', error);
      throw new Error(`Failed to update invite code: ${error.message}`);
    }

    return {
      success: true,
      code: data
    };
  } catch (error: any) {
    console.error('[PATCH /api/admin/invite-codes] Unexpected error:', error);
    throw error;
  }
});

// DELETE /api/admin/invite-codes/:id - Deactivate invite code
export const DELETE = withAdminRole(async (context) => {
  try {
    const url = new URL(context.request.url);
    const codeId = url.pathname.split('/').pop();
    
    if (!codeId || codeId === 'invite-codes') {
      throw new Error('Invite code ID is required');
    }

    const supabaseAdmin = getSupabaseAdmin();
    
    const { data, error } = await supabaseAdmin
      .from('invite_codes')
      .update({ is_active: false })
      .eq('id', codeId)
      .select()
      .single();

    if (error) {
      console.error('[DELETE /api/admin/invite-codes] Deactivate failed:', error);
      throw new Error(`Failed to deactivate invite code: ${error.message}`);
    }

    return {
      success: true,
      message: 'Invite code deactivated',
      code: data
    };
  } catch (error: any) {
    console.error('[DELETE /api/admin/invite-codes] Unexpected error:', error);
    throw error;
  }
});