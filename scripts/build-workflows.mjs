import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { instagramRequest } from '../src/instagram-api.mjs';

const root = path.resolve(import.meta.dirname, '..');
const cfg = JSON.parse(await readFile(path.join(root, 'config.json'), 'utf8'));
const core = (await readFile(path.join(root, 'src/core.mjs'), 'utf8')).replace(/^export /gm, '');
const dest = path.join(root, 'workflows');
await mkdir(dest, { recursive: true });
const X = s => '={{ ' + s + ' }}';
function graph(name) {
  const w = { name, active: false, nodes: [], connections: {}, settings: { executionOrder: 'v1', timezone: cfg.timezone, executionTimeout: 300, saveExecutionProgress: true, saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', saveManualExecutions: true } };
  function n(name, type, version, parameters = {}, extra = {}) {
    const value = { id: randomUUID(), name, type: 'n8n-nodes-base.' + type, typeVersion: version, position: [w.nodes.length % 7 * 280, Math.floor(w.nodes.length / 7) * 300], parameters, ...extra };
    w.nodes.push(value); return name;
  }
  const code = (name, js, extra = {}) => n(name, 'code', 2, { mode: 'runOnceForAllItems', jsCode: js.replace(/\$json\b/g, '$input.first().json') }, extra);
  function link(a, b, output = 0) { const c = w.connections[a] ||= { main: [] }; c.main[output] ||= []; c.main[output].push({ node: b, type: 'main', index: 0 }); }
  function table(name, operation, id, { values, filters = [], always = false } = {}) {
    const parameters = { resource: 'row', operation, dataTableId: { __rl: true, mode: 'list', value: id, cachedResultName: id === cfg.tabela_fila ? 'trindayy_fila' : 'trindayy_publicacoes' } };
    if (operation === 'get') parameters.returnAll = true;
    if (filters.length) { parameters.matchType = 'allConditions'; parameters.filters = { conditions: filters.map(([keyName, keyValue]) => ({ keyName, condition: 'eq', keyValue })) }; }
    if (values) parameters.columns = { mappingMode: 'defineBelow', value: values, schema: Object.keys(values).map(id => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true })) };
    return n(name, 'dataTable', 1.1, parameters, always ? { alwaysOutputData: true } : {});
  }
  const route = (name, expression, outputs) => n(name, 'switch', 3.4, { mode: 'expression', numberOutputs: outputs, output: X(expression) });
  const ig = (name, method, target, edge = '', data = {}, extra = {}) => {
    const request = instagramRequest({ method, target, edge, data, credential: cfg.instagram_credential, version: cfg.instagram_api_version });
    return n(name, 'httpRequest', 4.5, request.parameters, { credentials: request.credentials, ...extra });
  };
  const wait = (name, amount) => n(name, 'wait', 1.1, { amount, unit: 'seconds' });
  function config(name = 'Config') { return code(name, 'return [{json:' + JSON.stringify(cfg) + '}];'); }
  function audit(name, outcome, ref = 'Escolher peça do slot', overrides = {}) {
    const p = `$('${ref}').first().json`;
    return table(name, 'insert', cfg.tabela_historico, { values: { empresa: cfg.empresa, peca_id: X(p + '.peca_id || ""'), data: X(p + '.data || ""'), slot: X(p + '.slot || ""'), ig_media_type: X(p + '.tipo || ""'), tema: X(p + '.tema || ""'), resultado: outcome, creation_id: X('$json.creation_id || ""'), ig_media_id: X('$json.ig_media_id || ""'), permalink: X('$json.permalink || ""'), detalhe: X('$json.motivo || ""'), executado_em: X('$now.toISO()'), execution_id: X('$execution.id'), ...overrides } });
  }
  function notifications(source, messageExpression) {
    const ready = route('Notificações habilitadas?', `$('Config').first().json.notificacoes_ativas === true ? 0 : 1`, 2);
    const mail = n('E-mail Trindayy', 'gmail', 2.2, { resource: 'message', operation: 'send', sendTo: cfg.email_alerta, subject: '[Trindayy] Publicador Instagram', emailType: 'text', message: X(messageExpression), options: { appendAttribution: false } }, { credentials: { gmailOAuth2: { id: 'J66yXFCEYegKJdhk', name: 'Gmail account' } }, onError: 'continueRegularOutput' });
    link(source, ready); link(ready, mail, 0);
  }
  return { w, n, code, link, table, route, ig, wait, config, audit, notifications };
}

function intake() {
  const g = graph('Instagram · Entrada de lotes Trindayy');
  const { n, code, link, table, route } = g;
  const manual = n('Importar repositório manualmente', 'manualTrigger', 1);
  const schedule = n('Conferir repositório a cada hora', 'scheduleTrigger', 1.4, { rule: { interval: [{ field: 'hours', hoursInterval: 1, triggerAtMinute: 5 }] } });
  const form = n('Enviar lote ao n8n', 'formTrigger', 2.6, { authentication: 'n8nUserAuth', requireExecuteAccess: true, formTitle: 'Trindayy · Enviar lote', formDescription: 'Cole o manifesto dos seus conteúdos aprovados. Somente posts de feed; os arquivos precisam ter URLs públicas. A fila será distribuída sem publicar nesta etapa.', formFields: { values: [{ fieldName: 'manifesto', fieldLabel: 'Manifesto JSON do lote', fieldType: 'textarea', requiredField: true }] }, responseMode: 'lastNode', options: { path: 'trindayy-lotes', buttonLabel: 'Organizar lote', appendAttribution: false } });
  const config = code('Config', 'const input=$input.first().json; return [{json:{...'+JSON.stringify(cfg)+',manifesto: input.manifesto || null}}];');
  const origin = route('Origem do lote', '$json.manifesto ? 0 : ($json.json_url ? 1 : 2)', 3);
  const parse = code('Ler manifesto do formulário', 'const value=$("Config").first().json.manifesto; return [{json: typeof value === "string" ? JSON.parse(value) : value}];');
  const http = n('Baixar calendário do repositório', 'httpRequest', 4.5, { url: X('$json.json_url'), options: { timeout: 30000 } }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 });
  const empty = code('Repositório ainda não configurado', 'return [{json:{account:"trindayy",timezone:"America/Sao_Paulo",lotes:[]}}];');
  const calendar = code('Calendário normalizado', 'const raw=$input.first().json; const cal=typeof raw.data==="string" ? JSON.parse(raw.data) : (typeof raw.body==="string" ? JSON.parse(raw.body) : raw); return [{json:cal}];');
  const queue = table('Ler fila existente', 'get', cfg.tabela_fila, { always: true });
  const planner = code('Distribuir lote pela semana', core + '\nconst rows=$input.all().map(i=>i.json).filter(r=>r.peca_id); const result=planBatches($("Calendário normalizado").first().json,rows,$("Config").first().json); return result.map(json=>({json}));');
  const save = table('Salvar novos horários', 'upsert', cfg.tabela_fila, { filters: [['peca_id', X('$json.peca_id')]], values: Object.fromEntries(['peca_id', 'lote_id', 'payload', 'data', 'slot', 'estado', 'fingerprint'].map(k => [k, X('$json.' + k)])) });
  for (const t of [manual, schedule, form]) link(t, config);
  link(config, origin); link(origin, parse, 0); link(origin, http, 1); link(origin, empty, 2);
  for (const t of [parse, http, empty]) link(t, calendar);
  link(calendar, queue); link(queue, planner); link(planner, save);
  return g.w;
}

function publisher() {
  const g = graph('Instagram · Publicador Trindayy');
  const { n, code, link, table, route, ig, wait, config, audit, notifications } = g;
  const manual = n('Teste manual sem publicação', 'manualTrigger', 1);
  const schedule = n('10h · 12h · 18h (Brasília)', 'scheduleTrigger', 1.4, { rule: { interval: cfg.slots.map(s => ({ field: 'days', daysInterval: 1, triggerAtHour: Number(s.split(':')[0]), triggerAtMinute: Number(s.split(':')[1]) })) } });
  const c = config();
  const queue = table('Ler fila Trindayy', 'get', cfg.tabela_fila, { always: true });
  const select = code('Escolher peça do slot', core + '\nconst rows=$input.all().map(i=>i.json).filter(r=>r.peca_id); return [{json:selectPost(rows,$("Config").first().json)}];');
  const action = route('O que fazer?', '({publicar:0,simular:1,pular:2,nada:3})[$json.acao] ?? 2', 4);
  const simulated = audit('Registrar simulação', 'simulado', undefined, { detalhe: X('JSON.stringify({container_params:$("Escolher peça do slot").first().json.container_params,carrossel:$("Escolher peça do slot").first().json.carrossel})') });
  const skipped = audit('Registrar bloqueio', 'bloqueado');
  const none = audit('Registrar horário sem peça', 'sem_peca');
  const gate = code('Validar autorização de produção', 'const c=$("Config").first().json; if(c.modo_teste!==false || c.publicacao_autorizada!==true || !/^\\d{5,30}$/.test(c.ig_user_id || "")) throw new Error("Trindayy: produção bloqueada; conectar conta correta e obter autorização antes de ativar."); if(c.data_forcada || c.slot_forcado || $execution.mode!=="production") throw new Error("Publicação real exige execução de produção sem data/slot forçados."); return $input.all();');
  const identity = ig('Consultar identidade Instagram Login', 'GET', 'me', '', { fields: 'user_id,username' }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 });
  const check = code('Confirmar conta @Trindayy', core + '\nvalidateInstagramIdentity($input.first().json,$("Config").first().json); return $("Escolher peça do slot").all();');
  const urls = code('Separar mídias para conferir', 'return $("Escolher peça do slot").first().json.urls.map(url=>({json:{url}}));');
  const head = n('Conferir mídia pública', 'httpRequest', 4.5, { method: 'HEAD', url: X('$json.url'), options: { timeout: 30000, response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } } } }, { retryOnFail: true, maxTries: 2, waitBetweenTries: 2000 });
  const available = code('Confirmar todas as mídias', core + '\nvalidateMediaResponses($input.all().map(i=>i.json),$("Escolher peça do slot").first().json.urls.length); return $("Escolher peça do slot").all();');
  const claim = audit('Reservar peça antes da API', 'reservado');
  const claims = table('Ler reservas desta peça', 'get', cfg.tabela_historico, { filters: [['peca_id', X('$("Escolher peça do slot").first().json.peca_id')]] });
  const elect = code('Eleger única execução autorizada', core + '\nconst claim=$("Reservar peça antes da API").first().json;const rows=$input.all().map(i=>i.json);if(!ownsClaim(rows,claim.id,String($execution.id))) return [];return $("Escolher peça do slot").all();');
  const carousel = route('É carrossel?', '$json.tipo === "CAROUSEL" ? 0 : 1', 2);
  const single = ig('Criar mídia Instagram Login', 'POST', X('$("Config").first().json.ig_user_id'), 'media', X('JSON.stringify($("Escolher peça do slot").first().json.container_params)'));
  const slides = code('Separar slides em ordem', 'return $("Escolher peça do slot").first().json.carrossel.map((params,i)=>({json:{params,ordem:i+1}}));');
  const loop = n('Processar um slide por vez', 'splitInBatches', 3, { batchSize: 1, options: {} });
  const child = ig('Criar slide Instagram Login', 'POST', X('$("Config").first().json.ig_user_id'), 'media', X('JSON.stringify($json.params)'));
  const childctx = code('Container do slide criado', 'if(!$json.id) throw new Error("Container de slide não retornou ID"); return [{json:{creation_id:$json.id,ordem:$("Processar um slide por vez").item.json.ordem,tentativas:0}}];');
  const childwait = wait('Aguardar slide', 15);
  const childstatus = ig('Status do slide Instagram Login', 'GET', X('$json.creation_id'), '', { fields: 'status_code,status' }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 });
  const childnorm = code('Avaliar processamento do slide', core + '\nconst prev=$("Aguardar slide").item.json;const current=$json;return [{json:{...prev,tentativas:prev.tentativas+1,rota:containerState(current.status_code,prev.tentativas+1),status_code:current.status_code,motivo:redact(current.status)}}];');
  const childroute = route('Slide pronto?', '({publicar:0,aguardar:1,erro:2})[$json.rota] ?? 2', 3);
  const childdone = code('Slide validado', 'return [{json:{id:$json.creation_id,ordem:$json.ordem}}];');
  const gather = code('Juntar slides validados', 'const s=$input.all().map(i=>i.json).sort((a,b)=>a.ordem-b.ordem); const p=$("Escolher peça do slot").first().json; if(s.length!==p.carrossel.length || s.some(x=>!x.id)) throw new Error("Carrossel incompleto");return [{json:{params:{media_type:"CAROUSEL",children:s.map(x=>x.id).join(","),caption:p.legenda}}}];');
  const parent = ig('Criar carrossel Instagram Login', 'POST', X('$("Config").first().json.ig_user_id'), 'media', X('JSON.stringify($json.params)'));
  const ctx = code('Container criado', 'if(!$json.id) throw new Error("Container sem ID"); return [{json:{creation_id:$json.id,tentativas:0}}];');
  const logcontainer = audit('Registrar container antes de publicar', 'container_criado');
  const restore = code('Retomar container', 'return $("Container criado").all();');
  const processing = wait('Aguardar processamento', 15);
  const status = ig('Status do container Instagram Login', 'GET', X('$json.creation_id'), '', { fields: 'status_code,status' }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 });
  const statusnorm = code('Avaliar processamento do container', core + '\nconst prev=$("Aguardar processamento").item.json;const current=$json;return [{json:{...prev,tentativas:prev.tentativas+1,rota:containerState(current.status_code,prev.tentativas+1),status_code:current.status_code,motivo:redact(current.status)}}];');
  const statusroute = route('Container pronto?', '({publicar:0,aguardar:1,erro:2})[$json.rota] ?? 2', 3);
  const logintent = audit('Registrar intenção de publicação', 'publicando');
  const publish = ig('Publicar via Instagram Login', 'POST', X('$("Config").first().json.ig_user_id'), 'media_publish', X('JSON.stringify({creation_id:$("Container criado").first().json.creation_id})'));
  const receipt = code('Confirmar ID publicado', 'if(!$json.id) throw new Error("Resposta ambígua de publicação; revisar manualmente, não repetir"); return [{json:{ig_media_id:$json.id,creation_id:$("Container criado").first().json.creation_id}}];');
  const published = audit('Registrar publicado imediatamente', 'publicado');
  const permalink = ig('Consultar link Instagram Login', 'GET', X('$("Confirmar ID publicado").first().json.ig_media_id'), '', { fields: 'id,permalink' }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000, onError: 'continueRegularOutput' });
  const linkresult = code('Normalizar link', 'const p=$("Confirmar ID publicado").first().json;return [{json:{...p,permalink:$json.permalink || "",motivo:$json.permalink ? "" : "Post publicado; consulta do link falhou. Não republicar."}}];');
  const linksaved = audit('Registrar link do post', 'link_consultado');
  const failure = audit('Registrar erro de processamento', 'erro_container');
  const errtrigger = n('Se o publicador falhar', 'errorTrigger', 1);
  const redacterr = code('Sanitizar erro Trindayy', core + '\nconst input=$json;return [{json:{empresa:"Trindayy",peca_id:"",data:localNow().data,slot:"",tipo:"",motivo:redact(input.execution?.error?.message || input.error?.message || "Falha geral"),execution_id:String(input.execution?.id || $execution.id)}}];');
  const errlog = audit('Registrar falha geral', 'erro_geral', 'Sanitizar erro Trindayy');
  const errnotice = code('Preparar aviso de falha geral', 'return [{json:{mensagem:"Trindayy: falha no publicador. Consulte a execução e o histórico antes de tentar novamente."}}];');
  const errgate = route('Notificações de falha habilitadas?', cfg.notificacoes_ativas ? '0' : '1', 2);
  const errmail = n('E-mail falha geral Trindayy', 'gmail', 2.2, { resource: 'message', operation: 'send', sendTo: cfg.email_alerta, subject: '[Trindayy] Falha no publicador', emailType: 'text', message: X('$json.mensagem'), options: { appendAttribution: false } }, { credentials: { gmailOAuth2: { id: 'J66yXFCEYegKJdhk', name: 'Gmail account' } }, onError: 'continueRegularOutput' });
  const notice = code('Preparar aviso', 'return [{json:{mensagem:"Trindayy: revise o histórico e a execução no n8n. Nenhuma retentativa de publicação será feita automaticamente."}}];');
  notifications(notice, '$json.mensagem');
  for (const t of [manual, schedule]) link(t, c);
  link(c, queue); link(queue, select); link(select, action);
  link(action, gate, 0); link(action, simulated, 1); link(action, skipped, 2); link(action, none, 3);
  link(gate, identity); link(identity, check); link(check, urls); link(urls, head); link(head, available); link(available, claim); link(claim, claims); link(claims, elect); link(elect, carousel);
  link(carousel, slides, 0); link(carousel, single, 1); link(single, ctx);
  link(slides, loop); link(loop, child, 1); link(loop, gather, 0); link(child, childctx); link(childctx, childwait); link(childwait, childstatus); link(childstatus, childnorm); link(childnorm, childroute); link(childroute, childdone, 0); link(childroute, childwait, 1); link(childroute, failure, 2); link(childdone, loop); link(gather, parent); link(parent, ctx);
  link(ctx, logcontainer); link(logcontainer, restore); link(restore, processing); link(processing, status); link(status, statusnorm); link(statusnorm, statusroute); link(statusroute, logintent, 0); link(statusroute, processing, 1); link(statusroute, failure, 2); link(logintent, publish); link(publish, receipt); link(receipt, published); link(published, permalink); link(permalink, linkresult); link(linkresult, linksaved);
  link(skipped, notice); link(failure, notice); link(errtrigger, redacterr); link(redacterr, errlog); link(errlog, errnotice); link(errnotice, errgate); link(errgate, errmail, 0);
  return g.w;
}

function daily() {
  const g = graph('Instagram · Programação diária Trindayy');
  const { n, code, config, link, table, audit, notifications } = g;
  const manual = n('Conferir programação manualmente', 'manualTrigger', 1);
  const schedule = n('Resumo diário às 9h30', 'scheduleTrigger', 1.4, { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 9, triggerAtMinute: 30 }] } });
  const c = config();
  const rows = table('Ler programação', 'get', cfg.tabela_fila, { always: true });
  const summary = code('Resumo do dia Trindayy', core + '\nconst data=localNow().data;const rows=$input.all().map(i=>i.json).filter(r=>r.data===data);return [{json:{data,slot:"09:30",peca_id:"",tipo:"",mensagem:"Trindayy — programação de "+data+"\\n"+(rows.length?rows.map(r=>r.slot+" · "+r.peca_id+" · "+r.estado).join("\\n"):"Nenhuma peça programada. Envie um novo lote."),motivo:"Resumo diário preparado"}}];');
  const log = audit('Registrar programação diária', 'programacao_diaria', 'Resumo do dia Trindayy');
  const restored = code('Retomar resumo', 'return $("Resumo do dia Trindayy").all();');
  notifications(restored, '$json.mensagem');
  for (const t of [manual, schedule]) link(t, c);
  link(c, rows); link(rows, summary); link(summary, log); link(log, restored);
  return g.w;
}

function sdk(w) {
  function literal(value) {
    if (typeof value === 'string' && value.startsWith('={{')) return 'expr(' + JSON.stringify(value.slice(1)) + ')';
    if (Array.isArray(value)) return '[' + value.map(literal).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.entries(value).map(([k, v]) => JSON.stringify(k) + ':' + literal(v)).join(',') + '}';
    return JSON.stringify(value);
  }
  const lines = ["import {workflow,node,trigger,newCredential,expr} from '@n8n/workflow-sdk';"];
  const ids = new Map(w.nodes.map((n, i) => [n.name, 'n' + i]));
  for (const n of w.nodes) {
    const { type, typeVersion: version, id, ...config } = n;
    delete config.credentials;
    let text = literal(config);
    if (n.credentials) text = text.slice(0, -1) + ',credentials:{' + Object.entries(n.credentials).map(([k, v]) => JSON.stringify(k) + ':' + (v.id ? JSON.stringify({ id: v.id, name: v.name }) : 'newCredential(' + JSON.stringify(v.name) + ')')).join(',') + '}}';
    const sample = { ...cfg, acao: 'nada', manifesto: null, peca_id: '', lote_id: '', payload: '', data: '', slot: '', estado: '', fingerprint: '', creation_id: '', ig_media_id: '', permalink: '', motivo: '', tipo: '', params: {}, rota: 'aguardar', tentativas: 0, mensagem: '', id: 1, url: '' };
    lines.push('const ' + ids.get(n.name) + '=' + (/Trigger$/.test(type) ? 'trigger' : 'node') + '({type:' + JSON.stringify(type) + ',version:' + version + ',config:' + text + ',output:[{json:' + JSON.stringify(sample) + '}]});');
  }
  lines.push('const w=workflow(' + JSON.stringify('trindayy-' + w.name) + ',' + JSON.stringify(w.name) + ');');
  w.nodes.forEach(n => lines.push('w.add(' + ids.get(n.name) + ');'));
  for (const [a, connection] of Object.entries(w.connections)) (connection.main || []).forEach((targets, index) => targets.forEach(t => lines.push(ids.get(a) + '.output(' + index + ').to(' + ids.get(t.node) + ');')));
  for (const group of w.nodeGroups || []) lines.push('w.group(' + JSON.stringify(group.name) + ',[' + group.nodeNames.map(name=>ids.get(name)).join(',') + '],{description:' + JSON.stringify(group.description) + '});');
  lines.push('export default w;');
  return lines.join('\n');
}

for (const [file, w] of [['entrada', intake()], ['publicador', publisher()], ['programacao', daily()]]) {
  const errorNames = ['Sanitizar erro Trindayy','Registrar falha geral','Preparar aviso de falha geral','Notificações de falha habilitadas?','E-mail falha geral Trindayy'];
  w.nodeGroups = [{ id: randomUUID(), name: file === 'publicador' ? 'Publicador Trindayy' : file === 'entrada' ? 'Entrada e distribuição' : 'Programação diária', nodeNames: w.nodes.filter(n=>!/Trigger$/.test(n.type) && (file !== 'publicador' || !errorNames.includes(n.name))).map(n=>n.name), description: 'Conteúdos humanos aprovados, fila própria e execução protegida em modo de teste.' }];
  if (file === 'publicador') w.nodeGroups.push({ id: randomUUID(), name: 'Falha geral e alerta', nodeNames: errorNames, description: 'Sanitiza a falha e registra antes de avisar; notificações desabilitadas até validação.' });
  await writeFile(path.join(dest, file + '.json'), JSON.stringify(w, null, 2) + '\n');
  await writeFile(path.join(dest, file + '.sdk.js'), sdk(w));
  console.log(file + ': ' + w.nodes.length + ' nodes');
}
