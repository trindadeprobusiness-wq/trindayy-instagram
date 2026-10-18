# Publicador Instagram · Trindayy

Você cria os vídeos e as imagens. Esta automação recebe os lotes aprovados, distribui o conteúdo pela semana e prepara a publicação no **@trindayy**, sem Stories e sem geração de conteúdo.

**Estado em 18/10/2026:** aplicativo Trindayy existente; publicador adaptado ao Instagram Login direto, com 35 testes locais aprovados e simulação no n8n. Os três workflows continuam **inativos**. A consulta real de identidade ainda retorna erro 190 (`Invalid OAuth 2.0 Access Token`); aguarda correção do token no n8n. Não houve publicação real.

## Uso semanal

1. Abra `Abrir Painel.cmd` nesta pasta, ou execute `npm run painel` e acesse <http://127.0.0.1:4187>.
2. Selecione seus MP4 ou JPEG. O arquivo fica local até você aprovar o envio. O painel não cria nem edita vídeos.
3. Escreva a legenda de cada peça e veja a prévia.
4. Marque a aprovação explícita do lote e clique em **Enviar lote aprovado ao repositório**. Esse envio torna os arquivos e as legendas públicos no GitHub. Nenhum token é solicitado no painel: ele usa o login existente do Git Credential Manager.
5. Após a ativação autorizada, o importador verifica o manifesto de hora em hora, às `xx:05`, e acrescenta as peças novas à fila.
6. O publicador consulta a fila às **10h, 12h e 18h**, todos os dias, em `America/Sao_Paulo`. Vídeos são enviados como Reels com `share_to_feed=true`, aparecendo também no feed. Imagens e carrosséis usam os tipos correspondentes da API.

Com 21 peças, são três posts por dia durante sete dias. Com sete peças, uma por dia às 12h. Com 14, duas por dia, às 10h e 18h. Com menos de 21, a automação distribui as peças pelos sete dias sem repeti-las. Com mais de 21, o restante segue para as semanas seguintes. Por padrão, um lote começa no dia seguinte ao envio; você pode informar outra data futura. Os horários já reservados são preservados. A prévia local não consulta a fila remota, portanto horários finais podem diferir se houver reservas existentes.

O painel trata cada arquivo como um post. Para carrosséis, use o manifesto JSON pelo formulário autenticado do n8n ou pelo repositório, com as mídias ordenadas. A interface de composição visual de carrossel não faz parte desta versão.

## Recursos criados

| Recurso | Identificação |
|---|---|
| Repositório público | [trindayy-instagram](https://github.com/trindadeprobusiness-wq/trindayy-instagram) |
| Manifesto de conteúdos | [conteudos.json](https://github.com/trindadeprobusiness-wq/trindayy-instagram/blob/codex/conteudo-instagram/conteudos.json) |
| Importador de lotes | [Instagram · Entrada de lotes Trindayy](https://carteiraemdia.app.n8n.cloud/workflow/zwfHKRhNGQCkw4R0) |
| Publicador | [Instagram · Publicador Trindayy](https://carteiraemdia.app.n8n.cloud/workflow/bg5S4mztf93XANwM) |
| Resumo diário | [Instagram · Programação diária Trindayy](https://carteiraemdia.app.n8n.cloud/workflow/MpnaDpZIM0HvbgYH) |
| Diagnóstico de conexão, somente leitura | [Trindayy · Verificar conexão Meta](https://carteiraemdia.app.n8n.cloud/workflow/HdybZ75WJco4q4bE) |
| Fila n8n | `trindayy_fila` / `tdyQa5PC5YGhLt7P` |
| Histórico n8n | `trindayy_publicacoes` / `siY3iPdRKYx57qgE` |
| Credencial Instagram Login | `Header Auth account` / `ulnMSHSbRKQBLRKC` |

O formulário de entrada exige login n8n e acesso de execução ao projeto. Não há endpoint público anônimo que aceite conteúdos para a conta. Enquanto o workflow estiver inativo, use o formulário de teste no editor ou a execução manual via conector; o formulário de produção requer ativação.

## Estrutura e fonte dos conteúdos

```text
conteudos.json                 manifesto publicado na branch de conteúdo
midias/<sha256>.mp4            arquivos aprovados e com nome estável
examples/lote-rascunho.json    exemplo que nunca entra na fila aprovado
schema/calendario.schema.json contrato do manifesto
src/core.mjs                  aprovação, validação, agenda e parâmetros Meta
scripts/painel.mjs            painel local de upload e revisão
scripts/build-workflows.mjs   gera JSON importável e código SDK
workflows/*.json              arquivos completos para importar no n8n
workflows/*.sdk.js            fontes para validação no conector n8n
privado/                      uploads locais e cópias de lote; ignorados no Git
```

A branch de conteúdo é `codex/conteudo-instagram`. Colocar apenas um MP4 avulso no GitHub não basta: o arquivo precisa entrar em um lote do `conteudos.json`, com legenda, SHA256, versão e aprovação. O painel faz isso ao enviar o lote. Também é possível editar o manifesto diretamente, seguindo o schema e respeitando a aprovação.

As mídias precisam ter URL HTTPS pública e estável, sem token ou query string. Os hosts permitidos inicialmente são `raw.githubusercontent.com` e `cdn.jsdelivr.net`. Configure outros hosts explicitamente em `config.json` antes de usá-los. O armazenamento GitHub desta versão limita cada arquivo a 95 MB; vídeos maiores exigem outro armazenamento. O painel verifica se MP4 contém vídeo reproduzível usando `ffprobe`, sem recodificar nem criar conteúdo.

O Trello existente do Gabriel continua sendo o quadro editorial. O campo opcional `trello_url` vincula cada peça ao card correspondente. A fila do n8n é estado técnico de entrega; não foram criados novos cards nem alteradas listas do Trello. O calendário antigo de 60 carrosséis, sem conta definida e em revisão, não foi importado como conteúdo aprovado.

## Aprovação e prevenção de duplicidade

Somente `status=pronto_para_postar`, com `aprovacao.por=Gabriel`, data e versão exata, pode entrar na fila. Rascunhos e peças em revisão são ignorados. Falta de mídia, formato inválido, carrossel incompleto, mais de um post no mesmo horário e conta divergente bloqueiam a operação.

O importador ignora IDs e fingerprints já registrados e preserva os horários existentes. Antes de publicar, o workflow confere `user_id` e `username` retornados pela Meta e valida as URLs públicas por HEAD. No Instagram Login, o `id` pode ser relativo ao aplicativo; o destino de publicação deve usar o `user_id` profissional. A identidade deve corresponder ao @trindayy e ao ID configurado; não basta existir uma credencial.

Cada tentativa real registra uma reserva durável antes da criação do container. Em concorrência, somente a menor ID de reserva dessa peça pode avançar. As reservas não expiram automaticamente. A intenção de publicação é gravada antes de `media_publish`; o ID publicado é salvo imediatamente depois, antes da consulta de permalink. Se houver timeout ou resultado ambíguo, o workflow não repete a publicação automaticamente. Isso prefere bloquear uma peça para revisão a correr o risco de publicar duas vezes.

Não exclua reservas ou histórico para “tentar de novo”. Primeiro consulte a execução e o Instagram. Se já houver `ig_media_id`, recupere apenas o permalink. Se não houver confirmação da Meta, reconcilie o container e a conta antes de qualquer reabertura manual.

Alterar legenda, arquivo ou versão de uma peça já enfileirada não substitui a cópia aprovada da fila. Para cancelar ou corrigir, primeiro mude seu `estado` na Data Table para `cancelado` e revise a nova versão. A edição de fila pelo painel e a sincronização bidirecional com Trello não estão implementadas.

## Configuração Meta e ativação

Contas verificadas durante a configuração:

- Instagram logado no navegador: **@trindayy**, nome **Gabriel Trindade | Software & Growth**, com painel profissional.
- Facebook administrador: **Evandro Lopes**, confirmado pelo Gabriel.
- Credencial antiga do n8n: acesso somente à página Carteira em Dia e ao **@carteiraemdia.com.br**. Ela não é usada nos nodes de publicação do Trindayy.

Foi confirmado no navegador o app **Trindayy**, Meta App ID `1611956463109278`, Instagram App ID `1305433924981111`, com o caso de uso Instagram. Gabriel aceitou o convite de testador do Instagram. O publicador usa **Instagram Login direto**: oito operações HTTP em `https://graph.instagram.com/v24.0`, com a credencial Header Auth exclusiva. A consulta de identidade é `GET /me?fields=user_id,username`; criação de mídia e publicação usam corpo JSON e não repetem POST automaticamente. A [documentação oficial de publicação](https://developers.facebook.com/documentation/instagram-platform/content-publishing) descreve o host e as permissões desse login.

O painel Meta lista @trindayy com ID `17841479648607267`. `instagram_business_basic` já estava pronta para teste; `instagram_business_content_publish` foi adicionada com autorização explícita do Gabriel e confirmada como pronta para teste. Essa configuração não confirma as permissões contidas no token salvo nem resolve o erro 190 por si só. Gere e autorize um token atualizado antes de repetir a consulta. O ID observado no painel ainda não foi confirmado pela API.

Para concluir a conexão e homologar:

1. No caso de uso Instagram do app Trindayy, configure `instagram_business_basic` e `instagram_business_content_publish`. Aceitar a função de testador não comprova que o token possui essas permissões.
2. Gere o token da conta @trindayy em **Configuração da API com login do Instagram**. Não usar token do Facebook, chave secreta do app ou token da Carteira em Dia.
3. Na credencial `Header Auth account`, preencha o campo **Name** com `Authorization` e **Value** com `Bearer ` seguido do token completo. O nome visível da credencial é separado do campo Name. Nunca inclua tokens em código, manifesto, chat, Git ou exportação JSON.
4. Execute **Trindayy · Verificar conexão Meta**. Só prossiga se o resultado seguro retornar `conectado=true`, `username=trindayy` e `ig_user_id` profissional. Depois preencha esse ID em `config.json` e nos nodes Config dos workflows. `ig_user_id` está vazio até a validação real.
5. Consulte o limite de publicação da conta por GET antes de autorizar um teste real. Registre o prazo de expiração informado na geração do token e providencie sua renovação no n8n antes do vencimento; não há renovação automática nesta entrega.
6. Envie uma peça real com aprovação explícita. Rode a seleção em modo de teste com `data_forcada` e `slot_forcado` e confira todos os parâmetros e o destino.
7. Depois da aprovação específica para o teste real e da verificação da conta, autorize a publicação dessa peça. Remova as variáveis forçadas e configure `modo_teste=false` e `publicacao_autorizada=true`. O bloqueio exige execução de produção; execução manual comum não publica.
8. Ative os gatilhos somente com autorização. Ative o importador antes do publicador e confira a fila preenchida. O resumo diário pode ser ativado separadamente.
9. Para alertas, confirme o destinatário e teste o envio autorizado antes de configurar `notificacoes_ativas=true`. O Gmail está associado, mas nenhum e-mail foi enviado nesta configuração.

`npm run build` regenera os arquivos locais; não atualiza nem ativa automaticamente os workflows remotos. Ao alterar horários, atualize tanto `slots` quanto o Schedule Trigger e revise o efeito na fila existente.

## Falhas e limites conhecidos

O polling de containers é limitado a 16 consultas com espera de 15 segundos. Há polling dos slides antes do container de carrossel. A instância n8n impõe limite de 300 segundos por execução; carrosséis ou vídeos lentos podem esgotá-lo. A reserva mantém a peça bloqueada para reconciliação, sem republicação automática. Essa condição ainda precisa de homologação com mídias reais; não é tratada como teste integrado aprovado.

O Error Trigger fica no próprio publicador e não exige um workflow de erro separado nessa configuração. Ele atua em falhas automáticas; falhas de execução manual aparecem no histórico da execução. [Documentação oficial n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.errortrigger/).

O importador e o resumo têm execuções salvas no n8n. O tratamento geral de erro com alerta está no publicador; não foi ativado um handler compartilhado nem publicada uma automação de alertas. Nenhum watcher do Windows ou agendamento adicional do Codex foi instalado.

## Testes e evidências

Execute `npm test` para os testes locais. A validação remota do SDK e dos nodes foi executada no n8n. O relatório `RELATORIO-ENTREGA.md` registra os resultados e pendências sem confundir simulação com publicação real.

O workflow original `Instagram · Publicador Carteira em Dia`, ID `spzIWit9TALTU4us`, permaneceu intacto e ativo. O JSON original nos Downloads permaneceu com SHA256 `5B7E93AECB3D44BEF2AC89477196DD47502094B1103DC0271753854B67B5A9A3`.
