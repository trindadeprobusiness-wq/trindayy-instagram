import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instagramRequest } from '../src/instagram-api.mjs';
import { validateInstagramIdentity, redact } from '../src/core.mjs';

const credential = { id: 'credential-reference', name: 'Header Auth account' };
const cfg = { instagram: 'trindayy', ig_user_id: '17841400000000001' };

test('Instagram Login exige user_id profissional; id do app não identifica a conta de publicação', () => {
  assert.equal(validateInstagramIdentity({ user_id: cfg.ig_user_id, id: '999999', username: 'Trindayy' }, cfg), cfg.ig_user_id);
  for (const p of [
    { id: cfg.ig_user_id, username: 'trindayy' },
    { user_id: cfg.ig_user_id, username: 'carteiraemdia' },
    { user_id: '17841400000000002', username: 'trindayy' },
  ]) assert.throws(() => validateInstagramIdentity(p, cfg), /divergente/);
});

test('requisição de publicação usa graph.instagram.com, corpo JSON e credencial sem token nos parâmetros', () => {
  const r = instagramRequest({ method: 'POST', target: cfg.ig_user_id, edge: 'media', data: { media_type: 'REELS', video_url: 'https://cdn.example/video.mp4', share_to_feed: true }, credential });
  assert.equal(r.parameters.url, `https://graph.instagram.com/v24.0/${cfg.ig_user_id}/media`);
  assert.equal(JSON.parse(r.parameters.jsonBody).share_to_feed, true);
  assert.equal(r.parameters.contentType, 'json');
  assert.equal(r.parameters.options.redirect.redirect.followRedirects, false);
  assert.equal(r.parameters.authentication, 'genericCredentialType');
  assert.equal(r.credentials.httpHeaderAuth.id, credential.id);
  assert.doesNotMatch(JSON.stringify(r.parameters), /access_token|Bearer|graph\.facebook\.com/);
});

test('URL dinâmica conserva a conta e o endpoint media_publish sem interpolar segredos', () => {
  const r = instagramRequest({ method: 'POST', target: '={{ $("Config").first().json.ig_user_id }}', edge: 'media_publish', data: '={{ JSON.stringify({creation_id:"18000000000"}) }}', credential });
  const resolve = new Function('$', 'return ' + r.parameters.url.slice(3, -2));
  assert.equal(resolve(() => ({ first: () => ({ json: cfg }) })), `https://graph.instagram.com/v24.0/${cfg.ig_user_id}/media_publish`);
  assert.equal(r.parameters.jsonBody, '={{ JSON.stringify({creation_id:"18000000000"}) }}');
  assert.throws(() => instagramRequest({ target: 'https://evil.invalid', credential }), /Identificador/);
  assert.throws(() => instagramRequest({ target: 'me', edge: 'delete', credential }), /Endpoint/);
});

test('sanitização oculta tokens Instagram Login e Facebook', () => {
  for (const prefix of ['IGQ', 'EAA']) {
    const token = prefix + 'a'.repeat(80);
    assert.ok(!redact('Falha com ' + token).includes(token));
    assert.ok(!redact('Authorization: Bearer ' + token).includes(token));
  }
});
