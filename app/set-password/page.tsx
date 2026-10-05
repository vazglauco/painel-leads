import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase';
import { setPasswordAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function SetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');
  const params = await searchParams;
  return <main className="auth-shell"><div className="auth-brand">atori. <span>leads</span></div>
    <section className="auth-card"><h1>Defina sua senha.</h1>
      <p>Use ao menos 12 caracteres para proteger seu acesso.</p>
      {params.error && <div className="alert error" role="alert">{params.error}</div>}
      <form action={setPasswordAction} className="stack"><label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={12} required /></label>
        <button className="button primary">Salvar e continuar</button></form></section></main>;
}
