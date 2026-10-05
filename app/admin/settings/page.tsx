import { requireProfile } from '@/lib/auth';
import { Shell } from '@/components/Shell';
import { demoUrlAction, inviteAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { db, profile } = await requireProfile(true);
  const params = await searchParams;
  const [{ data: setting }, { data: profiles }] = await Promise.all([
    db.from('app_settings').select('value').eq('key', 'demo_url').single(),
    db.from('profiles').select('id,full_name,email,role,active').order('created_at', { ascending: false })
  ]);
  return <Shell profile={profile}>
    <header className="page-heading"><div><h1>Configurações</h1><p>Gerencie o link da demonstração e o acesso da equipe.</p></div></header>
    {params.error && <div className="alert error" role="alert">{params.error}</div>}{params.ok && <div className="alert success" role="status">{params.ok}</div>}
    <div className="settings-grid"><section className="settings-section"><h2>Link público da demo</h2><p>Operadores só podem registrar o envio depois que o link estiver configurado.</p>
      <form action={demoUrlAction} className="stack"><label>Endereço da demo<input name="demo_url" type="url" placeholder="https://..." defaultValue={setting?.value ?? ''}/></label><button className="button primary">Salvar link</button></form></section>
      <section className="settings-section"><h2>Convidar operador</h2><p>Cada pessoa recebe um login individual.</p><form action={inviteAction} className="stack"><label>Nome<input name="full_name" placeholder="Nome do operador" required/></label><label>Email<input name="email" type="email" placeholder="email@exemplo.com" required/></label><button className="button primary">Enviar convite</button></form></section></div>
    <section className="settings-section team-section"><div className="section-heading"><h2>Equipe</h2><span className="date-range">{(profiles ?? []).length} pessoas cadastradas</span></div><div className="team-list">{(profiles ?? []).map((person: { id: string; full_name: string | null; email: string; role: string; active: boolean }) => <div className="team-row" key={person.id}><div><strong>{person.full_name || person.email}</strong><small>{person.email}</small></div><span>{person.role === 'gestor' ? 'Gestor' : 'Operador'} · {person.active ? 'Ativo' : 'Inativo'}</span></div>)}</div></section>
  </Shell>;
}
