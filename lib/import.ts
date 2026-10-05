import * as XLSX from 'xlsx';

export type ImportedLead = {
  id: string; place_id: string | null; name: string; niche: string | null; lead_class: string | null;
  url_type: string | null; review_count: number | null; rating: number | null; phone: string | null;
  neighborhood: string | null; city: string | null; website_url: string | null;
  instagram_url: string | null; whatsapp_url: string | null; maps_url: string | null;
  maps_status: string | null; source: string | null;
};

const expected = ['ID','Empresa','Nicho','Classe','Tipo de URL','Avaliações','Nota','Telefone','Bairro','Cidade',
  'Website original','Instagram','WhatsApp explícito','Google Maps','Status','Validação','Último contato',
  'Próximo retorno','Próxima ação','Oferta (R$)','Recebido (R$)','Data do PIX','Objeção','Observações',
  'Situação no Maps','Place ID','Fonte'];

function cellText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object') {
    if ('hyperlink' in value) return String(value.hyperlink ?? '').trim() || null;
    if ('text' in value) return String(value.text ?? '').trim() || null;
    if ('result' in value) return String(value.result ?? '').trim() || null;
  }
  return String(value).trim() || null;
}

function num(raw: string | null): number | null {
  if (!raw) return null;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function parseLeadWorkbook(buffer: Buffer): Promise<ImportedLead[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets.Leads;
  if (!sheet) throw new Error('A planilha precisa ter uma aba chamada Leads.');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
  const header = expected.map((_, i) => cellText(rows[7]?.[i]));
  if (header.some((name, i) => name !== expected[i])) throw new Error('As colunas da planilha não correspondem à base Atori.');
  const leads: ImportedLead[] = [];
  const seen = new Set<string>();
  for (let rowNumber = 9; rowNumber <= rows.length; rowNumber++) {
    const row = rows[rowNumber - 1] ?? [];
    const get = (index: number) => cellText(row[index - 1]);
    const id = get(1);
    if (!id) continue;
    if (!/^ATL-[A-Z0-9]{10}$/.test(id)) throw new Error(`ID inválido na linha ${rowNumber}.`);
    if (seen.has(id)) throw new Error(`ID repetido na linha ${rowNumber}.`);
    seen.add(id);
    const name = get(2);
    if (!name) throw new Error(`Empresa vazia na linha ${rowNumber}.`);
    leads.push({
      id, name, niche: get(3), lead_class: get(4), url_type: get(5),
      review_count: num(get(6)), rating: num(get(7)), phone: get(8),
      neighborhood: get(9), city: get(10), website_url: get(11), instagram_url: get(12),
      whatsapp_url: get(13), maps_url: get(14), maps_status: get(25), place_id: get(26), source: get(27)
    });
  }
  if (!leads.length) throw new Error('Nenhuma clínica encontrada.');
  return leads;
}
