import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = JSON.parse(readFileSync(new URL('../workflows/verificar-conexao.json', import.meta.url), 'utf8'));
function run(name, json) {
  const node = workflow.nodes.find(n => n.name === name);
  return new Function('$input', node.parameters.jsCode)({ first: () => ({ json }), all: () => [{ json }] })[0].json;
}

test('recusa real de autenticação não termina como diagnóstico aprovado', () => {
  const result = run('Resultado seguro da conexão', { statusCode: 400, body: { error: { code: 190, message: 'Invalid OAuth 2.0 Access Token' } } });
  assert.equal(result.conectado, false);
  assert.throws(() => run('Confirmar autenticação válida', result), /HTTP 400.*190/);
});

test('resposta simulada só passa com username e user_id válidos, sem publicar', () => {
  const response = { statusCode: 200, body: { username: 'trindayy', user_id: '17841400000000001' } };
  const result = run('Confirmar autenticação válida', run('Resultado seguro da conexão', response));
  assert.equal(result.conectado, true);
  assert.equal(result.publicacao_testada, false);
  response.body.username = 'outra_conta';
  assert.throws(() => run('Confirmar autenticação válida', run('Resultado seguro da conexão', response)), /não autenticado/);
});
