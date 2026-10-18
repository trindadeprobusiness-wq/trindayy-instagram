import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const origin = 'http://127.0.0.1:4188';
const server = spawn(process.execPath, ['scripts/painel.mjs'], { env: { ...process.env, TRINDAYY_PORT: '4188' }, stdio: ['ignore', 'pipe', 'pipe'] });
after(() => server.kill());
await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Painel não iniciou')), 10000); server.stdout.once('data', () => { clearTimeout(timer); resolve(); }); server.once('error', reject); });
const html = await (await fetch(origin)).text();
const csrf = html.match(/const csrf='([^']+)'/)[1];
async function send(url, body, headers = {}) { const r = await fetch(origin + url, { method: 'POST', headers: { Origin: origin, 'X-Trindayy-CSRF': csrf, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; }
let upload;
test('painel exibe conta, controles de aprovação e três horários', async () => { assert.ok(html.includes('10h, 12h e 18h')); assert.ok(html.includes('Eu, Gabriel, aprovo')); const r = await (await fetch(origin + '/api/status')).json(); assert.equal(r.account, 'trindayy'); assert.equal(r.teste, true); });
test('origem estrangeira e CSRF ausente bloqueiam escrita', async () => { assert.equal((await send('/api/lote', {}, { Origin: 'https://evil.invalid' })).status, 403); assert.equal((await send('/api/upload', {}, { 'X-Trindayy-CSRF': '' })).status, 403); });
test('arquivos com extensão não suportada são rejeitados', async () => assert.equal((await send('/api/upload', { nome: 'segredo.txt', base64: 'eA==' })).status, 400));
test('JPEG de teste fica apenas no armazenamento local', async () => { const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]); const r = await send('/api/upload', { nome: 'TESTE-FICTICIO.jpg', base64: bytes.toString('base64') }); assert.equal(r.status, 200); assert.match(r.data.sha256, /^[a-f0-9]{64}$/); upload = r.data; });
test('prévia calcula agenda sem publicar ou enviar ao GitHub', async () => { const r = await send('/api/lote', { acao: 'preview', posts: [{ token: upload.token, legenda: 'TESTE FICTÍCIO. Não publicar.' }] }); assert.equal(r.status, 200); assert.equal(r.data.calendario.length, 1); assert.equal(r.data.calendario[0].slot, '12:00'); assert.ok(r.data.aviso.includes('Prévia local')); });
test('envio sem aprovação explícita é bloqueado antes do GitHub', async () => { const r = await send('/api/lote', { acao: 'enviar', aprovado: false, posts: [{ token: upload.token, legenda: 'TESTE FICTÍCIO.' }] }); assert.equal(r.status, 400); assert.match(r.data.error, /Confirme explicitamente/); });
test('arquivo MP4 sem vídeo real é rejeitado pelo ffprobe', async () => { const r = await send('/api/upload', { nome: 'invalido.mp4', base64: Buffer.from('0000ftyp00000000').toString('base64') }); assert.equal(r.status, 400); assert.match(r.data.error, /Vídeo inválido/); });
