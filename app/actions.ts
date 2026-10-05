'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase';

const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const fail = (path: string, message: string) => redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
const success = (path: string, message: string) => redirect(`${path}${path.includes('?') ? '&' : '?'}ok=${encodeURIComponent(message)}`);

function saoPauloDate(raw: string): string | null {
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00-03:00` : raw;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function loginAction(form: FormData) {
  const db = await supabaseServer();
  const { error } = await db.auth.signInWithPassword({ email: value(form, 'email'), password: value(form, 'password') });
  if (error) fail('/login', 'Email ou senha inválidos.');
  redirect('/');
}

export async function logoutAction() {
  const db = await supabaseServer();
  await db.auth.signOut();
  redirect('/login');
}

export async function setPasswordAction(form: FormData) {
  const db = await supabaseServer();
  const password = value(form, 'password');
  if (password.length < 12) fail('/set-password', 'Use ao menos 12 caracteres.');
  const { error } = await db.auth.updateUser({ password });
  if (error) fail('/set-password', error.message);
  success('/', 'Senha definida.');
}

export async function claimAction(form: FormData) {
  const { db } = await requireProfile();
  const queue = value(form, 'queue');
  const { data, error } = await db.rpc('claim_lead', { p_queue: queue });
  if (error) fail('/', error.message);
  if (!data?.id) fail('/', queue === 'retorno' ? 'Nenhum retorno vencido está disponível.' : 'Nenhum lead novo está disponível.');
  revalidatePath('/');
  redirect(`/leads/${encodeURIComponent(data.id)}`);
}

export async function releaseAction(form: FormData) {
  const { db } = await requireProfile();
  const id = value(form, 'lead_id');
  const { error } = await db.rpc('release_lead', { p_lead_id: id, p_reason: value(form, 'reason') });
  if (error) fail(`/leads/${encodeURIComponent(id)}`, error.message);
  revalidatePath('/');
  success('/', 'Lead devolvido à fila sem contar tentativa.');
}

export async function recordCallAction(form: FormData) {
  const { db } = await requireProfile();
  const id = value(form, 'lead_id');
  const followupRaw = value(form, 'followup_at');
  const presentationRaw = value(form, 'presentation_at');
  const followup = saoPauloDate(followupRaw);
  const presentation = saoPauloDate(presentationRaw);
  if (followupRaw && !followup) fail(`/leads/${encodeURIComponent(id)}`, 'Data de retorno inválida.');
  if (presentationRaw && !presentation) fail(`/leads/${encodeURIComponent(id)}`, 'Data da apresentação inválida.');
  const { error } = await db.rpc('record_call', {
    p_lead_id: id,
    p_outcome: value(form, 'outcome'),
    p_note: value(form, 'note'),
    p_followup_at: followup,
    p_whatsapp_sent: form.get('whatsapp_sent') === 'on',
    p_demo_accepted: form.get('demo_accepted') === 'on',
    p_demo_sent: form.get('demo_sent') === 'on',
    p_presentation_at: presentation
  });
  if (error) fail(`/leads/${encodeURIComponent(id)}`, error.message);
  revalidatePath('/');
  revalidatePath(`/leads/${id}`);
  success(`/leads/${encodeURIComponent(id)}`, 'Resultado registrado.');
}

export async function demoProgressAction(form: FormData) {
  const { db } = await requireProfile();
  const id = value(form, 'lead_id');
  const kind = value(form, 'kind');
  const when = saoPauloDate(value(form, 'presentation_at'));
  const { error } = await db.rpc('record_demo_progress', { p_lead_id: id, p_kind: kind, p_presentation_at: when });
  if (error) fail(`/leads/${encodeURIComponent(id)}`, error.message);
  revalidatePath(`/leads/${id}`);
  success(`/leads/${encodeURIComponent(id)}`, 'Etapa da demo registrada.');
}

export async function validationAction(form: FormData) {
  const { db } = await requireProfile(true);
  const id = value(form, 'lead_id');
  const { error } = await db.rpc('set_validation', { p_lead_id: id, p_validation: value(form, 'validation') });
  const returnTo = value(form, 'return_to');
  const destination = returnTo === '/admin' || returnTo.startsWith('/admin?') ? returnTo : `/leads/${encodeURIComponent(id)}`;
  if (error) fail(destination, error.message);
  revalidatePath('/admin');
  revalidatePath('/');
  success(destination, 'Validação atualizada.');
}

export async function demoUrlAction(form: FormData) {
  const { db } = await requireProfile(true);
  const { error } = await db.rpc('set_demo_url', { p_url: value(form, 'demo_url') });
  if (error) fail('/admin/settings', error.message);
  revalidatePath('/admin/settings');
  success('/admin/settings', 'Link da demo salvo.');
}

export async function inviteAction(form: FormData) {
  await requireProfile(true);
  const email = value(form, 'email').toLowerCase();
  const name = value(form, 'full_name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('/admin/settings', 'Informe um email válido.');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const { error } = await supabaseAdmin().auth.admin.inviteUserByEmail(email, {
    data: { full_name: name },
    ...(siteUrl ? { redirectTo: `${siteUrl.replace(/\/$/, '')}/auth/callback` } : {})
  });
  if (error) fail('/admin/settings', error.message);
  success('/admin/settings', 'Convite enviado ao operador.');
}
