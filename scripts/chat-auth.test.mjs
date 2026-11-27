import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../src/app/chat-auth.ts', import.meta.url)), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });

test('only sends an authorization header for authenticated chat requests', () => {
  assert.deepEqual({ ...exports.createChatRequestHeaders(null) }, { 'Content-Type': 'application/json' });
  assert.deepEqual({ ...exports.createChatRequestHeaders('session-token') }, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer session-token'
  });
});

test('recognizes only the anonymous chat-limit response', async () => {
  assert.equal(await exports.isChatAuthenticationRequired(new Response(
    JSON.stringify({ code: 'chat_authentication_required' }),
    { status: 401 }
  )), true);
  assert.equal(await exports.isChatAuthenticationRequired(new Response(
    JSON.stringify({ code: 'invalid_session' }),
    { status: 401 }
  )), false);
  assert.equal(await exports.isChatAuthenticationRequired(new Response(
    JSON.stringify({ code: 'chat_authentication_required' }),
    { status: 403 }
  )), false);
  assert.equal(await exports.isChatAuthenticationRequired(new Response('not json', { status: 401 })), false);
});
