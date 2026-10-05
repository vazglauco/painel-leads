'use client';

import { useState } from 'react';
import { recordCallAction } from '@/app/actions';

const results = [
  { value: 'sem_resposta', label: 'Não atendeu', hint: 'Agendar nova tentativa' },
  { value: 'conversou', label: 'Conversou', hint: 'Registrar o que foi combinado' },
  { value: 'retorno', label: 'Pediu retorno', hint: 'Escolher dia e horário' },
  { value: 'recusou', label: 'Recusou', hint: 'Encerrar abordagem' },
  { value: 'nao_contatar', label: 'Não contatar', hint: 'Bloquear novas tentativas' }
] as const;

export function CallForm({ leadId, attempts, whatsappUrl, demoUrl, alreadyAccepted }: { leadId: string; attempts: number; whatsappUrl?: string; demoUrl?: string; alreadyAccepted: boolean }) {
  const [outcome, setOutcome] = useState('');
  const [demoAccepted, setDemoAccepted] = useState(false);
  const followupRequired = outcome === 'sem_resposta' || outcome === 'retorno';
  const canSuggestWhatsApp = outcome === 'sem_resposta' && attempts + 1 >= 2 && !!whatsappUrl;
  const conversation = outcome === 'conversou' || outcome === 'retorno';
  return <form action={recordCallAction} className="call-form">
    <input type="hidden" name="lead_id" value={leadId}/>
    <fieldset className="result-fieldset"><legend>Resultado da ligação</legend><p>Selecione o que aconteceu após ligar para a clínica.</p>
      <div className="result-options">{results.map(result => <label className={`result-option ${outcome === result.value ? 'selected' : ''}`} key={result.value} onClick={() => setOutcome(result.value)}>
        <input type="radio" name="outcome" value={result.value} checked={outcome === result.value} onChange={() => setOutcome(result.value)} required/>
        <span className="result-indicator" aria-hidden="true"/><span><strong>{result.label}</strong><small>{result.hint}</small></span><span className="result-chevron" aria-hidden="true">›</span>
      </label>)}</div></fieldset>
    {followupRequired && <section className="conditional-section"><label>Próximo retorno <span className="required">*</span><input type="datetime-local" name="followup_at" required/><small>Horário de São Paulo. O retorno entrará na fila compartilhada.</small></label></section>}
    {canSuggestWhatsApp && <section className="conditional-section"><h3>WhatsApp confirmado</h3><p>Esta é a segunda tentativa sem resposta. Se enviar uma mensagem manualmente, confirme o envio abaixo.</p><a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="button outline">Abrir WhatsApp ↗</a><label className="check-line"><input type="checkbox" name="whatsapp_sent"/> Mensagem enviada</label></section>}
    {outcome === 'sem_resposta' && attempts + 1 >= 2 && !whatsappUrl && <p className="inline-note">Não há WhatsApp confirmado para esta clínica. Agende outra ligação.</p>}
    {conversation && <section className="conditional-section"><h3>Avanço da demo</h3>{alreadyAccepted ? <p>O aceite da demo já foi registrado.</p> : <label className="check-line"><input type="checkbox" name="demo_accepted" checked={demoAccepted} onChange={e => setDemoAccepted(e.target.checked)}/> Aceitou receber a demo</label>}
      {demoUrl ? <><a href={demoUrl} target="_blank" rel="noopener noreferrer" className="text-link">Abrir link da demo ↗</a><label className="check-line"><input type="checkbox" name="demo_sent" disabled={!demoAccepted && !alreadyAccepted}/> Link enviado manualmente</label></> : <p>O gestor precisa configurar o link público para registrar o envio.</p>}
      <label>Apresentação agendada<input type="datetime-local" name="presentation_at"/><small>Preencha apenas se a data foi combinada.</small></label></section>}
    {outcome && <label className="note-field">Observações<textarea name="note" rows={4} maxLength={2000} placeholder="Com quem falou e o que o próximo operador precisa saber"/></label>}
    <div className="form-footer"><button className="button primary" type="submit" disabled={!outcome}>Salvar resultado</button></div>
  </form>;
}
