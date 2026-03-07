import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabase } from '@/lib/db';
import { MAX_BOT_TOKEN } from '@/lib/config';

function verifyMaxInitData(initData: string, botToken: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new Error('Missing hash');
  params.delete('hash');

  const sortedEntries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = sortedEntries.map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== receivedHash) throw new Error('Invalid signature');
  return Object.fromEntries(sortedEntries);
}

export async function POST(req: NextRequest) {
  console.log('[courier/register] Registration request received');

  if (!MAX_BOT_TOKEN) {
    console.error('[courier/register] MAX_BOT_TOKEN not configured');
    return NextResponse.json({ detail: 'Bot token not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { initData, name } = body;

    console.log('[courier/register] Received payload:', {
      hasInitData: !!initData,
      name: name || '(not provided)',
    });

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      console.warn('[courier/register] Invalid name provided');
      return NextResponse.json({ detail: 'Name is required (min 2 characters)' }, { status: 400 });
    }

    if (!initData) {
      console.warn('[courier/register] No initData provided');
      return NextResponse.json({ detail: 'initData is required' }, { status: 400 });
    }

    let maxId: string;
    let userData: Record<string, unknown> = {};

    try {
      const params = verifyMaxInitData(initData, MAX_BOT_TOKEN);
      const userParam = params.user;
      if (!userParam) throw new Error('No user data in initData');
      userData = JSON.parse(userParam);
      maxId = String(userData.id || '');
      if (!maxId) throw new Error('Missing user id');
      console.log('[courier/register] initData verified, MAX ID:', maxId);
    } catch (e) {
      console.warn('[courier/register] initData verification failed:', String(e));
      return NextResponse.json({ detail: `Invalid initData: ${String(e)}` }, { status: 401 });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, registration_status, name')
      .eq('max_id', maxId)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.registration_status === 'ACTIVE') {
        console.log('[courier/register] User already active, updating name:', maxId);
        await supabase
          .from('users')
          .update({ name: name.trim() })
          .eq('id', existingUser.id);
        return NextResponse.json({
          success: true,
          status: 'ACTIVE',
          message: 'Profile updated',
        });
      }

      // Already has a pending registration — update name
      console.log('[courier/register] Updating pending registration name for:', maxId);
      await supabase
        .from('users')
        .update({ name: name.trim() })
        .eq('id', existingUser.id);
      return NextResponse.json({
        success: true,
        status: 'PENDING_REGISTRATION',
        message: 'Registration request updated. Waiting for admin approval.',
      });
    }

    // Create new user with PENDING_REGISTRATION status
    console.log('[courier/register] Creating new courier registration for MAX ID:', maxId);
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        max_id: maxId,
        name: name.trim(),
        language: 'RU',
        registration_status: 'PENDING_REGISTRATION',
        is_verified: false,
      })
      .select('id')
      .single();

    if (insertError || !newUser) {
      console.error('[courier/register] Failed to create user:', insertError);
      return NextResponse.json({ detail: 'Failed to create registration' }, { status: 500 });
    }

    console.log('[courier/register] New courier registered successfully:', { maxId, userId: newUser.id, name: name.trim() });

    return NextResponse.json({
      success: true,
      status: 'PENDING_REGISTRATION',
      message: 'Registration request submitted. An administrator will review your request.',
    });
  } catch (e) {
    console.error('[courier/register] Unexpected error:', e);
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
