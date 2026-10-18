import { spawnSync } from 'node:child_process';

export async function github(path, { method = 'GET', body } = {}) {
  const result = spawnSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } });
  const token = result.status === 0 ? result.stdout.split(/\r?\n/).find(x => x.startsWith('password='))?.slice(9) : null;
  if (!token) throw new Error('Faça login no Git Credential Manager para o GitHub. Nunca cole tokens no painel.');
  const response = await fetch('https://api.github.com' + path, { method, headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'Trindayy-Publicador', Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
  const data = await response.json();
  if (!response.ok) throw new Error('GitHub HTTP ' + response.status + ': ' + (data.message || 'Falha de operação'));
  return data;
}

export async function commitFiles(repo, branch, files, message) {
  const base = '/repos/' + repo;
  const ref = await github(base + '/git/ref/heads/' + branch);
  const commit = await github(base + '/git/commits/' + ref.object.sha);
  const entries = [];
  for (const file of files) {
    const blob = await github(base + '/git/blobs', { method: 'POST', body: { encoding: file.binary ? 'base64' : 'utf-8', content: file.binary ? file.content.toString('base64') : file.content } });
    entries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const tree = await github(base + '/git/trees', { method: 'POST', body: { base_tree: commit.tree.sha, tree: entries } });
  const next = await github(base + '/git/commits', { method: 'POST', body: { message, tree: tree.sha, parents: [ref.object.sha] } });
  await github(base + '/git/refs/heads/' + branch, { method: 'PATCH', body: { sha: next.sha, force: false } });
  return next.sha;
}
