// Only credential references are stored here. The token stays encrypted in n8n.
export function instagramRequest({ method = 'GET', target, edge = '', data = {}, credential, version = 'v24.0' }) {
  if (!['GET', 'POST'].includes(method)) throw new Error('Método Instagram não permitido');
  if (!/^v\d+\.\d+$/.test(version)) throw new Error('Versão da API inválida');
  if (!credential?.id || !credential?.name) throw new Error('Referência da credencial obrigatória');
  if (!/^(|media|media_publish|content_publishing_limit|permissions)$/.test(edge)) throw new Error('Endpoint Instagram não permitido');
  const base = `https://graph.instagram.com/${version}/`;
  const dynamic = typeof target === 'string' && target.startsWith('={{');
  if (!dynamic && !/^(me|\d{5,30})$/.test(target || '')) throw new Error('Identificador Instagram inválido');
  const url = dynamic
    ? `={{ ${JSON.stringify(base)} + String(${target.slice(3, -2).trim()}) + ${JSON.stringify(edge ? '/' + edge : '')} }}`
    : base + target + (edge ? '/' + edge : '');
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  const parameters = {
    method, url, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    ...(method === 'GET'
      ? { sendQuery: true, specifyQuery: 'json', jsonQuery: payload }
      : { sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: payload }),
    options: { timeout: 30000, redirect: { redirect: { followRedirects: false } }, response: { response: { responseFormat: 'json' } } },
  };
  return { parameters, credentials: { httpHeaderAuth: { id: credential.id, name: credential.name } } };
}
