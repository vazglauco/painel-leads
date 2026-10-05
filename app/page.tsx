import Link from 'next/link';
import { claimAction } from '@/app/actions';
import { requireProfile } from '@/lib/auth';
import { dateTime, statusLabel } from '@/lib/format';
import { Shell } from '@/components/Shell';

export const dynamic = 'force-dynamic';

type Stats = Record<'sem_abordagem' | 'sem_resposta' | 'conversas' | 'demo_aceita' | 'demo_enviada' | 'apresentacoes' | 'retornos_atrasados', number>;
type Event = { id: number; lead_id: string; kind: string; created_at: string };

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; from?: string; to?: string; operator?: string }> }) {
  const { db, profile } = await requireProfile();
  const params = await searchParams;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const monthAgo = new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? '') ? params.from! : monthAgo;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? '') ? params.to! : today;
  const dayAfterTo = new Date(Date.parse(`${to}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const actor = profile.role === 'gestor' && /^[0-9a-f-]{36}$/i.test(params.operator ?? '') ? params.operator! : null;
  const [{ data: overview }, { data: stats }, { data: operators }, { data: recent }] = await Promise.all([
    db.rpc('queue_overview'),
    db.rpc('dashboard_stats', { p_from: `${from}T00:00:00-03:00`, p_to: `${dayAfterTo}T00:00:00-03:00`, p_actor: actor }),
    profile.role === 'gestor' ? db.from('profiles').select('id,full_name,email').eq('active', true).order('email') : Promise.resolve({ data: [] }),
    db.from('contact_events').select('id,lead_id,kind,created_at').in('kind', ['sem_resposta','conversou','retorno','recusou','nao_contatar','demo_aceite','demo_enviado','demo_agendado']).order('created_at', { ascending: false }).limit(5)
  ]);
  const events = (recent ?? []) as Event[];
  const ids = [...new Set(events.map(event => event.lead_id))];
  const nameResult = ids.length ? await db.from('leads').select('id,name').in('id', ids) : { data: [] };
  const names = new Map((nameResult.data ?? []).map((lead: { id: string; name: string }) => [lead.id, lead.name]));
  const counts = (stats ?? {}) as Stats;
  const queue = overview as { novos?: number; retornos?: number; minha_reserva?: string | null } | null;
  const reserved = !!queue?.minha_reserva;
  const firstName = (profile.full_name || profile.email).split(' ')[0];
  const metrics = [
    ['Sem abordagem', counts.sem_abordagem ?? 0, 'Clínicas validadas'], ['Sem resposta', counts.sem_resposta ?? 0, 'Tentativas no período'],
    ['Conversas', counts.conversas ?? 0, 'Atendidas no período'], ['Demos aceitas', counts.demo_aceita ?? 0, 'Aceitaram receber'],
    ['Links enviados', counts.demo_enviada ?? 0, 'Envios confirmados'], ['Apresentações', counts.apresentacoes ?? 0, 'Agendadas no período'],
    ['Retornos atrasados', counts.retornos_atrasados ?? 0, 'Exigem atenção']
  ] as const;

  return <Shell profile={profile}>
    <header className="page-heading home-heading"><div><h1>{profile.role === 'gestor' ? 'Visão da operação' : `Bom dia, ${firstName}.`}</h1><p>{profile.role === 'gestor' ? 'Acompanhe as filas e mantenha a equipe pronta para abordar.' : 'Continue um contato ou assuma sua próxima clínica.'}</p></div><span className="role-chip">{profile.role === 'gestor' ? 'Gestor' : 'Operador'}</span></header>
    {params.error && <div className="alert error" role="alert">{params.error}</div>}{params.ok && <div className="alert success" role="status">{params.ok}</div>}
    <section className="dispatch-panel" aria-labelledby="dispatch-title"><div className="dispatch-copy"><span className="section-overline">Sua próxima ação</span><h2 id="dispatch-title">{reserved ? 'Você tem um contato em andamento.' : (queue?.retornos ?? 0) > 0 ? 'Há retornos esperando.' : 'A fila está pronta.'}</h2><p>{reserved ? 'Continue a reserva antes de assumir outro lead.' : `${queue?.retornos ?? 0} retornos vencidos · ${queue?.novos ?? 0} leads novos disponíveis`}</p></div>
      <div className="dispatch-actions">{reserved ? <Link className="button primary" href={`/leads/${queue!.minha_reserva}`}>Continuar contato <span aria-hidden="true">→</span></Link> : <><form action={claimAction}><input type="hidden" name="queue" value="retorno"/><button className="button primary" disabled={!queue?.retornos}>Assumir retorno</button></form><form action={claimAction}><input type="hidden" name="queue" value="novo"/><button className="button outline" disabled={!queue?.novos}>Novo contato</button></form></>}</div>
    </section>
    <div className="home-columns"><section className="surface-section" aria-labelledby="queues-title"><div className="section-heading"><h2 id="queues-title">Filas de trabalho</h2><Link href="/retornos" className="text-link">Ver retornos →</Link></div><div className="queue-list">
      <div className="queue-row"><span className="queue-symbol" aria-hidden="true">↗</span><div><strong>Novos contatos</strong><small>Validados e ainda não abordados</small></div><b>{queue?.novos ?? 0}</b></div>
      <div className="queue-row"><span className="queue-symbol" aria-hidden="true">↺</span><div><strong>Retornos vencidos</strong><small>Compartilhados com a equipe</small></div><b>{queue?.retornos ?? 0}</b></div>
      {profile.role === 'gestor' && <Link href="/admin" className="queue-row queue-link"><span className="queue-symbol" aria-hidden="true">✓</span><div><strong>Triagem de clínicas</strong><small>Revisar e liberar para contato</small></div><span aria-hidden="true">→</span></Link>}</div></section>
      <section className="surface-section" aria-labelledby="recent-title"><div className="section-heading"><h2 id="recent-title">Atividade recente</h2><Link href="/atividade" className="text-link">Ver todas →</Link></div>{events.length ? <div className="activity-list">{events.map(event => <Link href={`/leads/${event.lead_id}`} key={event.id} className="activity-row"><span className="activity-mark" aria-hidden="true"/><div><strong>{names.get(event.lead_id) || event.lead_id}</strong><small>{statusLabel(event.kind)}</small></div><time>{dateTime(event.created_at)}</time></Link>)}</div> : <p className="empty">As atividades registradas aparecerão aqui após o primeiro contato.</p>}</section></div>
    <section className="metrics-section" aria-labelledby="metrics-title"><div className="section-heading"><div><h2 id="metrics-title">Números da operação</h2><p>Resultado registrado no período selecionado.</p></div><span className="date-range">{from} a {to}</span></div>
      {profile.role === 'gestor' && <form className="filters" method="get"><label>De<input type="date" name="from" defaultValue={from}/></label><label>Até<input type="date" name="to" defaultValue={to}/></label><label>Operador<select name="operator" defaultValue={actor ?? ''}><option value="">Equipe toda</option>{(operators ?? []).map((p: { id: string; full_name: string | null; email: string }) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></label><button className="button outline">Filtrar</button></form>}
      <div className="metrics-list">{metrics.map(([label, number, detail]) => <div className="metric-row" key={label}><div><strong>{label}</strong><small>{detail}</small></div><b>{number}</b></div>)}</div>
    </section>
  </Shell>;
}
