export interface ChatSessionMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSessionState {
  messages: ChatSessionMessage[];
  draft: string;
  conversationSummary: string;
  lastRelevantConversation: string;
  busy: boolean;
  requiresSignIn: boolean;
}

export interface ChatSessionChannel {
  requestInitialState(): void;
  publish(state: ChatSessionState): void;
  close(): void;
}

export function clearLegacyChatSnapshots(): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem('aditya_chat_messages');
    sessionStorage.removeItem('aditya_chat_summary');
    sessionStorage.removeItem('aditya_chat_last_conv');
  } catch (error) {
    console.warn('Could not clear previous chat snapshots from session storage.', error);
  }
}

interface ChatSessionEnvelope {
  type: 'state';
  senderId: string;
  clock: number;
  state: ChatSessionState;
}

function isChatSessionState(value: unknown): value is ChatSessionState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const state = value as Partial<ChatSessionState>;
  return Array.isArray(state.messages) &&
    state.messages.every((message) =>
      !!message &&
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.content === 'string'
    ) &&
    typeof state.draft === 'string' &&
    typeof state.conversationSummary === 'string' &&
    typeof state.lastRelevantConversation === 'string' &&
    typeof state.busy === 'boolean' &&
    typeof state.requiresSignIn === 'boolean';
}

export function createChatSessionChannel(
  sessionId: string,
  onState: (state: ChatSessionState) => void,
  onReady: () => void
): ChatSessionChannel | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId) ||
      typeof BroadcastChannel === 'undefined' ||
      typeof crypto.randomUUID !== 'function') {
    return null;
  }

  const channel = new BroadcastChannel(`aditya-chat-session:${sessionId}`);
  const senderId = crypto.randomUUID();
  let clock = 0;
  let latestClock = 0;
  let latestSenderId = '';

  channel.onmessage = (event: MessageEvent<unknown>) => {
    const message = event.data as {
      type?: unknown;
      senderId?: unknown;
      clock?: unknown;
      state?: unknown;
    } | null;
    if (message?.type === 'ready') {
      onReady();
      return;
    }

    if (!message || message.type !== 'state' ||
        typeof message.senderId !== 'string' ||
        typeof message.clock !== 'number' ||
        !Number.isSafeInteger(message.clock) ||
        !isChatSessionState(message.state)) {
      return;
    }

    const incomingClock = message.clock;
    const incomingSenderId = message.senderId;
    if (incomingClock < latestClock ||
          (incomingClock === latestClock && incomingSenderId <= latestSenderId)) {
      return;
    }

    latestClock = incomingClock;
    latestSenderId = incomingSenderId;
    clock = Math.max(clock, incomingClock);
    onState(message.state);
  };

  return {
    requestInitialState: () => channel.postMessage({ type: 'ready', senderId }),
    publish: (state) => {
      clock = Math.max(clock, latestClock) + 1;
      latestClock = clock;
      latestSenderId = senderId;
      const envelope: ChatSessionEnvelope = { type: 'state', senderId, clock, state };
      channel.postMessage(envelope);
    },
    close: () => channel.close()
  };
}
