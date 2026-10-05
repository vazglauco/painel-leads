import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parseLeadWorkbook } from '../lib/import.ts';

const source = new URL('../../outputs/01a0e45d-4a0c-7e71-8526-3145853b11c2/leads-clinicas.xlsx', import.meta.url);

test('a planilha real contém 555 clínicas únicas e preserva links explícitos', async () => {
  const leads = await parseLeadWorkbook(await fs.readFile(source));
  assert.equal(leads.length, 555);
  assert.equal(new Set(leads.map(lead => lead.id)).size, 555);
  assert.ok(leads.every(lead => lead.name && lead.id.startsWith('ATL-')));
  assert.ok(leads.some(lead => lead.whatsapp_url));
  assert.ok(leads.some(lead => !lead.whatsapp_url));
});

test('rejeita um arquivo que não é a base Atori', async () => {
  await assert.rejects(parseLeadWorkbook(Buffer.from('não é XLSX')));
});
