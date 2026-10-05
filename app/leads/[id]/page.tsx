import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { Shell } from '@/components/Shell';
import { dateTime, phoneHref, safeExternal, statusLabel } from '@/lib/format';
import { demoProgressAction, releaseAction, validationAction } from '@/app/actions';
import { CallForm } from '@/components/CallForm';

export const dynamic = 'force-dynamic';

type Event = { id: number; kind: string; note: string | null; details: Record<string, unknown>; created_at: string; actor_id: string };

export default async function LeadDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { db, profile } = await requireProfile();
  const { id } = await params;
  const messages = await searchParams;
  const [{ data: lead }, { data: events }, { data: settings }] = await Promise.all([
    db.from('leads').select('*').eq('id', id).single(),
    db.from('contact_events').select('id,kind,note,details,created_at,actor_id').eq('lead_id', id).order('created_at', { ascending: false }).limit(50),
    db.from('app_settings').select('value').eq('key', 'demo_url').single()
  ]);
  if (!lead) notFound();
  const reserved = lead.reserved_by === profile.id && lead.reserved_until && new Date(lead.reserved_until).getTime() > Date.now();
  const demoUrl = safeExternal(settings?.value);
  const whatsapp = safeExternal(lead.whatsapp_url);
  const phone = phoneHref(lead.phone);
  const canAdvanceDemo = profile.role === 'gestor' || (events ?? []).some((event: Event) => ['conversou','retorno'].includes(event.kind));

  return <Shell profile={profile}>
    <div className="back-row"><Link href={profile.role === 'gestor' ? '/admin' : '/'}>← {profile.role === 'gestor' ? 'Voltar à triagem' : 'Voltar para hoje'}</Link><span>ID {lead.id}</span></div>
    {messages.error && <div className="alert error" role="alert">{messages.error}</div>}{messages.ok && <div className="alert success" role="status">{messages.ok}</div>}
    <div className="contact-layout"><main className="contact-main">
      {reserved && <div className="reservation-banner"><div><span className="reservation-icon" aria-hidden="true">◷</span><strong>Reservado até {dateTime(lead.reserved_until)}</strong></div><span>Tentativa {(lead.call_attempts ?? 0) + 1} · 15 minutos para registrar</span></div>}
      <section className="contact-identity"><div className="identity-top"><h1>{lead.name}</h1><span className="class-chip large">{lead.lead_class || 'Revisar'}</span></div>
        <p>{[lead.neighborhood, lead.city].filter(Boolean).join(' · ') || 'Localização não informada'}</p>
        <div className="contact-status"><span className={`status ${lead.validation}`}>{statusLabel(lead.validation)}</span><span className="status">{statusLabel(lead.contact_status)}</span></div>
        <div className="call-target"><div><span>Telefone</span><strong>{lead.phone || 'Não informado'}</strong></div>{phone && <a className="button primary" href={phone}>Ligar agora</a>}</div>
        <div className="contact-facts"><span>{lead.url_type || 'Presença digital não informada'}</span><span>{lead.review_count ?? '—'} avaliações</span><span>Nota {lead.rating ?? '—'}</span></div>
        <div className="source-links">{safeExternal(lead.maps_url) && <a href={safeExternal(lead.maps_url)} target="_blank" rel="noopener noreferrer">Abrir Maps ↗</a>}{safeExternal(lead.website_url) && <a href={safeExternal(lead.website_url)} target="_blank" rel="noopener noreferrer">Ver site ou perfil ↗</a>}</div>
        {reserved && <p className="contact-help">Abrir o discador não registra uma tentativa. Salve o resultado após ligar.</p>}
      </section>
      {reserved ? <section className="call-workspace"><CallForm leadId={id} attempts={lead.call_attempts ?? 0} whatsappUrl={whatsapp} demoUrl={demoUrl} alreadyAccepted={!!lead.demo_accepted_at}/>
        <details className="release-panel"><summary>Não liguei para esta clínica</summary><form action={releaseAction} className="stack"><input type="hidden" name="lead_id" value={id}/><label>Motivo para devolver o lead<input name="reason" placeholder="Ex.: telefone incorreto; preciso pesquisar mais" required/></label><button className="button outline">Devolver sem contar tentativa</button></form></details>
      </section> : <section className="surface-section current-state"><h2>Situação atual</h2><div className="state-grid"><div><span>Tentativas registradas</span><strong>{lead.call_attempts ?? 0}</strong></div><div><span>Último contato</span><strong>{dateTime(lead.last_contact_at)}</strong></div><div><span>Próximo retorno</span><strong>{dateTime(lead.next_followup_at)}</strong></div></div>{whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="text-link">Abrir WhatsApp confirmado ↗</a>}</section>}
      <section className="surface-section history-section"><div className="section-heading"><h2>Histórico</h2><span className="date-range">Últimas 50 ações</span></div>{(events ?? []).length ? <div className="timeline">{(events ?? []).map((event: Event) => <div className="timeline-item" key={event.id}><span className="timeline-point" aria-hidden="true"/><div><strong>{statusLabel(event.kind)}</strong><time>{dateTime(event.created_at)}</time>{event.note && <p>{event.note}</p>}{!!event.details?.retorno && <small>Retorno: {dateTime(String(event.details.retorno))}</small>}</div></div>)}</div> : <p className="empty">Nenhuma atividade registrada.</p>}</section>
    </main><aside className="contact-aside">
      {profile.role === 'gestor' && <section className="aside-section"><h2>Validação do lead</h2><p>Confirme atuação em estética, localização, atividade e contato antes de liberar.</p><div className="aside-actions">{(['validado','descartado','nao_contatar'] as const).map(choice => <form action={validationAction} key={choice}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="validation" value={choice}/><button className={`button ${choice === 'validado' ? 'primary' : 'outline'}`}>{choice === 'validado' ? 'Validar e liberar' : choice === 'descartado' ? 'Descartar' : 'Não contatar'}</button></form>)}</div></section>}
      {canAdvanceDemo && <section className="aside-section demo-progress"><h2>Etapas da demo</h2><div className="step-list"><div><span>Aceitou receber</span><strong>{dateTime(lead.demo_accepted_at)}</strong></div><div><span>Link enviado</span><strong>{dateTime(lead.demo_sent_at)}</strong></div><div><span>Apresentação</span><strong>{dateTime(lead.presentation_at)}</strong></div></div>
        {!lead.demo_accepted_at && <form action={demoProgressAction}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="kind" value="aceite"/><button className="button outline full">Registrar aceite</button></form>}
        {lead.demo_accepted_at && !lead.demo_sent_at && demoUrl && <><a href={demoUrl} target="_blank" rel="noopener noreferrer" className="text-link">Abrir link da demo ↗</a><form action={demoProgressAction}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="kind" value="enviado"/><button className="button outline full">Confirmar envio manual</button></form></>}
        <form action={demoProgressAction} className="stack"><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="kind" value="agendado"/><label>Agendar apresentação<input type="datetime-local" name="presentation_at" required/></label><button className="button outline full">Salvar agenda</button></form></section>}
      <section className="aside-section source-section"><h2>Origem do registro</h2><p>{lead.source || 'Não informada'}</p><small>Place ID: {lead.place_id || '—'}</small></section>
    </aside></div>
  </Shell>;
}
