import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { Shell } from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { profile } = await requireProfile(true);
  const params = await searchParams;
  return <Shell profile={profile}><div className="back-row"><Link href="/admin">← Voltar à triagem</Link></div>
    <section className="page-heading"><div><h1>Importar planilha</h1><p>Atualize os dados de origem sem perder as atividades comerciais.</p></div></section>
    {params.error && <div className="alert error" role="alert">{params.error}</div>}{params.ok && <div className="alert success" role="status">{params.ok}</div>}
    <section className="surface-section import-card"><h2>Arquivo XLSX da Atori</h2><p>Use a planilha de clínicas com as 27 colunas originais. Novos IDs entram como pendentes; IDs existentes conservam validação, tentativas, demos e retornos.</p>
      <form action="/api/import" method="post" encType="multipart/form-data" className="stack"><label>Selecione o arquivo<input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label><button className="button primary">Importar clínicas</button></form>
      <small>Limite: 10 MB. O arquivo não fica armazenado no servidor.</small></section>
  </Shell>;
}
