import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const db = await supabaseServer();
  const code = request.nextUrl.searchParams.get('code');
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  let error;
  if (code) ({ error } = await db.auth.exchangeCodeForSession(code));
  else if (tokenHash && type) ({ error } = await db.auth.verifyOtp({ token_hash: tokenHash, type: type as 'invite' }));
  else error = new Error('Link inválido.');
  return NextResponse.redirect(new URL(error ? `/login?error=${encodeURIComponent(error.message)}` : '/set-password', request.url));
}
