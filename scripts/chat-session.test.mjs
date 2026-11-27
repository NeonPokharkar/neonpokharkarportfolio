import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../src/app/chat-session.ts', import.meta.url)), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const exports = {};
let channel;
class TestBroadcastChannel {
  onmessage = null;
  sent = [];
  closed = false;
  constructor(name) {
    this.name = name;
    channel = this;
  }
  postMessage(message) {
    this.sent.push(message);
  }
  close() {
    this.closed = true;
  }
}
vm.runInNewContext(compiled, {
  exports,
  BroadcastChannel: TestBroadcastChannel,
  crypto: { randomUUID: () => 'sender-id' },
  Number,
  Math
});

const sessionId = 'c5bfc54e-9f7e-4eef-8aad-c08f5aa7dd82';
const state = {
  messages: [{ role: 'user', content: 'hello' }],
  draft: 'next question',
  conversationSummary: 'summary',
  lastRelevantConversation: 'last turn',
  busy: false,
  requiresSignIn: false
};

test('creates an isolated channel and publishes only transient chat state', () => {
  const received = [];
  const sync = exports.createChatSessionChannel(sessionId, (value) => received.push(value), () => {});

  assert.ok(sync);
  assert.equal(channel.name, `aditya-chat-session:${sessionId}`);
  sync.requestInitialState();
  sync.publish(state);

  assert.deepEqual({ ...channel.sent[0] }, { type: 'ready', senderId: 'sender-id' });
  assert.deepEqual({ ...channel.sent[1] }, {
    type: 'state',
    senderId: 'sender-id',
    clock: 1,
    state
  });
  assert.deepEqual(received, []);
  sync.close();
  assert.equal(channel.closed, true);
});

test('accepts valid newer state, ignores stale or malformed messages, and serves ready requests', () => {
  const received = [];
  let readyRequests = 0;
  const sync = exports.createChatSessionChannel(sessionId, (value) => received.push(value), () => readyRequests++);

  channel.onmessage({ data: { type: 'ready' } });
  channel.onmessage({ data: { type: 'state', senderId: 'remote', clock: 2, state } });
  channel.onmessage({ data: { type: 'state', senderId: 'older', clock: 1, state } });
  channel.onmessage({ data: { type: 'state', senderId: 'invalid', clock: 3, state: { ...state, busy: 'no' } } });

  assert.equal(readyRequests, 1);
  assert.deepEqual(received, [state]);
  sync.publish(state);
  assert.equal(channel.sent[0].clock, 3);
});

test('rejects invalid session identifiers', () => {
  assert.equal(exports.createChatSessionChannel('not-a-uuid', () => {}, () => {}), null);
});
