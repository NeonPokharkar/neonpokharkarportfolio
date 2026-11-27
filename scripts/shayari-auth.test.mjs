import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../src/app/verified-user.service.ts', import.meta.url)), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
}).outputText;

function createBrowser({ heartbeatMessageDelay = 0 } = {}) {
  let now = 1700000000000;
  let nextTimer = 0;
  let nextId = 0;
  let lock = Promise.resolve();
  const timers = new Map();
  const channels = new Set();
  const storage = new Map();
  const requests = [];
  let heartbeatResponse = { status: 200, body: { authenticated: true, expires_in: 7200 } };
  let logoutResponse = { status: 200, body: { logged_out: true } };

  const setTimer = (callback, delay = 0) => {
    const id = ++nextTimer;
    timers.set(id, { at: now + delay, callback });
    return id;
  };
  const clearTimer = (id) => timers.delete(id);

  class Channel {
    constructor() {
      channels.add(this);
    }

    postMessage(data) {
      for (const channel of channels) {
        if (channel !== this) {
          const delay = data.type === 'heartbeat' ? heartbeatMessageDelay : 0;
          setTimer(() => channel.onmessage?.({ data: structuredClone(data) }), delay);
        }
      }
    }
  }

  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  };
  const navigator = {
    locks: {
      request(_name, callback) {
        const next = lock.then(callback);
        lock = next.catch(() => {});
        return next;
      }
    }
  };
  const signal = (initial) => {
    let value = initial;
    const read = () => value;
    read.set = (next) => { value = next; };
    read.asReadonly = () => read;
    return read;
  };
  const fetch = async (url, options) => {
    if (typeof url === 'string') {
      return { ok: true, json: async () => ({ intelliChatEndpoint: 'https://example.test/intelli-chat' }) };
    }
    const request = { url: String(url), ...options };
    requests.push(request);
    if (request.url.endsWith('/auth/logout')) {
      return {
        ok: logoutResponse.status === 200,
        status: logoutResponse.status,
        json: async () => logoutResponse.body
      };
    }
    if (heartbeatResponse.error) {
      throw new Error('Simulated network failure');
    }
    return {
      ok: heartbeatResponse.status === 200,
      status: heartbeatResponse.status,
      json: async () => heartbeatResponse.body
    };
  };

  function tab() {
    const listeners = new Map();
    const window = {
      setTimeout: setTimer,
      addEventListener(type, listener) { listeners.set(type, listener); }
    };
    class ClockDate extends Date {
      static now() { return now; }
    }
    const exports = {};
    const context = {
      exports, window, navigator, localStorage, BroadcastChannel: Channel,
      crypto: { randomUUID: () => `id-${++nextId}` },
      document: { visibilityState: 'visible' },
      Date: ClockDate, URL, AbortController, setTimeout: setTimer, clearTimeout: clearTimer, fetch,
      console: { error() {} },
      require(name) {
        assert.equal(name, '@angular/core');
        return { Injectable: () => (target) => target, signal };
      }
    };
    vm.runInNewContext(compiled, context);
    return {
      service: new exports.VerifiedUserService(),
      interact() { listeners.get('keydown')?.({ isTrusted: true }); }
    };
  }

  async function flush() {
    for (let i = 0; i < 30; i++) {
      await Promise.resolve();
      const due = [...timers.entries()].find(([, timer]) => timer.at <= now);
      if (due) {
        timers.delete(due[0]);
        due[1].callback();
        i = 0;
      }
    }
  }

  async function advance(milliseconds) {
    const target = now + milliseconds;
    await flush();
    while (true) {
      const next = [...timers.values()].reduce((min, timer) => Math.min(min, timer.at), Infinity);
      if (next > target) {
        break;
      }
      now = next;
      await flush();
    }
    now = target;
    await flush();
  }

  return {
    tab, advance, flush, requests, storage,
    respond(response) { heartbeatResponse = response; },
    respondLogout(response) { logoutResponse = response; }
  };
}

test('shares the session and sends one heartbeat across active tabs', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  first.service.setSession({ name: 'Example', picture: null }, 'synthetic-token', 7200);
  await browser.flush();
  assert.equal(second.service.getAccessToken(), 'synthetic-token');
  assert.equal(browser.requests.length, 1);
  assert.equal(browser.requests[0].url, 'https://example.test/auth/heartbeat');
  assert.equal(browser.requests[0].headers.Authorization, 'Bearer synthetic-token');
  assert.equal(browser.requests[0].method, 'POST');
  assert.equal(browser.requests[0].body, undefined);
  assert.ok(!JSON.stringify([...browser.storage.values()]).includes('synthetic-token'));

  await browser.advance(29 * 60 * 1000);
  second.interact();
  await browser.advance(60 * 1000);
  assert.equal(browser.requests.length, 2);

  const third = browser.tab();
  await browser.flush();
  assert.equal(third.service.getAccessToken(), 'synthetic-token');
  assert.equal(browser.requests.length, 2);
});

test('shares the verified relationship profile across tabs', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  const friend = {
    name: 'Friend',
    typeOfRelationship: 'Classmate',
    fromWhatPhase: 'College',
    since: '2018',
    cardEmoji: '🎓'
  };
  first.service.setSession({
    name: 'Google account name',
    picture: null,
    friend,
    friendLookupStatus: 'matched'
  }, 'synthetic-token', 7200);
  await browser.flush();
  assert.deepEqual(second.service.user().friend, friend);
  assert.equal(second.service.user().friendLookupStatus, 'matched');
});

test('preserves relationship labels from profile data for any lookup result', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  const relationship = {
    name: 'Sam',
    typeOfRelationship: 'Colleague',
    fromWhatPhase: 'Work',
    since: '2021',
    cardEmoji: '💼'
  };
  first.service.setSession({
    name: 'Google account name',
    picture: null,
    friend: relationship,
    friendLookupStatus: 'stranger'
  }, 'synthetic-token', 7200);
  await browser.flush();
  assert.deepEqual(second.service.user().friend, relationship);
  assert.equal(second.service.user().friendLookupStatus, 'stranger');
});

test('rejects shared sessions with malformed friend details', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  first.service.setSession({
    name: 'Example',
    picture: null,
    friend: {
      name: 'Stranger',
      typeOfRelationship: 'Stranger',
      fromWhatPhase: null,
      since: null,
      cardEmoji: ''
    },
    friendLookupStatus: 'stranger'
  }, 'synthetic-token', 7200);
  await browser.flush();
  assert.equal(second.service.user(), null);
});

test('shares the admin flag across tabs and clears it on sign-out', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  first.service.setSession({ name: 'Admin', picture: null, isAdmin: true }, 'synthetic-token', 7200);
  await browser.flush();
  assert.equal(second.service.user().isAdmin, true);
  first.service.clear();
  await browser.flush();
  assert.equal(second.service.user(), null);
});

test('rejects shared sessions with an invalid admin flag', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  first.service.setSession({ name: 'Example', picture: null, isAdmin: 'true' }, 'synthetic-token', 7200);
  await browser.flush();
  assert.equal(second.service.user(), null);
});

test('counts failed OTP attempts across tabs and disables ingestion for the session', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  first.service.setSession({ name: 'Admin', picture: null, isAdmin: true }, 'synthetic-token', 7200);
  await browser.flush();
  await Promise.all([
    first.service.recordShayariIngestFailure('synthetic-token'),
    second.service.recordShayariIngestFailure('synthetic-token')
  ]);
  await browser.flush();
  assert.equal(first.service.shayariIngestState().failures, 2);
  assert.equal(second.service.shayariIngestState().failures, 2);
  await first.service.recordShayariIngestFailure('synthetic-token');
  await browser.flush();
  assert.equal(second.service.shayariIngestState().blocked, 'attempts');

  const third = browser.tab();
  await browser.flush();
  assert.equal(third.service.shayariIngestState().blocked, 'attempts');
  await first.service.resetShayariIngestFailures('synthetic-token');
  await browser.flush();
  assert.equal(second.service.shayariIngestState().blocked, 'attempts');
  first.service.setSession({ name: 'Admin', picture: null, isAdmin: true }, 'new-token', 7200);
  await browser.flush();
  assert.equal(first.service.shayariIngestState(), null);
});

test('resets successive OTP failures after a successful ingest', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  first.service.setSession({ name: 'Admin', picture: null, isAdmin: true }, 'synthetic-token', 7200);
  await browser.flush();
  await first.service.recordShayariIngestFailure('synthetic-token');
  await first.service.resetShayariIngestFailures('synthetic-token');
  await browser.flush();
  assert.equal(second.service.shayariIngestState().failures, 0);
  assert.equal(second.service.shayariIngestState().blocked, null);
});

test('notifies other tabs when a new OTP is requested for the shared session', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  first.service.setSession({ name: 'Admin', picture: null, isAdmin: true }, 'synthetic-token', 7200);
  await browser.flush();
  const requestId = first.service.announceShayariOtpRequest('synthetic-token');
  await browser.flush();
  assert.equal(second.service.shayariOtpRequest(), requestId);
  assert.equal(second.service.announceShayariOtpRequest('old-token'), null);
});

test('shares server lockout and ignores responses from an old session', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  first.service.setSession({ name: 'Admin', picture: null, isAdmin: true }, 'synthetic-token', 7200);
  await browser.flush();
  await first.service.blockShayariIngest('synthetic-token', 'lockout');
  await browser.flush();
  assert.equal(second.service.shayariIngestState().blocked, 'lockout');
  first.service.setSession({ name: 'Admin', picture: null, isAdmin: true }, 'new-token', 7200);
  await browser.flush();
  await first.service.recordShayariIngestFailure('synthetic-token');
  assert.equal(first.service.shayariIngestState(), null);
});

test('does not renew while idle and resumes after interaction', async () => {
  const browser = createBrowser();
  const tab = browser.tab();
  tab.service.setSession({ name: 'Example', picture: null }, 'synthetic-token', 7200);
  await browser.flush();
  await browser.advance(31 * 60 * 1000);
  assert.equal(browser.requests.length, 1);
  tab.interact();
  await browser.flush();
  assert.equal(browser.requests.length, 2);
});

test('a successful heartbeat extends the local session expiry', async () => {
  const browser = createBrowser();
  const tab = browser.tab();
  tab.service.setSession({ name: 'Example', picture: null }, 'synthetic-token', 60);
  await browser.flush();
  await browser.advance(61000);
  assert.equal(tab.service.getAccessToken(), 'synthetic-token');
});

test('deduplicates even when a heartbeat notification is delayed', async () => {
  const browser = createBrowser({ heartbeatMessageDelay: 10000 });
  const first = browser.tab();
  const second = browser.tab();
  first.service.setSession({ name: 'Example', picture: null }, 'synthetic-token', 7200);
  await browser.flush();
  assert.equal(browser.requests.length, 1);
  await browser.advance(29 * 60 * 1000);
  first.interact();
  second.interact();
  await browser.advance(60 * 1000);
  assert.equal(browser.requests.length, 2);
});

test('clears every tab when the heartbeat is rejected', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  first.service.setSession({ name: 'Example', picture: null }, 'synthetic-token', 7200);
  await browser.flush();
  browser.respond({ status: 401 });
  await browser.advance(29 * 60 * 1000);
  second.interact();
  await browser.advance(60 * 1000);
  assert.equal(browser.requests.length, 2);
  assert.equal(first.service.getAccessToken(), null);
  assert.equal(second.service.getAccessToken(), null);
  assert.match(second.service.sessionNotice(), /sign in again/);
});

test('revokes the signed-out session and stops its heartbeat', async () => {
  const browser = createBrowser();
  const tab = browser.tab();
  tab.service.setSession({ name: 'Example', picture: null }, 'synthetic-token', 7200);
  await browser.flush();

  const logout = tab.service.logout();
  assert.equal(tab.service.getAccessToken(), null);
  await logout;
  assert.match(tab.service.sessionNotice(), /signed out/i);

  const request = browser.requests.find((item) => item.url === 'https://example.test/auth/logout');
  assert.ok(request);
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.Authorization, 'Bearer synthetic-token');
  assert.equal(request.body, undefined);

  await browser.advance(31 * 60 * 1000);
  assert.equal(browser.requests.filter((item) => item.url === 'https://example.test/auth/logout').length, 1);
});

test('treats an already-revoked logout token as signed out', async () => {
  const browser = createBrowser();
  const tab = browser.tab();
  tab.service.setSession({ name: 'Example', picture: null }, 'synthetic-token', 7200);
  await browser.flush();
  browser.respondLogout({ status: 401, body: {} });

  await tab.service.logout();
  assert.equal(tab.service.user(), null);
  assert.match(tab.service.sessionNotice(), /signed out/i);
});

test('reports a failed heartbeat and retries only once across tabs', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  browser.respond({ error: true });
  first.service.setSession({ name: 'Example', picture: null }, 'synthetic-token', 7200);
  await browser.flush();
  assert.equal(browser.requests.length, 1);
  assert.match(first.service.heartbeatError(), /unavailable/);
  assert.match(second.service.heartbeatError(), /unavailable/);
  browser.respond({ status: 200, body: { authenticated: true, expires_in: 7200 } });
  await browser.advance(60 * 1000);
  assert.equal(browser.requests.length, 2);
  assert.equal(first.service.heartbeatError(), '');
  assert.equal(second.service.heartbeatError(), '');
});

test('converges on one session when tabs sign in simultaneously', async () => {
  const browser = createBrowser();
  const first = browser.tab();
  const second = browser.tab();
  first.service.setSession({ name: 'First', picture: null }, 'first-token', 7200);
  second.service.setSession({ name: 'Second', picture: null }, 'second-token', 7200);
  await browser.flush();
  assert.equal(first.service.getAccessToken(), second.service.getAccessToken());
  assert.equal(first.service.user().name, second.service.user().name);
});

test('clears an idle session when its expiry is reached', async () => {
  const browser = createBrowser();
  const tab = browser.tab();
  browser.respond({ error: true });
  tab.service.setSession({ name: 'Example', picture: null }, 'synthetic-token', 7200);
  await browser.flush();
  await browser.advance(2 * 60 * 60 * 1000);
  assert.equal(tab.service.getAccessToken(), null);
  assert.match(tab.service.sessionNotice(), /sign in again/);
});
