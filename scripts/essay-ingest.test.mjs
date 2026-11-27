import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../src/app/essay-editor.component.ts', import.meta.url)), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
}).outputText;

function createEditor(essay = null) {
  const requests = [];
  const responses = [];
  let state = null;
  let otpRequest = null;
  const events = [];
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const verifiedUser = {
    user: () => ({ name: 'Admin', picture: null, isAdmin: true }),
    getAccessToken: () => 'synthetic-token',
    shayariIngestState: () => state,
    shayariOtpRequest: () => otpRequest,
    announceShayariOtpRequest() {
      otpRequest = `request-${requests.length}`;
      return otpRequest;
    },
    async recordShayariIngestFailure() {
      const failures = (state?.failures ?? 0) + 1;
      state = { failures, blocked: failures >= 3 ? 'attempts' : null };
    },
    async blockShayariIngest(_token, blocked) { state = { failures: state?.failures ?? 0, blocked }; },
    async resetShayariIngestFailures() { state = { failures: 0, blocked: null }; },
    clear() { state = null; }
  };
  class EventEmitter {
    emit(value) { events.push(value); }
  }
  const exports = {};
  const context = {
    exports, URL, AbortController, HTMLElement: class HTMLElement {}, console: { error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async (url, options) => {
      if (typeof url === 'string') {
        return { ok: true, json: async () => ({ intelliChatEndpoint: 'https://example.test/intelli-chat' }) };
      }
      requests.push({ url: String(url), ...options });
      const response = responses.shift();
      if (!response) {
        throw new Error('Unexpected request');
      }
      if (response.error) {
        throw new Error('Simulated network failure');
      }
      return { status: response.status, ok: response.status === 200, json: async () => response.body };
    },
    require(name) {
      if (name === '@angular/core') {
        const decorator = () => () => {};
        return {
          Component: decorator, Input: decorator, Output: decorator, ViewChild: decorator,
          ElementRef: class {}, EventEmitter, effect() {}
        };
      }
      if (name === '@angular/forms') return { FormsModule: class {} };
      if (name === './verified-user.service') return { VerifiedUserService: class {} };
      throw new Error(`Unexpected import: ${name}`);
    }
  };
  vm.runInNewContext(compiled, context);
  const editor = new exports.EssayEditorComponent(verifiedUser);
  editor.otpDialog = { nativeElement: dialog };
  editor.essay = essay;
  if (essay) {
    editor.ngOnChanges({ essay: {} });
  }
  return {
    editor, requests, events, dialog, verifiedUser,
    respond(response) { responses.push(response); },
    get state() { return state; }
  };
}

async function flush() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

const proof = {
  algorithm: 'Ed25519',
  content_sha256: 'hash',
  signature: 'signature',
  public_key: 'public-key',
  key_id: 'key-id',
  signed_at: '2026-11-27T18:15:00Z'
};

function savedEssay(overrides = {}) {
  return {
    slug: 'my-essay',
    category: 'Personal',
    title: 'My Essay',
    summary: '',
    author: 'Aditya Pokharkar',
    publishedAt: '2026-11-27T23:45:00+05:30',
    file: null,
    html: '<p>My essay content.</p>',
    proof,
    ...overrides
  };
}

test('creates an essay using an OTP and the exact HTML draft', async () => {
  const mock = createEditor();
  mock.editor.title = 'My Essay';
  mock.editor.category = 'Personal';
  mock.editor.draftHtml = '<p>My essay content.</p>';
  mock.editor.htmlChanged = true;
  mock.respond({ status: 200, body: { sent: true, expires_in: 300 } });
  mock.editor.saveDraft();
  await flush();
  assert.equal(mock.dialog.open, true);
  assert.equal(mock.requests.length, 1);
  assert.equal(mock.requests[0].url, 'https://example.test/ingest/essay/otp');
  assert.equal(mock.requests[0].method, 'POST');
  assert.equal(mock.requests[0].headers.Authorization, 'Bearer synthetic-token');
  assert.equal(mock.requests[0].body, undefined);

  mock.respond({ status: 200, body: { created: true, essay: savedEssay() } });
  mock.editor.otp = '012345';
  await mock.editor.submitOtp();
  assert.equal(mock.requests.length, 2);
  assert.equal(mock.requests[1].url, 'https://example.test/ingest/essay');
  assert.equal(mock.requests[1].headers['X-Ingest-OTP'], '012345');
  assert.deepEqual(JSON.parse(mock.requests[1].body), {
    title: 'My Essay',
    category: 'Personal',
    html: '<p>My essay content.</p>'
  });
  assert.equal(mock.events[0].created, true);
  assert.equal(mock.events[0].essay.file, null);
  assert.equal(mock.dialog.open, false);
  assert.match(mock.editor.formMessage, /created successfully/);
  mock.editor.ngOnDestroy();
});

test('updates an essay with its slug and preserves untouched HTML exactly', async () => {
  const originalHtml = '<p>Existing <strong>content</strong>.</p>\n';
  const mock = createEditor({
    slug: 'my-essay',
    category: 'Personal',
    title: 'My Essay',
    summary: '',
    author: 'Aditya Pokharkar',
    publishedAt: '2026-11-27T23:45:00+05:30',
    file: null,
    html: originalHtml
  });
  mock.editor.title = 'Updated Essay';
  mock.respond({ status: 200, body: { sent: true, expires_in: 300 } });
  mock.editor.saveDraft();
  await flush();
  mock.respond({ status: 200, body: { created: false, essay: savedEssay({
    title: 'Updated Essay',
    html: originalHtml,
    updatedAt: '2026-11-28T00:00:00+05:30',
    updatedTimeZone: 'India Standard Time'
  }) } });
  mock.editor.otp = '654321';
  await mock.editor.submitOtp();
  assert.equal(mock.requests[1].headers['X-Ingest-OTP'], '654321');
  assert.deepEqual(JSON.parse(mock.requests[1].body), {
    slug: 'my-essay',
    title: 'Updated Essay',
    category: 'Personal',
    html: originalHtml
  });
  assert.equal(mock.events[0].created, false);
  assert.equal(mock.events[0].essay.html, originalHtml);
  mock.editor.ngOnDestroy();
});
