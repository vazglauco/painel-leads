import Link from 'next/link';
import { claimAction } from '@/app/actions';
import { Shell } from '@/components/Shell';
import { requireProfile } from '@/lib/auth';
import { dateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

type DueLead = { id: string; name: string; neighborhood: string | null; city: string | null; next_followup_at: string; call_attempts: number; contact_status: string };

export default async function Returns() {
  const { db, profile } = await requireProfile();
  const { data: overview } = await db.rpc('queue_overview');
  const queue = overview as { retornos?: number; minha_reserva?: string | null } | null;
  const now = new Date().toISOString();
  const dueResult = profile.role === 'gestor' ? await db.from('leads').select('id,name,neighborhood,city,next_followup_at,call_attempts,contact_status')
    .eq('validation', 'validado').gt('call_attempts', 0).lte('next_followup_at', now).not('contact_status', 'in', '(recusou,nao_contatar)')
    .not('phone', 'is', null).neq('phone', '').or(`reserved_until.is.null,reserved_until.lte.${now}`).order('next_followup_at').limit(30) : { data: [] };
  const due = (dueResult.data ?? []) as DueLead[];
  return <Shell profile={profile}>
    <header className="page-heading"><div><h1>Retornos</h1><p>Casos vencidos ficam disponíveis para qualquer operador assumir.</p></div></header>
    <section className="dispatch-panel returns-dispatch"><div className="dispatch-copy"><span className="section-overline">Fila compartilhada</span><h2>{queue?.retornos ?? 0} {queue?.retornos === 1 ? 'retorno disponível' : 'retornos disponíveis'}</h2><p>Ao assumir, a clínica fica reservada para você por 15 minutos.</p></div><div className="dispatch-actions">
      {queue?.minha_reserva ? <Link href={`/leads/${queue.minha_reserva}`} className="button primary">Continuar contato →</Link> : <form action={claimAction}><input type="hidden" name="queue" value="retorno"/><button className="button primary" disabled={!queue?.retornos}>Assumir próximo retorno</button></form>}</div></section>
    {profile.role === 'gestor' ? <section className="surface-section returns-list"><div className="section-heading"><h2>Casos vencidos</h2><span className="date-range">Mais antigos primeiro</span></div>
      {due.length ? due.map(lead => <Link href={`/leads/${lead.id}`} className="return-row" key={lead.id}><div><strong>{lead.name}</strong><small>{[lead.neighborhood, lead.city].filter(Boolean).join(' · ') || 'Localização não informada'} · {lead.call_attempts} {lead.call_attempts === 1 ? 'tentativa' : 'tentativas'}</small></div><div><span>Retorno previsto</span><time>{dateTime(lead.next_followup_at)}</time></div><span aria-hidden="true">→</span></Link>) : <p className="empty">Nenhum retorno vencido no momento.</p>}
    </section> : <section className="surface-section returns-list"><h2>Como funciona</h2><p>Use <strong>Assumir próximo retorno</strong> para receber uma clínica da fila. A ficha mostrará a última interação e o próximo passo. Os dados de outras clínicas permanecem privados até a reserva.</p></section>}
  </Shell>;
}
