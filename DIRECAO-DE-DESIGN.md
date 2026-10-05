# Proposta de direção — Atori Leads

**Estado:** direção aprovada em composição, com pedido de refinamento elegante em preto e branco. As maquetes abaixo são prévias, não uma especificação de implementação.

**Prévias:** [operador no celular](design/previews/operador-mobile-pb.png) · [triagem do gestor no computador](design/previews/gestor-desktop-pb.png). Nomes, telefones, números e estados nas imagens são ilustrativos; não representam clínicas ou resultados confirmados.

## Leitura do produto e da interface atual

O trabalho principal é contínuo: escolher um lead apto, ligar, registrar o que aconteceu e deixar uma próxima ação inequívoca. O operador faz isso no celular. O gestor trabalha em volume, verificando dados de origem e liberando clínicas para essa fila.

A implementação atual cumpre as regras centrais, mas a interface usa a linguagem de um dashboard genérico. Na página inicial, sete indicadores e duas caixas secundárias ocupam grande parte da tela. A mesma composição atende aos dois perfis. Na ficha, o formulário de contato fica na coluna lateral do desktop e desce depois da clínica, da validação e do histórico no celular. Na área do gestor, configuração da demo e convite de operador aparecem antes da fila de validação. Cartões, chips e botões compartilham peso visual parecido, mesmo quando as decisões têm urgência muito diferente.

Esta leitura vem dos componentes e estilos do projeto. A operação conectada ao Supabase ainda não foi observada visualmente nesta análise.

## Tese: mesa de despacho, não painel de indicadores

A interface deve responder primeiro: **quem precisa de ação agora, qual ação, e o que acontece depois?** A inspiração é uma mesa de despacho: uma tarefa assumida em primeiro plano, filas claras ao lado e um registro confiável atrás. A metáfora aparece na ordem da informação e nos estados, sem desenhos literais de telefone, prancheta ou central de chamadas.

O caráter próprio da Atori vem da precisão operacional: dados de origem separados de fatos confirmados, reserva visível, retorno obrigatório quando necessário e uma linha do tempo que qualquer colega entende ao assumir o caso. Não depende de decoração para parecer diferente.

## Arquitetura de informação

### Operador — celular primeiro

1. **Hoje:** reserva em andamento, retornos vencidos e botão **Novo contato**. Indicadores resumidos ficam abaixo, quando úteis; a tela abre com trabalho, não com números.
2. **Contato ativo:** nome e contexto essencial da clínica, telefone e botão **Ligar** em posição imediata. Mostra por que o lead foi liberado e até quando está reservado.
3. **Registrar resultado:** após a chamada, escolher o resultado em opções grandes e diretas. Só então revelar os campos que aquele resultado exige: retorno, observação, WhatsApp confirmado ou avanço da demo.
4. **Conclusão:** confirmar o registro e mostrar a próxima ação criada, com data e responsável ou fila. O operador pode seguir para outro contato.
5. **Retornos:** fila própria, ordenada por atraso e horário, com contexto da última conversa antes de assumir.

### Gestor — computador primeiro

1. **Triagem:** tabela densa, filtros persistentes e ficha de revisão lado a lado. O gestor compara Maps, presença digital, telefone, classe e evidências, e valida ou descarta sem perder a posição na lista.
2. **Operação:** visão de volumes e gargalos: pendentes de validação, disponíveis para primeiro contato, retornos vencidos e demos em andamento. Filtros por período e operador aparecem junto da análise, não no fluxo de chamada.
3. **Administração:** importação, equipe e link da demo em uma área secundária, fora do caminho principal de triagem.

## Direção visual

- **Sistema:** superfícies claras e compactas, linhas de separação nítidas, poucos níveis de elevação e uma faixa de estado para orientar a leitura. A composição se parece mais com uma ferramenta de trabalho bem editada do que com uma coleção de cartões decorativos.
- **Cor:** preto e branco, conforme preferência confirmada pelo usuário. Superfícies brancas e cinzas muito claros, texto preto ou grafite, ação principal preta. Estados de retorno vencido, confirmação, bloqueio, classe e etapa comercial exigem rótulo, forma e contraste próprios; nenhum depende apenas de cor.
- **Tipo:** uma família sans legível para títulos, controles e dados; números tabulares para horários, contagens e telefone. Hierarquia por tamanho, peso e espaço, evitando títulos enormes e rótulos em caixa alta em excesso.
- **Forma:** botões e campos consistentes, alvos confortáveis para o polegar, estados de foco visíveis. Ícones apenas quando encurtam a leitura; texto acompanha ações críticas.
- **Movimento:** curto e funcional. Assumir um lead, salvar um resultado e agendar um retorno devem dar feedback claro; nada de animações de entrada que atrasem a ligação.

## Telas e momentos decisivos

| Momento | Tratamento proposto |
| --- | --- |
| Nenhum lead elegível | Explicar se faltam validações, telefones ou leads inéditos; orientar o operador para retornos disponíveis. |
| Lead reservado | Exibir responsável, prazo e opção de devolver sem tentativa. A expiração não deve parecer uma ligação registrada. |
| Ligação não atendida | Exigir a data do retorno no mesmo fluxo, com o contexto de primeira ou segunda tentativa. |
| Segunda tentativa | Mostrar WhatsApp apenas com canal confirmado; pedir confirmação do envio e novo retorno. |
| Demo | Mostrar as três etapas separadas: aceitou, link enviado e apresentação agendada. |
| Gestor validando | Diferenciar dado importado de verificação humana; decisões de validar, descartar e não contatar não devem parecer equivalentes. |

## Critérios para avaliar o redesenho

1. No celular, um operador chega a **Ligar** e depois a **Salvar resultado** sem atravessar blocos de gestão ou histórico extenso.
2. Após salvar, o próximo passo do lead está visível, com horário em São Paulo.
3. No desktop, o gestor revisa vários leads sem voltar repetidamente à lista ou perder filtros.
4. Estados de fila, reserva, retorno vencido, bloqueio e demo são distinguíveis por texto e forma, sem depender só de cor.
5. A interface mantém a mesma gramática em login, operação, triagem e administração, mas dá prioridades diferentes a cada perfil.

## Sequência sugerida

1. Desenhar uma composição do **contato ativo no celular** e outra da **triagem no desktop**. Essas duas telas definem o sistema.
2. Validar a hierarquia e os estados com dados reais da base, incluindo nomes longos, telefone ausente, retornos e histórico extenso.
3. Aplicar o sistema às demais telas e só então documentar tokens e componentes em `DESIGN.md`.

**Limite da proposta:** preserva as regras comerciais e de segurança já implementadas. Mudanças na navegação e na disposição das informações podem exigir rotas ou componentes novos; isto ainda não é uma alteração de código.
