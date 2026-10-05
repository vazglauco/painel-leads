import { loginAction } from '@/app/actions';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="auth-shell">
    <div className="auth-brand">atori. <span>leads</span></div>
    <section className="auth-card">
      <h1>Acesse sua operação.</h1>
      <p>Entre para acompanhar as clínicas e registrar suas abordagens.</p>
      {params.error && <div className="alert error" role="alert">{params.error}</div>}
      <form action={loginAction} className="stack">
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="button primary" type="submit">Entrar</button>
      </form>
    </section>
    <small>Atori · Clínicas de estética</small>
  </main>;
}
