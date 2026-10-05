# Atori · Dashboard de Leads

Web app responsivo para validar clínicas, distribuir ligações entre operadores e acompanhar retornos e demos. A base inicial contém 555 clínicas em `data/clinics.json`, extraídas de `../outputs/01a0e45d-4a0c-7e71-8526-3145853b11c2/leads-clinicas.xlsx`.

## Configuração

1. Crie um projeto Supabase e execute `supabase/schema.sql` no SQL Editor.
2. Copie `.env.example` para `.env.local` e preencha URL, chave pública, chave secreta e URL do app. A chave secreta só é usada no servidor para convidar usuários e carregar a base.
3. Crie seu usuário em **Authentication → Users** no Supabase. O gatilho do banco cria o perfil como operador. Promova-o com `update public.profiles set role = 'gestor' where email = 'seu@email.com';` no SQL Editor.
4. Rode `npm install`, `npm run seed` e `npm run dev`. A importação inicial é idempotente: repetir o seed atualiza somente campos de origem.
5. Em **Authentication → URL Configuration**, configure a URL do app e permita o redirecionamento `https://seu-dominio/auth/callback`. Convites para operadores são enviados pelo painel do gestor.
6. Publique a pasta `lead-dashboard` como projeto Next.js em sua hospedagem e configure as mesmas variáveis de ambiente. Atualize `NEXT_PUBLIC_SITE_URL` para a URL HTTPS publicada e cadastre esse redirecionamento no Supabase.

Até configurar o Supabase, o app compila, mas o login e as filas não funcionam. A demo também precisa de um link público HTTPS configurado em **Gerenciar operação** antes de registrar envios.

## Regras operacionais

- O gestor valida cada clínica. Apenas leads validados, com telefone e ainda não abordados entram em **Novo contato**.
- **Novo contato** escolhe aleatoriamente e reserva o lead por 15 minutos. A mesma reserva aparece novamente para seu operador até ser concluída, liberada ou expirar. Dois operadores não recebem o mesmo lead.
- **Não liguei** exige motivo, libera a reserva e não conta tentativa. O discador do celular não confirma que uma ligação ocorreu; a tentativa só conta quando o resultado é salvo.
- Ligação sem resposta e pedido de retorno exigem uma data futura. Na segunda tentativa sem resposta, o app sugere WhatsApp somente se a base trouxer um link explícito. O operador envia manualmente, confirma o envio e agenda novo retorno.
- A fila de retornos vencidos é compartilhada. Aceite da demo, envio do link e apresentação agendada são registros independentes.
- Uma nova importação XLSX, feita pelo gestor, concilia pelo ID e preserva validação, atividades, demos e retornos. A planilha precisa manter a aba `Leads` e as 27 colunas da base Atori.

## Verificação

`npm test` testa a leitura dos 555 IDs reais e executa as funções SQL em um Postgres local de testes: distribuição, expiração, segunda tentativa, WhatsApp e reimportação. `npm run typecheck` e `npm run build` verificam o app. Após conectar seu Supabase, use dois logins de operador para o teste simultâneo real e faça o fluxo completo em um celular: discador, resultado, retorno e demo.

Os horários exibidos e informados no app usam `America/Sao_Paulo`. Ligações e mensagens são manuais; não há integração com serviços de telefonia ou envio automático.
