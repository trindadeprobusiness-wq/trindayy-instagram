# Entrega técnica · Publicador Trindayy

Referência: 17/10/2026, America/Sao_Paulo. Pasta: `C:\Users\Gabri\trindayy-instagram`.

**Estado:** implementação e testes seguros concluídos; produção bloqueada pela autenticação Meta. Três workflows criados e inativos. Nenhuma publicação real ou envio de e-mail.

## A–B. Destino e ambiente encontrado

O perfil logado no navegador é **@trindayy**, com nome **Gabriel Trindade | Software & Growth** e painel profissional. O Facebook administrador é **Evandro Lopes**, confirmado pelo Gabriel. A menção a “Trymore” foi confrontada com o perfil efetivamente logado; nenhum outro Instagram foi associado por suposição.

A instância é `carteiraemdia.app.n8n.cloud`. A credencial Meta antiga lista somente Carteira em Dia / @carteiraemdia.com.br, conforme leitura real da execução 46. O quadro editorial do Gabriel no Trello, o calendário antigo de carrosséis em revisão e os outros repositórios foram preservados.

## C–D. Implementação e recursos

Você produz o conteúdo → painel local para arquivos e legendas → aprovação explícita → GitHub público → importador n8n → fila independente → publicação às 10h, 12h e 18h → histórico próprio. Somente feed; vídeos são Reels compartilhados no feed. Sem Stories e sem geração de conteúdo.

| Recurso | Endereço / ID |
|---|---|
| Repositório | [trindayy-instagram](https://github.com/trindadeprobusiness-wq/trindayy-instagram) |
| Branch de conteúdo | `codex/conteudo-instagram` |
| Entrada de lotes, 12 nodes | [zwfHKRhNGQCkw4R0](https://carteiraemdia.app.n8n.cloud/workflow/zwfHKRhNGQCkw4R0) |
| Publicador, 55 nodes | [bg5S4mztf93XANwM](https://carteiraemdia.app.n8n.cloud/workflow/bg5S4mztf93XANwM) |
| Resumo diário, 9 nodes | [MpnaDpZIM0HvbgYH](https://carteiraemdia.app.n8n.cloud/workflow/MpnaDpZIM0HvbgYH) |
| Diagnóstico somente leitura | [HdybZ75WJco4q4bE](https://carteiraemdia.app.n8n.cloud/workflow/HdybZ75WJco4q4bE) |
| Fila técnica | `trindayy_fila` / `tdyQa5PC5YGhLt7P` |
| Histórico | `trindayy_publicacoes` / `siY3iPdRKYx57qgE` |
| Credencial nova, vazia | `Meta Trindayy · PENDENTE` / `NNKiWPk9kas3yrBU` |
| Painel local | http://127.0.0.1:4187 |

Os JSONs completos e importáveis estão em `workflows/`; schema e exemplo de rascunho em `schema/` e `examples/`. O código foi implementado separadamente do NEXOOLS. O README contém instruções semanais, configuração e recuperação.

## E–F. Fidelidade e diferenças

Preservados da referência: horários, timezone, aprovação `pronto_para_postar`, IMAGE/REELS/CAROUSEL, parâmetros conceituais Meta, criação de containers, polling, Data Tables, alertas Gmail e variáveis `data_forcada`/`slot_forcado`. A versão `v24.0` foi mantida.

Alterações necessárias: retirada de Stories; entrada por lotes e fila semanal; distribuição uniforme sem repetir peças; identidade conferida na API; URLs públicas validadas por HEAD; histórico exclusivo; reserva durável com eleição entre execuções; gravação de intenção antes de publicar; ID publicado salvo antes do permalink; bloqueio de produção por padrão. URLs com nomes SHA256 dispensam o purge de CDN do original.

Com 21 peças há três posts por dia. Com sete há um por dia às 12h; com 14 há dois por dia às 10h e 18h. O excedente segue nas semanas seguintes. A adaptação reimplementa a lógica a partir da referência e documenta as diferenças; não é apresentada como cópia literal sem alterações.

## G. Integrações efetivamente conectadas

GitHub público e manifesto vazio criados após autorização; URL pública retornou HTTP 200. O n8n leu e normalizou o manifesto na execução 57. Data Tables foram lidas e gravadas de fato nos testes. O painel usa o login GitHub existente pelo Git Credential Manager, sem solicitar tokens.

Todos os nodes Meta do publicador usam o cadastro exclusivo vazio; a credencial da referência foi removida deles. Gmail está associado, com envio desligado. Trello permanece como quadro editorial, com campo opcional `trello_url`; não foi implementada sincronização automática de cards.

## H. Testes e evidências

**31 testes locais passaram, zero falhas.** Abrangem distribuição, excedentes, horários ocupados, deduplicação, versão aprovada, Stories, carrosséis, mídia ausente, URLs, status HTTP, reserva sob concorrência, limites de polling, timezone e controles do painel. Comando: `node --test tests/*.test.mjs`.

Os três códigos SDK foram validados no n8n, sem erros ou avisos na rodada final. Fuso, histórico de execução, agrupamentos e limite de 300s foram salvos.

| Execução n8n | Evidência |
|---|---|
| 46 | Leitura real das contas acessíveis pelo token antigo: somente Carteira em Dia |
| 47–49 | Importador vazio, horário sem peça e resumo diário sem envio externo |
| 50 → 51 | Falha do global URL no sandbox corrigida; depois, lote fictício distribuído e gravado com sucesso |
| 53 | Reimportação do lote retornou zero peças novas |
| 54 | Seleção por data/slot forçados e registro simulado de REELS, sem publicação |
| 55 → 57 | JSON do GitHub servido como texto foi normalizado; leitura real passou após correção |
| 56 | Peça fictícia marcada `teste_encerrado`, fora da seleção produtiva |
| 58 | Simulação final do publicador com fila de teste fixada; sucesso |
| 59 | Falha esperada: tentativa sem autorização/ID foi bloqueada antes da API Meta |

As aprovações em fixtures são dados sintéticos de teste e não aprovam conteúdo real. `evidencias/verificacao-final.json` contém apenas resultados resumidos, sem dados de autenticação.

**Não executados:** autenticação API @trindayy, container real, processamento de vídeo real, publicação/permalink reais, envio de e-mail e gatilhos automáticos. Carrossel lento sob o limite da instância também precisa de homologação. Esses pontos não são classificados como aprovados.

## I. Pendências

O assistente do app **Trindayy Publicador** foi preenchido, sem portfólio associado arbitrariamente, e o aceite dos termos foi autorizado. Ao criar, a Meta exigiu reconfirmação de senha do Facebook. **Não há App ID confirmado.** O proprietário deve concluir a autenticação na aba Meta, sem enviar senha no chat.

Depois, é necessário obter o acesso API da conta profissional @trindayy e preencher a credencial exclusivamente no n8n; conferir o ID Instagram retornado pela API; fornecer uma peça real aprovada; autorizar seu teste real e, após validação, a ativação da rotina. Notificações exigem teste autorizado de envio.

O publicador mantém Facebook Login e os nodes Graph API da referência. Se for escolhido Instagram Login direto, host, permissões e autenticação precisam ser adaptados e validados antes da ativação. Login no Instagram pelo navegador não fornece automaticamente credencial API ao n8n.

## J. Operação e recuperação

Abra `Abrir Painel.cmd` para enviar lotes. Colocar um MP4 isolado no GitHub não basta: é necessário cadastrá-lo no manifesto com legenda, hash, versão e aprovação; o painel faz isso. O importador, quando ativado, verifica o repositório a cada hora, às `xx:05`.

Para cancelar uma peça, altere o `estado` da fila para `cancelado` antes do horário. Alterações no manifesto não substituem automaticamente a cópia aprovada já enfileirada. Em timeout de publicação, preserve a reserva e confira o Instagram antes de qualquer nova tentativa. Um ID publicado requer recuperar o permalink, sem republicar.

Limites: 95 MB por arquivo no painel; carrossel de 2 a 10 slides; espera de 15s e até 16 consultas por container; instância limitada a 300s por execução. Carrosséis lentos podem esgotar esse tempo e exigir reconciliação manual. A reserva bloqueia repetição automática.

O Error Trigger está no próprio publicador, comportamento suportado pela [documentação oficial n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.errortrigger/). Atua em execuções automáticas; falhas manuais ficam na execução. Não foi ativado um handler compartilhado.

O original foi comparado por versão, nodes e conexões e permaneceu idêntico e ativo, versão `4b1a802a-a2a4-4ff5-8620-b7ee16c14077`. O JSON original preservou SHA256 `5B7E93AECB3D44BEF2AC89477196DD47502094B1103DC0271753854B67B5A9A3`. Nenhum novo gatilho foi ativado.
