import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../src/app/google-identity.ts', import.meta.url)), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;

function loadModule() {
  const exports = {};
  const scripts = [];
  const window = {
    setTimeout: () => 1,
    clearTimeout: () => {}
  };
  const document = {
    createElement: () => ({ remove() {} }),
    head: { appendChild: (script) => scripts.push(script) }
  };
  vm.runInNewContext(compiled, {
    exports,
    window,
    document,
    console: { error() {} },
    require: () => ({ setTrustedScriptUrl: (script, url) => { script.src = url; } })
  });
  return { exports, window, scripts };
}

test('shares script loading and permits retry after a load failure', async () => {
  const { exports, window, scripts } = loadModule();
  const first = exports.loadGoogleIdentity();
  assert.equal(exports.loadGoogleIdentity(), first);
  assert.equal(scripts.length, 1);
  scripts[0].onerror();
  await assert.rejects(first, /Could not load Google Sign-In/);

  const retry = exports.loadGoogleIdentity();
  assert.equal(scripts.length, 2);
  const identity = {};
  window.google = { accounts: { id: identity } };
  scripts[1].onload();
  assert.equal(await retry, identity);
});

test('initializes once and routes credentials by button state', () => {
  const { exports } = loadModule();
  let initializeCount = 0;
  let callback;
  const buttons = [];
  const identity = {
    initialize(options) { initializeCount++; callback = options.callback; },
    renderButton(element, options) { buttons.push(options); }
  };
  const received = [];
  const unregisterFirst = exports.renderGoogleSignInButton(identity, {}, (credential) => received.push(['first', credential]));
  exports.renderGoogleSignInButton(identity, {}, (credential) => received.push(['second', credential]));
  assert.equal(initializeCount, 1);
  callback({ credential: 'second-token', state: buttons[1].state });
  callback({ credential: 'first-token', state: buttons[0].state });
  unregisterFirst();
  callback({ credential: 'late-token', state: buttons[0].state });
  callback({ credential: 'unknown-token', state: 'unknown' });
  assert.deepEqual(received, [['second', 'second-token'], ['first', 'first-token']]);
});

test('does not reinitialize when rendering is retried after failure', () => {
  const { exports } = loadModule();
  let initializeCount = 0;
  let renderCount = 0;
  const identity = {
    initialize() { initializeCount++; },
    renderButton() { if (++renderCount === 1) throw new Error('render failed'); }
  };
  assert.throws(() => exports.renderGoogleSignInButton(identity, {}, () => {}), /render failed/);
  exports.renderGoogleSignInButton(identity, {}, () => {});
  assert.equal(initializeCount, 1);
});
