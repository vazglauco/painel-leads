import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { requireProfile } from '@/lib/auth';
import { dateTime, statusLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Event = { id: number; lead_id: string; kind: string; note: string | null; created_at: string };

export default async function Activity() {
  const { db, profile } = await requireProfile();
  const { data } = await db.from('contact_events').select('id,lead_id,kind,note,created_at').order('created_at', { ascending: false }).limit(100);
  const events = (data ?? []) as Event[];
  const ids = [...new Set(events.map(event => event.lead_id))];
  const nameResult = ids.length ? await db.from('leads').select('id,name').in('id', ids) : { data: [] };
  const names = new Map((nameResult.data ?? []).map((lead: { id: string; name: string }) => [lead.id, lead.name]));
  return <Shell profile={profile}><header className="page-heading"><div><h1>Atividade</h1><p>{profile.role === 'gestor' ? 'Histórico recente de ações da equipe.' : 'Seus contatos e registros recentes.'}</p></div></header>
    <section className="surface-section activity-page"><div className="section-heading"><h2>Registros recentes</h2><span className="date-range">Últimos 100 eventos</span></div>
      {events.length ? <div className="activity-table">{events.map(event => <Link href={`/leads/${event.lead_id}`} className="activity-entry" key={event.id}><span className="activity-mark" aria-hidden="true"/><div><strong>{names.get(event.lead_id) || event.lead_id}</strong><small>{statusLabel(event.kind)}</small>{event.note && <p>{event.note}</p>}</div><time>{dateTime(event.created_at)}</time><span aria-hidden="true">→</span></Link>)}</div> : <p className="empty">Ainda não há ações registradas.</p>}
    </section>
  </Shell>;
}
