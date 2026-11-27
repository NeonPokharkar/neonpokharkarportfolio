import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../src/app/trusted-script-url.ts', import.meta.url)), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;

function loadModule(trustedTypes) {
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    trustedTypes,
    URL,
    Reflect,
    TypeError
  });
  return exports;
}

test('allows only the Google identity and configured reCAPTCHA script URLs', () => {
  const scripts = loadModule(undefined);

  assert.equal(scripts.createTrustedScriptUrl('https://accounts.google.com/gsi/client'), 'https://accounts.google.com/gsi/client');
  assert.equal(
    scripts.createTrustedScriptUrl('https://www.google.com/recaptcha/enterprise.js?render=site-key'),
    'https://www.google.com/recaptcha/enterprise.js?render=site-key'
  );
  assert.throws(() => scripts.createTrustedScriptUrl('https://evil.example/gsi/client'), /not allowed/);
  assert.throws(() => scripts.createTrustedScriptUrl('https://accounts.google.com.evil.example/gsi/client'), /not allowed/);
  assert.throws(() => scripts.createTrustedScriptUrl('https://accounts.google.com/gsi/other.js'), /not allowed/);
});

test('uses the named Trusted Types policy when supported', () => {
  const policyNames = [];
  const trustedTypes = {
    createPolicy(name, rules) {
      policyNames.push(name);
      return {
        createScriptURL(value) {
          return { toString: () => rules.createScriptURL(value) };
        }
      };
    }
  };
  const scripts = loadModule(trustedTypes);
  const scriptElement = {};

  scripts.setTrustedScriptUrl(scriptElement, 'https://accounts.google.com/gsi/client');

  assert.deepEqual(policyNames, ['portfolio-scripts']);
  assert.equal(scriptElement.src.toString(), 'https://accounts.google.com/gsi/client');
  assert.throws(
    () => scripts.setTrustedScriptUrl(scriptElement, 'https://evil.example/injected.js'),
    /not allowed/
  );
});
