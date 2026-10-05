import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local.');
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const leads = JSON.parse(await fs.readFile(new URL('../data/clinics.json', import.meta.url), 'utf8'));
let imported = 0;
for (let i = 0; i < leads.length; i += 100) {
  const { data, error } = await db.rpc('import_leads', { p_rows: leads.slice(i, i + 100) });
  if (error) throw new Error(`Lote ${Math.floor(i / 100) + 1}: ${error.message}`);
  imported += data;
}
console.log(`${imported} clínicas processadas. Reexecutar preserva o histórico.`);
