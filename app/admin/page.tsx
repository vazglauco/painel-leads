import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { Shell } from '@/components/Shell';
import { validationAction } from '@/app/actions';
import { safeExternal, statusLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

type LeadRow = { id: string; name: string; lead_class: string | null; phone: string | null; neighborhood: string | null; city: string | null; validation: string; contact_status: string };

export default async function Admin({ searchParams }: { searchParams: Promise<{ q?: string; validation?: string; page?: string; selected?: string; error?: string; ok?: string }> }) {
  const { db, profile } = await requireProfile(true);
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 100);
  const validation = ['pendente','validado','descartado','nao_contatar'].includes(params.validation ?? '') ? params.validation! : 'pendente';
  const page = Math.max(1, Math.min(1000, Number(params.page) || 1));
  let query = db.from('leads').select('id,name,lead_class,phone,neighborhood,city,validation,contact_status', { count: 'exact' }).eq('validation', validation).order('name').range((page - 1) * 30, page * 30 - 1);
  if (q) query = query.or(`name.ilike.%${q.replace(/[,()%]/g, '')}%,id.ilike.%${q.replace(/[,()%]/g, '')}%`);
  const [{ data: rows, count, error: leadError }, { count: pendingCount }, { count: validatedCount }, { count: dueCount }] = await Promise.all([
    query,
    db.from('leads').select('id', { count: 'exact', head: true }).eq('validation', 'pendente'),
    db.from('leads').select('id', { count: 'exact', head: true }).eq('validation', 'validado'),
    db.from('leads').select('id', { count: 'exact', head: true }).eq('validation', 'validado').gt('call_attempts', 0).lte('next_followup_at', new Date().toISOString()).not('contact_status', 'in', '(recusou,nao_contatar)').not('phone', 'is', null).neq('phone', '')
  ]);
  const leads = (rows ?? []) as LeadRow[];
  const selectedId = leads.some(lead => lead.id === params.selected) ? params.selected : leads[0]?.id;
  const selectedResult = selectedId ? await db.from('leads').select('*').eq('id', selectedId).single() : { data: null };
  const lead = selectedResult.data;
  const base = new URLSearchParams({ validation, q, page: String(page) });
  const hrefFor = (id: string) => `/admin?${new URLSearchParams({ ...Object.fromEntries(base), selected: id })}`;
  const returnTo = `/admin?${base}`;
  const maps = safeExternal(lead?.maps_url);
  const site = safeExternal(lead?.website_url);

  return <Shell profile={profile}>
    <header className="page-heading triage-heading"><div><h1>Triagem de clínicas</h1><p>Confira os dados antes de liberar uma clínica para abordagem.</p></div>
      <div className="triage-summary" aria-label="Resumo da operação"><div><strong>{pendingCount ?? 0}</strong><span>pendentes</span></div><div><strong>{validatedCount ?? 0}</strong><span>validadas</span></div><div><strong>{dueCount ?? 0}</strong><span>retornos vencidos</span></div></div></header>
    {params.error && <div className="alert error" role="alert">{params.error}</div>}{params.ok && <div className="alert success" role="status">{params.ok}</div>}
    <form method="get" className="triage-filters"><label className="search-field"><span className="sr-only">Buscar clínica ou ID</span><input name="q" placeholder="Buscar clínica ou ID" defaultValue={q}/></label>
      <label><span className="sr-only">Validação</span><select name="validation" defaultValue={validation}><option value="pendente">Pendentes</option><option value="validado">Validadas</option><option value="descartado">Descartadas</option><option value="nao_contatar">Não contatar</option></select></label><button className="button outline">Filtrar</button>
      <Link href="/admin/import" className="text-link">Importar planilha</Link></form>
    {leadError && <div className="alert error" role="alert">{leadError.message}</div>}
    <div className="triage-workspace"><section className="triage-list" aria-label="Clínicas para triagem"><div className="triage-list-head"><span>Clínica</span><span>Classe</span><span>Telefone</span><span>Situação</span></div>
      {leads.length ? leads.map(item => <Link href={hrefFor(item.id)} className={`triage-row ${item.id === selectedId ? 'selected' : ''}`} key={item.id} aria-current={item.id === selectedId ? 'true' : undefined}>
        <span className="triage-name"><strong>{item.name}</strong><small>{[item.neighborhood, item.city].filter(Boolean).join(' · ') || 'Localização não informada'}</small></span>
        <span><span className="class-chip">{item.lead_class || 'Revisar'}</span></span><span className="triage-phone">{item.phone || 'Sem telefone'}</span><span className="triage-status"><span className={`status ${item.validation}`}>{statusLabel(item.validation)}</span><span aria-hidden="true">›</span></span>
      </Link>) : <p className="empty padded">Nenhuma clínica encontrada. Ajuste os filtros para continuar.</p>}
      <div className="pagination"><span>Mostrando {leads.length} de {count ?? 0} clínicas</span><div>{page > 1 && <Link href={`/admin?${new URLSearchParams({ validation, q, page: String(page - 1) })}`}>← Anterior</Link>}{page * 30 < (count ?? 0) && <Link href={`/admin?${new URLSearchParams({ validation, q, page: String(page + 1) })}`}>Próxima →</Link>}</div></div>
    </section>
    <aside className="review-pane" aria-label="Ficha de revisão">{lead ? <><div className="review-header"><div><h2>{lead.name}</h2><p>{[lead.neighborhood, lead.city].filter(Boolean).join(' · ') || 'Localização não informada'}</p></div><span className="class-chip large">{lead.lead_class || 'Revisar'}</span></div>
      <div className="review-tabs"><span className="active">Visão geral</span><Link href={`/leads/${lead.id}`}>Histórico completo →</Link></div>
      <div className="review-body"><div className="review-section"><h3>Dados da origem</h3><p className="section-note">Informações importadas. Confirme nos canais da clínica antes de validar.</p>
        <dl className="review-facts"><div><dt>Presença digital</dt><dd>{lead.url_type || 'Não informada'}</dd></div><div><dt>Avaliações</dt><dd>{lead.review_count ?? '—'}</dd></div><div><dt>Nota no Maps</dt><dd>{lead.rating ?? '—'}</dd></div><div><dt>Situação no Maps</dt><dd>{lead.maps_status || '—'}</dd></div><div><dt>Telefone</dt><dd>{lead.phone || 'Não informado'}</dd></div></dl></div>
        <div className="review-section source-links"><h3>Fontes</h3>{maps && <a href={maps} target="_blank" rel="noopener noreferrer">Abrir Maps ↗</a>}{site && <a href={site} target="_blank" rel="noopener noreferrer">Ver site ou perfil ↗</a>}{!maps && !site && <p>Não há links de origem disponíveis.</p>}</div></div>
      <div className="review-checklist"><h3>Antes de liberar</h3><p>Confirme atuação em estética, localização em São Paulo, atividade recente e possibilidade de contato com o responsável.</p></div>
      <div className="review-actions">{(['validado','descartado','nao_contatar'] as const).map(choice => <form action={validationAction} key={choice}><input type="hidden" name="lead_id" value={lead.id}/><input type="hidden" name="validation" value={choice}/><input type="hidden" name="return_to" value={returnTo}/><button className={`button ${choice === 'validado' ? 'primary' : choice === 'descartado' ? 'outline' : 'textual'}`}>{choice === 'validado' ? 'Validar e liberar' : choice === 'descartado' ? 'Descartar' : 'Não contatar'}</button></form>)}</div>
    </> : <p className="empty padded">Selecione uma clínica para revisar.</p>}</aside></div>
  </Shell>;
}
