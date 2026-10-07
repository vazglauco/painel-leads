// Gera data/clinics.json a partir das exportações Outscraper de estética, com a triagem v2.
// Uso: node scripts/classify.mjs   (depois: npm run seed)
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';

const sources = [
  '../../fontes/outscraper/Outscraper-20260914034307s75d3.xlsx',
  '../../fontes/outscraper/Outscraper-20260927202445s6264.xlsx'
];

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const idFor = (placeId) => 'ATL-' + crypto.createHash('sha1').update(String(placeId)).digest('hex').slice(0, 10).toUpperCase();
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

const socialHosts = ['instagram.com', 'facebook.com', 'wa.me', 'whatsapp.com', 'linktr.ee', 'bit.ly', 'beacons.ai', 'bio.site',
  'tiktok.com', 'contate.me', 'sites.google.com', 'linkme.bio', 'clini.site', 'g.page', 'google.com', 'tinyurl.com', 'lnk.bio', 'taplink'];
const offNicheTypes = ['dental', 'dentist', 'oral surgeon', 'eye care', 'physical therapist', 'hair', 'nail', 'barber', 'tattoo',
  'piercing', 'optic', 'veterin', 'pet', 'ophthal', 'cardiolog', 'massage', 'chiropract', 'car wash', 'auto'];
const offNicheNames = /dent|odonto|ortodont|oftalm|veicular|automov|massoterap|quiropra|fisioter|sport|pilates|barbear|tatuag|piercing|unha|nail|cabelo|hair/;
const chains = /espacolaser|vialaser|laserplus|miess|botoclinic|ana\s?hickmann|dr\.?\s?consulta/;

const tier = (n, r) => (n >= 50 && r >= 4.5 ? 'A+' : n >= 30 && r >= 4.2 ? 'A' : n >= 10 && r >= 4.0 ? 'B' : 'C');

// Preserva os IDs já existentes (e o histórico no Supabase) quando o place_id é o mesmo.
const dataFile = new URL('../data/clinics.json', import.meta.url);
const existingIds = new Map();
try { for (const l of JSON.parse(await fs.readFile(dataFile, 'utf8'))) if (l.place_id) existingIds.set(l.place_id, l.id); } catch {}

const byPlace = new Map();
for (const file of sources) {
  const wb = XLSX.read(await fs.readFile(new URL(file, import.meta.url)));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const name = file.split('/').pop();
  rows.forEach((x, i) => { if (x.place_id) byPlace.set(x.place_id, { x, source: `${name} — linha ${i + 2}` }); });
}

const out = [];
for (const { x, source } of byPlace.values()) {
  const host = hostOf(x.website);
  const presenca = !x.website ? 'Sem site no Maps' : socialHosts.some((s) => host.includes(s)) ? 'Só rede social ou link' : 'Site próprio';
  const phone = String(x.phone ?? '').trim() || null;
  const n = Number.isFinite(Number(x.reviews)) && x.reviews !== '' && x.reviews != null ? Number(x.reviews) : null;
  const r = Number.isFinite(Number(x.rating)) && x.rating !== '' && x.rating != null ? Number(x.rating) : null;
  const inSaoPaulo = x.city === 'São Paulo' && /\bSP\b/.test(x.address ?? '');

  const motivos = [];
  if (x.business_status !== 'OPERATIONAL') motivos.push('Não operacional no Maps');
  if (!inSaoPaulo) motivos.push('Fora da capital');
  if (offNicheTypes.some((k) => norm(x.type).includes(k)) || offNicheNames.test(norm(x.name))) motivos.push('Fora do nicho');
  if (chains.test(norm(x.name) + host)) motivos.push('Rede ou franquia');
  if (!phone) motivos.push('Sem telefone');
  if (presenca === 'Site próprio') motivos.push('Site próprio');
  if (n == null || r == null) motivos.push('Sem avaliações');

  const lead_class = motivos.length ? 'Revisar' : tier(n, r);
  out.push({
    id: existingIds.get(x.place_id) ?? idFor(x.place_id), name: x.name, niche: 'Estética', lead_class,
    url_type: motivos.length ? `Revisar: ${motivos.join(', ')}` : presenca,
    review_count: n, rating: r, phone, neighborhood: x.county || null, city: x.city || null,
    website_url: x.website || null,
    instagram_url: host.includes('instagram.com') ? x.website : null,
    whatsapp_url: /wa\.me|whatsapp\.com/.test(host) ? x.website : null,
    maps_url: x.location_link || null, maps_status: x.business_status || null, place_id: x.place_id, source
  });
}

await fs.writeFile(dataFile, JSON.stringify(out, null, 1));
const count = {};
out.forEach((o) => { count[o.lead_class] = (count[o.lead_class] || 0) + 1; });
console.log(out.length, 'leads', count);
