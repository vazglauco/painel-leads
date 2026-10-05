import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { parseLeadWorkbook } from '@/lib/import';

const target = (request: NextRequest, key: 'error' | 'ok', message: string) => {
  const url = new URL('/admin/import', request.url);
  url.searchParams.set(key, message);
  return NextResponse.redirect(url, 303);
};

export async function POST(request: NextRequest) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return target(request, 'error', 'Faça login antes de importar.');
  const { data: profile } = await db.from('profiles').select('role,active').eq('id', user.id).single();
  if (!profile?.active || profile.role !== 'gestor') return target(request, 'error', 'Acesso restrito ao gestor.');
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.xlsx') || file.size > 10 * 1024 * 1024)
    return target(request, 'error', 'Selecione um XLSX de até 10 MB.');
  try {
    const leads = await parseLeadWorkbook(Buffer.from(await file.arrayBuffer()));
    for (let i = 0; i < leads.length; i += 100) {
      const { error } = await db.rpc('import_leads', { p_rows: leads.slice(i, i + 100) });
      if (error) throw error;
    }
    return target(request, 'ok', `${leads.length} clínicas processadas. Histórico preservado.`);
  } catch (error) {
    return target(request, 'error', error instanceof Error ? error.message : 'Falha na importação.');
  }
}
