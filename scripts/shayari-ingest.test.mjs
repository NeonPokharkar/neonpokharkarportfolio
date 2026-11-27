import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../src/app/shayari-editor.component.ts', import.meta.url)), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
}).outputText;

function createEditor() {
  let now = 1700000000000;
  const requests = [];
  const responses = [];
  let token = 'synthetic-token';
  let otpRequest = null;
  let state = null;
  let cleared = false;
  const user = { name: 'Admin', picture: null, isAdmin: true };
  const verifiedUser = {
    user: () => token ? user : null,
    getAccessToken: () => token,
    shayariIngestState: () => state,
    shayariOtpRequest: () => otpRequest,
    announceShayariOtpRequest() { otpRequest = `request-${requests.length}`; return otpRequest; },
    clear() { token = null; cleared = true; },
    async recordShayariIngestFailure() {
      const failures = (state?.failures ?? 0) + 1;
      state = { failures, blocked: failures >= 3 ? 'attempts' : null };
    },
    async blockShayariIngest(_token, blocked) { state = { failures: state?.failures ?? 0, blocked }; },
    async resetShayariIngestFailures() { state = { failures: 0, blocked: null }; }
  };
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  class ClockDate extends Date {
    static now() { return now; }
  }
  class EventEmitter {
    count = 0;
    emit() { this.count++; }
  }
  const exports = {};
  const context = {
    exports, URL, AbortController, Date: ClockDate, console: { error() {} },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    fetch: async (url, options) => {
      if (typeof url === 'string') {
        return { ok: true, json: async () => ({ intelliChatEndpoint: 'https://example.test/chat' }) };
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
        return {
          Component: () => (target) => target,
          effect() {},
          Output: () => () => {},
          ViewChild: () => () => {},
          EventEmitter,
          ElementRef: class {}
        };
      }
      if (name === '@angular/forms') return { FormsModule: class {} };
      if (name === './verified-user.service') return { VerifiedUserService: class {} };
      throw new Error(`Unexpected import: ${name}`);
    }
  };
  vm.runInNewContext(compiled, context);
  const editor = new exports.ShayariEditorComponent(verifiedUser);
  editor.otpDialog = { nativeElement: dialog };
  editor.draftText = 'Synthetic verse';
  editor.draftDate = '2026-11-27';
  editor.draftType = 'love';
  editor.draftLanguage = 'Hindi';
  return {
    editor, requests, dialog, verifiedUser,
    respond(response) { responses.push(response); },
    advance(ms) { now += ms; editor.now = now; },
    get cleared() { return cleared; },
    get state() { return state; }
  };
}

async function flush() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

const otpSuccess = { status: 200, body: { sent: true, expires_in: 300 } };
const ingestSuccess = { status: 200, body: { count: 1, inserted: 1, updated: 0, ids: ['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'] } };

test('requests an OTP before submitting the unchanged single-record payload', async () => {
  const mock = createEditor();
  mock.respond(otpSuccess);
  mock.editor.submitShayari();
  await flush();
  assert.equal(mock.dialog.open, true);
  assert.equal(mock.requests.length, 1);
  assert.equal(mock.requests[0].url, 'https://example.test/ingest/shayari/otp');
  assert.equal(mock.requests[0].headers.Authorization, 'Bearer synthetic-token');
  assert.equal(mock.requests[0].body, undefined);
  mock.respond(ingestSuccess);
  mock.editor.otp = '012345';
  await mock.editor.submitOtp();
  assert.equal(mock.requests.length, 2);
  assert.equal(mock.requests[1].url, 'https://example.test/ingest/shayari');
  assert.equal(mock.requests[1].headers['X-Ingest-OTP'], '012345');
  assert.deepEqual(JSON.parse(mock.requests[1].body), {
    shayari: [{ text: 'Synthetic verse', date: '2026-11-27', type: 'love', language: 'Hindi' }]
  });
  assert.equal(mock.dialog.open, false);
  assert.match(mock.editor.draftMessage, /submitted successfully/);
  assert.equal(mock.editor.refreshRequested.count, 1);
  mock.editor.ngOnDestroy();
});

test('counts three ambiguous 401 responses and blocks further attempts', async () => {
  const mock = createEditor();
  mock.respond(otpSuccess);
  mock.editor.submitShayari();
  await flush();
  for (let i = 0; i < 3; i++) {
    mock.respond({ status: 401 });
    mock.editor.otp = '111111';
    await mock.editor.submitOtp();
  }
  assert.equal(mock.state.failures, 3);
  assert.equal(mock.state.blocked, 'attempts');
  assert.equal(mock.cleared, false);
  mock.editor.otp = '111111';
  await mock.editor.submitOtp();
  assert.equal(mock.requests.length, 4);
  mock.editor.ngOnDestroy();
});

test('OTP request 401 clears the expired session and 423 blocks ingestion', async () => {
  const expired = createEditor();
  expired.respond({ status: 401 });
  expired.editor.submitShayari();
  await flush();
  assert.equal(expired.cleared, true);
  expired.editor.ngOnDestroy();

  const locked = createEditor();
  locked.respond({ status: 423 });
  locked.editor.submitShayari();
  await flush();
  assert.equal(locked.state.blocked, 'lockout');
  assert.match(locked.editor.otpError, /locked on the server/);
  locked.editor.ngOnDestroy();
});

test('handles OTP rate limiting and refuses early resend requests', async () => {
  const mock = createEditor();
  mock.respond({ status: 429 });
  mock.editor.submitShayari();
  await flush();
  assert.match(mock.editor.otpError, /too recently/);
  assert.equal(mock.editor.resendWait, 30);
  await mock.editor.requestOtp();
  assert.equal(mock.requests.length, 1);
  mock.advance(30000);
  mock.respond(otpSuccess);
  await mock.editor.requestOtp();
  assert.equal(mock.requests.length, 2);
  assert.equal(mock.editor.otpAvailable, true);
  mock.editor.ngOnDestroy();
});

test('requires a new OTP and warns about duplicates after an uncertain submission', async () => {
  const mock = createEditor();
  mock.respond(otpSuccess);
  mock.editor.submitShayari();
  await flush();
  mock.respond({ error: true });
  mock.editor.otp = '123456';
  await mock.editor.submitOtp();
  assert.equal(mock.editor.otpAvailable, false);
  assert.match(mock.editor.otpError, /may have succeeded/);
  assert.equal(mock.editor.refreshRequested.count, 1);
  assert.equal(mock.editor.draftText, 'Synthetic verse');
  await mock.editor.requestOtp();
  assert.equal(mock.requests.length, 2);
  mock.advance(30000);
  mock.respond(otpSuccess);
  await mock.editor.requestOtp();
  assert.equal(mock.requests.length, 3);
  mock.editor.ngOnDestroy();
});

test('enforces the OTP format and refuses expired codes without sending them', async () => {
  const mock = createEditor();
  mock.respond(otpSuccess);
  mock.editor.submitShayari();
  await flush();
  mock.editor.otp = 'abc123';
  await mock.editor.submitOtp();
  assert.match(mock.editor.otpError, /six-digit/);
  mock.advance(300000);
  mock.editor.otp = '123456';
  await mock.editor.submitOtp();
  assert.equal(mock.requests.length, 1);
  mock.editor.ngOnDestroy();
});
