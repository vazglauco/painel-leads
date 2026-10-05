export function dateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

export function phoneHref(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits ? `tel:+${digits}` : undefined;
}

export function safeExternal(url: string | null | undefined) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : undefined;
  } catch { return undefined; }
}

export function statusLabel(status: string | null | undefined) {
  const labels: Record<string,string> = {
    novo: 'Sem abordagem', sem_resposta: 'Sem resposta', conversou: 'Conversou', retorno: 'Pediu retorno',
    recusou: 'Recusou', nao_contatar: 'Não contatar', pendente: 'Pendente', validado: 'Validado', descartado: 'Descartado',
    demo_aceite: 'Aceitou receber a demo', demo_enviado: 'Link da demo enviado', demo_agendado: 'Apresentação agendada',
    reservado_novo: 'Novo contato assumido', reservado_retorno: 'Retorno assumido', liberado: 'Devolvido à fila',
    validacao_validado: 'Lead validado', validacao_descartado: 'Lead descartado', validacao_nao_contatar: 'Marcado para não contatar'
  };
  return labels[status ?? ''] ?? status ?? '—';
}
