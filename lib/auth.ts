import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase';

export type Profile = { id: string; email: string; full_name: string | null; role: 'gestor' | 'operador'; active: boolean };

export async function requireProfile(manager = false) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile, error } = await db.from('profiles').select('id,email,full_name,role,active').eq('id', user.id).single();
  if (error || !profile || !profile.active) redirect('/login?error=Acesso%20inativo');
  if (manager && profile.role !== 'gestor') redirect('/?error=Acesso%20restrito%20ao%20gestor');
  return { db, profile: profile as Profile };
}
