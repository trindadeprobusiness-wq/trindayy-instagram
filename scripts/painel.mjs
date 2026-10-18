import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { planBatches } from '../src/core.mjs';
import { github, commitFiles } from '../src/github.mjs';

const root = path.resolve(import.meta.dirname, '..');
const port = Number(process.env.TRINDAYY_PORT || 4187);
const origin = 'http://127.0.0.1:' + port;
const csrf = randomUUID();
const uploads = new Map();
const privateDir = path.join(root, 'privado');
await mkdir(privateDir, { recursive: true });
let busy = false;

async function jsonBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 135000000) throw new Error('Envio muito grande; máximo de 95 MB por arquivo'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function respond(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }

const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== '127.0.0.1:' + port) return respond(res, 403, { error: 'Host inválido' });
    if (req.method === 'GET' && req.url === '/') {
      const html = (await readFile(path.join(root, 'painel', 'index.html'), 'utf8')).replace('__CSRF__', csrf);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' blob:; frame-ancestors 'none'" }); return res.end(html);
    }
    if (req.method === 'GET' && req.url === '/api/status') {
      const c = JSON.parse(await readFile(path.join(root, 'config.json'), 'utf8'));
      return respond(res, 200, { account: c.instagram, slots: c.slots, teste: c.modo_teste, repository: c.repository || null, metaConectada: !!c.ig_user_id });
    }
    if (req.method !== 'POST' || req.headers.origin !== origin || req.headers['x-trindayy-csrf'] !== csrf) return respond(res, 403, { error: 'Requisição não autorizada' });
    const body = await jsonBody(req);
    if (req.url === '/api/upload') {
      if (typeof body.nome !== 'string' || !/\.(mp4|jpe?g)$/i.test(body.nome) || typeof body.base64 !== 'string') throw new Error('Envie apenas MP4 ou JPEG');
      const bytes = Buffer.from(body.base64, 'base64');
      if (!bytes.length || bytes.length > 95000000) throw new Error('Cada mídia precisa ter entre 1 byte e 95 MB');
      const ext = path.extname(body.nome).toLowerCase();
      if (ext === '.mp4' ? bytes.toString('ascii', 4, 8) !== 'ftyp' : bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('O conteúdo do arquivo não corresponde ao formato anunciado');
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const token = sha256 + ext;
      await writeFile(path.join(privateDir, token), bytes);
      if (ext === '.mp4') {
        let probe;
        try { probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path.join(privateDir, token)], { encoding: 'utf8', timeout: 30000 })); }
        catch { throw new Error('Vídeo inválido ou ffprobe indisponível. Arquivo preservado localmente, sem envio ao repositório.'); }
        if (!probe.streams?.some(s => s.codec_type === 'video') || !(Number(probe.format?.duration) > 0)) throw new Error('Arquivo sem vídeo reproduzível');
      }
      uploads.set(token, { nome: body.nome, sha256, ext });
      return respond(res, 200, { token, nome: body.nome, sha256 });
    }
    if (req.url === '/api/lote') {
      if (busy) return respond(res, 409, { error: 'Outro lote está sendo enviado; aguarde' });
      busy = true;
      try {
        const c = JSON.parse(await readFile(path.join(root, 'config.json'), 'utf8'));
        if (!Array.isArray(body.posts) || !body.posts.length) throw new Error('Adicione ao menos um vídeo ou imagem');
        const batch = { id: 'lote-' + Date.now(), ...(body.inicio ? { inicio: body.inicio } : {}), posts: body.posts.map(p => {
          const file = uploads.get(p.token);
          if (!file) throw new Error('Reenvie o arquivo nesta sessão');
          const repo = c.repository || 'trindadeprobusiness-wq/trindayy-instagram';
          return { id: 'trindayy-' + file.sha256.slice(0, 24), versao: 'v1', tipo: 'FEED', ig_media_type: file.ext === '.mp4' ? 'REELS' : 'IMAGE', tema: file.nome, legenda: p.legenda, status: 'pronto_para_postar', aprovacao: { por: 'Gabriel', em: new Date().toISOString(), versao: 'v1' }, midias: [{ ordem: 1, sha256: file.sha256, caminho_post: 'midias/' + p.token, url_publica: 'https://raw.githubusercontent.com/' + repo + '/' + c.content_branch + '/midias/' + p.token }] };
        }) };
        const calendar = { version: 1, account: 'trindayy', timezone: c.timezone, lotes: [batch] };
        const preview = planBatches(calendar, [], c);
        if (body.acao === 'preview') return respond(res, 200, { lote: batch.id, calendario: preview.map(r => ({ data: r.data, slot: r.slot, peca_id: r.peca_id })), aviso: 'Prévia local; a fila n8n preservará horários já ocupados.' });
        if (body.acao !== 'enviar' || body.aprovado !== true) throw new Error('Confirme explicitamente a aprovação deste lote antes de enviá-lo');
        await writeFile(path.join(privateDir, batch.id + '.json'), JSON.stringify(calendar, null, 2));
        if (!c.repository) return respond(res, 409, { error: 'Lote preservado localmente. Repositório de entrega ainda não configurado.', lote: batch.id });
        const repo = await github('/repos/' + c.repository);
        if (repo.private) throw new Error('O repositório de mídia deve estar público para a Meta buscar os arquivos; não alteraremos a privacidade automaticamente');
        const manifest = await github('/repos/' + c.repository + '/contents/conteudos.json?ref=' + encodeURIComponent(c.content_branch));
        const current = JSON.parse(Buffer.from(manifest.content, 'base64').toString('utf8'));
        const known = new Set(current.lotes.flatMap(b => b.posts.map(p => p.id)));
        if (batch.posts.some(p => known.has(p.id))) throw new Error('Este arquivo já foi enviado; o lote não será duplicado');
        current.lotes.push(batch);
        const files = [];
        for (const p of body.posts) files.push({ path: 'midias/' + p.token, binary: true, content: await readFile(path.join(privateDir, p.token)) });
        files.push({ path: 'conteudos.json', content: JSON.stringify(current, null, 2) + '\n' });
        const commit = await commitFiles(c.repository, c.content_branch, files, 'content: lote aprovado ' + batch.id);
        return respond(res, 200, { lote: batch.id, commit, status: 'Arquivos e manifesto enviados. O importador n8n precisa estar ativo para organizar a fila.', calendario: preview.map(r => ({ data: r.data, slot: r.slot })) });
      } finally { busy = false; }
    }
    return respond(res, 404, { error: 'Rota não encontrada' });
  } catch (e) { return respond(res, 400, { error: e.message }); }
});
function openPanel() { if (process.argv.includes('--open') && process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '', origin], { windowsHide: true, detached: true, stdio: 'ignore' }).unref(); }
server.on('error', error => { if (error.code === 'EADDRINUSE' && process.argv.includes('--open')) { openPanel(); process.exit(0); } console.error(error.message); process.exit(1); });
server.listen(port, '127.0.0.1', () => { console.log('Painel local Trindayy: ' + origin); openPanel(); });
