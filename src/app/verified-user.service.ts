import { Injectable, signal } from '@angular/core';

export interface VerifiedUser {
  name: string;
  picture: string | null;
  isAdmin?: boolean;
}

interface SharedSession {
  id: string;
  createdAt: number;
  user: VerifiedUser;
  accessToken: string;
  expiresAt: number;
  lastHeartbeatAt: number;
  lastActivityAt: number;
}

interface HeartbeatState {
  sessionId: string;
  lastHeartbeatAt: number;
  expiresAt: number;
  retryAfter: number;
}

export interface ShayariIngestState {
  sessionId: string;
  failures: number;
  blocked: 'attempts' | 'lockout' | 'forbidden' | 'coordination' | null;
  revision: number;
}

type SessionMessage =
  | { type: 'request'; tabId: string }
  | { type: 'session'; target?: string; session: SharedSession }
  | { type: 'activity'; sessionId: string; at: number }
  | { type: 'heartbeat'; state: HeartbeatState }
  | { type: 'heartbeat-error'; sessionId: string; retryAfter: number }
  | { type: 'ingest-state'; state: ShayariIngestState }
  | { type: 'shayari-otp-request'; sessionId: string; requestId: string }
  | { type: 'clear'; sessionId: string };

const heartbeatInterval = 30 * 60 * 1000;
const heartbeatRetryDelay = 60 * 1000;
const heartbeatStorageKey = 'portfolio-auth-heartbeat';
const ingestStorageKey = 'portfolio-shayari-ingest';

@Injectable({ providedIn: 'root' })
export class VerifiedUserService {
  private readonly currentUser = signal<VerifiedUser | null>(null);
  readonly user = this.currentUser.asReadonly();
  private readonly sessionReady = signal(false);
  readonly ready = this.sessionReady.asReadonly();
  private readonly renewalError = signal('');
  readonly heartbeatError = this.renewalError.asReadonly();
  private readonly notice = signal('');
  readonly sessionNotice = this.notice.asReadonly();
  private readonly ingestStatus = signal<ShayariIngestState | null>(null);
  readonly shayariIngestState = this.ingestStatus.asReadonly();
  private readonly otpRequest = signal<string | null>(null);
  readonly shayariOtpRequest = this.otpRequest.asReadonly();

  private session: SharedSession | null = null;
  private channel?: BroadcastChannel;
  private tabId = '';
  private expiryTimer?: ReturnType<typeof setTimeout>;
  private heartbeatTimer?: ReturnType<typeof setTimeout>;
  private heartbeatPending = false;
  private retryAfter = 0;
  private lastActivityBroadcast = 0;

  constructor() {
    if (typeof window === 'undefined') {
      this.sessionReady.set(true);
      return;
    }

    if (typeof BroadcastChannel !== 'undefined' && navigator.locks &&
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try {
        localStorage.getItem(heartbeatStorageKey);
        this.tabId = crypto.randomUUID();
        this.channel = new BroadcastChannel('portfolio-auth-session');
        this.channel.onmessage = (event: MessageEvent<unknown>) => this.receiveMessage(event.data);
        this.channel.postMessage({ type: 'request', tabId: this.tabId } satisfies SessionMessage);
        window.setTimeout(() => this.sessionReady.set(true), 500);
      } catch (error) {
        console.error('Could not initialize session coordination.', error);
        this.sessionReady.set(true);
      }
    } else {
      this.sessionReady.set(true);
    }

    window.addEventListener('pointerdown', this.recordActivity, { passive: true });
    window.addEventListener('keydown', this.recordActivity);
    window.addEventListener('wheel', this.recordActivity, { passive: true });
  }

  setSession(user: VerifiedUser, accessToken: string, expiresIn: number): void {
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
      throw new Error('Secure session identifiers are unavailable in this browser.');
    }
    const now = Date.now();
    const session: SharedSession = {
      id: crypto.randomUUID(),
      createdAt: now,
      user,
      accessToken,
      expiresAt: now + expiresIn * 1000,
      lastHeartbeatAt: 0,
      lastActivityAt: now
    };
    this.applySession(session);
    this.broadcast({ type: 'session', session });
  }

  getAccessToken(): string | null {
    if (this.session && Date.now() >= this.session.expiresAt) {
      this.refreshFromStoredHeartbeat();
      if (this.session && Date.now() >= this.session.expiresAt) {
        this.clear();
      }
    }
    return this.session?.accessToken ?? null;
  }

  clear(): void {
    const sessionId = this.session?.id;
    this.clearLocalSession();
    if (sessionId) {
      this.broadcast({ type: 'clear', sessionId });
    }
  }

  async logout(): Promise<void> {
    const accessToken = this.getAccessToken();
    this.clear();
    this.notice.set('You have signed out.');
    if (!accessToken) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const profileResponse = await fetch('assets/profile/profile.json', { signal: controller.signal });
      if (!profileResponse.ok) {
        throw new Error(`Could not load API configuration (HTTP ${profileResponse.status}).`);
      }
      const profile: unknown = await profileResponse.json();
      if (!profile || typeof profile !== 'object' || !('intelliChatEndpoint' in profile) ||
          typeof profile.intelliChatEndpoint !== 'string' || !profile.intelliChatEndpoint.trim()) {
        throw new Error('Invalid API configuration.');
      }
      const endpoint = new URL('/auth/logout', profile.intelliChatEndpoint);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal
      });
      if (response.status === 401) {
        return;
      }
      if (!response.ok) {
        throw new Error(`Logout endpoint returned HTTP ${response.status}.`);
      }
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' || !('logged_out' in result) || result.logged_out !== true) {
        throw new Error('Logout endpoint returned an invalid response.');
      }
    } catch (error) {
      console.error('Could not revoke the signed-out session.', error);
      if (!this.session) {
        this.notice.set('You are signed out here, but server logout could not be confirmed.');
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async recordShayariIngestFailure(accessToken: string): Promise<void> {
    await this.updateShayariIngestState(accessToken, 'failure');
  }

  announceShayariOtpRequest(accessToken: string): string | null {
    if (!this.session || this.getAccessToken() !== accessToken) {
      return null;
    }
    const requestId = crypto.randomUUID();
    this.otpRequest.set(requestId);
    this.broadcast({ type: 'shayari-otp-request', sessionId: this.session.id, requestId });
    return requestId;
  }

  async blockShayariIngest(accessToken: string, reason: 'lockout' | 'forbidden'): Promise<void> {
    await this.updateShayariIngestState(accessToken, reason);
  }

  async resetShayariIngestFailures(accessToken: string): Promise<void> {
    await this.updateShayariIngestState(accessToken, 'success');
  }

  private async updateShayariIngestState(accessToken: string, action: 'failure' | 'success' | 'lockout' | 'forbidden'): Promise<void> {
    const sessionId = this.session?.id;
    if (!sessionId || this.getAccessToken() !== accessToken) {
      return;
    }
    const update = () => {
      if (this.session?.id !== sessionId || this.getAccessToken() !== accessToken) {
        return;
      }
      const current = this.channel ? this.readShayariIngestState(sessionId) : this.ingestStatus();
      const state: ShayariIngestState = current?.sessionId === sessionId
        ? { ...current }
        : { sessionId, failures: 0, blocked: null, revision: 0 };
      if (!state.blocked) {
        if (action === 'failure') {
          state.failures = Math.min(3, state.failures + 1);
          if (state.failures === 3) {
            state.blocked = 'attempts';
          }
        } else if (action === 'success') {
          state.failures = 0;
        } else {
          state.blocked = action;
        }
      } else if (action === 'lockout') {
        state.blocked = 'lockout';
      }
      state.revision++;
      if (this.channel) {
        localStorage.setItem(ingestStorageKey, JSON.stringify(state));
      }
      this.ingestStatus.set(state);
      this.broadcast({ type: 'ingest-state', state });
    };
    try {
      if (this.channel) {
        await navigator.locks.request(ingestStorageKey, update);
      } else {
        update();
      }
    } catch (error) {
      console.error('Could not coordinate Shayari ingestion.', error);
      if (this.session?.id === sessionId) {
        const state: ShayariIngestState = { sessionId, failures: 0, blocked: 'coordination', revision: Number.MAX_SAFE_INTEGER };
        this.ingestStatus.set(state);
        this.broadcast({ type: 'ingest-state', state });
      }
    }
  }

  private readShayariIngestState(sessionId: string): ShayariIngestState | null {
    const stored = localStorage.getItem(ingestStorageKey);
    if (!stored) {
      return null;
    }
    const value: unknown = JSON.parse(stored);
    if (!this.isShayariIngestState(value)) {
      throw new Error('Invalid stored Shayari ingestion state.');
    }
    return value.sessionId === sessionId ? value : null;
  }

  private isShayariIngestState(value: unknown): value is ShayariIngestState {
    return !!value && typeof value === 'object' &&
      'sessionId' in value && typeof value.sessionId === 'string' && !!value.sessionId &&
      'failures' in value && typeof value.failures === 'number' && Number.isInteger(value.failures) &&
      value.failures >= 0 && value.failures <= 3 &&
      'blocked' in value && (value.blocked === null || value.blocked === 'attempts' || value.blocked === 'lockout' ||
        value.blocked === 'forbidden' || value.blocked === 'coordination') &&
      'revision' in value && typeof value.revision === 'number' && Number.isSafeInteger(value.revision) && value.revision >= 0;
  }

  private applySession(session: SharedSession): void {
    this.cancelTimers();
    this.session = { ...session };
    this.retryAfter = 0;
    this.currentUser.set(session.user);
    this.otpRequest.set(null);
    try {
      this.ingestStatus.set(this.channel ? this.readShayariIngestState(session.id) : null);
    } catch (error) {
      console.error('Could not read Shayari ingestion state.', error);
      this.ingestStatus.set({ sessionId: session.id, failures: 0, blocked: 'coordination', revision: Number.MAX_SAFE_INTEGER });
    }
    this.notice.set('');
    this.renewalError.set('');
    this.sessionReady.set(true);
    this.scheduleExpiry();
    if (!this.channel) {
      this.renewalError.set('Session renewal is unavailable in this browser. You may need to sign in again.');
      return;
    }
    this.scheduleHeartbeat();
  }

  private clearLocalSession(): void {
    const hadSession = !!this.session;
    this.cancelTimers();
    this.session = null;
    this.currentUser.set(null);
    this.otpRequest.set(null);
    this.ingestStatus.set(null);
    this.renewalError.set('');
    if (hadSession) {
      this.notice.set('Your session expired or was revoked. Please sign in again.');
    }
  }

  private cancelTimers(): void {
    if (this.expiryTimer !== undefined) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = undefined;
    }
    if (this.heartbeatTimer !== undefined) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private scheduleExpiry(): void {
    if (!this.session) {
      return;
    }
    if (this.expiryTimer !== undefined) {
      clearTimeout(this.expiryTimer);
    }
    const remaining = this.session.expiresAt - Date.now();
    if (remaining <= 0) {
      this.refreshFromStoredHeartbeat();
      if (this.session && this.session.expiresAt <= Date.now()) {
        this.clear();
      }
      return;
    }
    this.expiryTimer = setTimeout(() => this.scheduleExpiry(), Math.min(remaining, 2147483647));
  }

  private readonly recordActivity = (event: Event): void => {
    if (!event.isTrusted || document.visibilityState !== 'visible' || !this.session) {
      return;
    }
    const now = Date.now();
    this.session.lastActivityAt = now;
    if (now - this.lastActivityBroadcast >= 15000) {
      this.lastActivityBroadcast = now;
      this.broadcast({ type: 'activity', sessionId: this.session.id, at: now });
    }
    this.scheduleHeartbeat();
  };

  private scheduleHeartbeat(): void {
    if (this.heartbeatTimer !== undefined) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    const session = this.session;
    if (!session || !this.channel || this.heartbeatPending || Date.now() - session.lastActivityAt >= heartbeatInterval) {
      return;
    }
    const next = Math.max(session.lastHeartbeatAt ? session.lastHeartbeatAt + heartbeatInterval : 0, this.retryAfter);
    this.heartbeatTimer = setTimeout(() => void this.sendHeartbeat(), Math.max(0, next - Date.now()));
  }

  private async sendHeartbeat(): Promise<void> {
    const session = this.session;
    if (!session || this.heartbeatPending || !this.channel || !this.getAccessToken()) {
      return;
    }
    this.heartbeatPending = true;
    try {
      await navigator.locks.request(heartbeatStorageKey, async () => {
        if (this.session?.id !== session.id || !this.getAccessToken() ||
            Date.now() - this.session.lastActivityAt >= heartbeatInterval) {
          return;
        }
        const state = this.readHeartbeatState();
        if (state?.sessionId === session.id) {
          this.applyHeartbeatState(state);
          if (Date.now() < Math.max(state.lastHeartbeatAt + heartbeatInterval, state.retryAfter)) {
            return;
          }
        }

        const attempt: HeartbeatState = {
          sessionId: session.id,
          lastHeartbeatAt: session.lastHeartbeatAt,
          expiresAt: session.expiresAt,
          retryAfter: Date.now() + heartbeatRetryDelay
        };
        localStorage.setItem(heartbeatStorageKey, JSON.stringify(attempt));
        this.retryAfter = attempt.retryAfter;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          const profileResponse = await fetch('assets/profile/profile.json', { signal: controller.signal });
          if (!profileResponse.ok) {
            throw new Error(`Could not load API configuration (HTTP ${profileResponse.status}).`);
          }
          const profile: unknown = await profileResponse.json();
          if (!profile || typeof profile !== 'object' || !('intelliChatEndpoint' in profile) ||
              typeof profile.intelliChatEndpoint !== 'string') {
            throw new Error('Invalid API configuration.');
          }
          const endpoint = new URL('/auth/heartbeat', profile.intelliChatEndpoint);
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.accessToken}` },
            signal: controller.signal
          });
          if (this.session?.id !== session.id) {
            return;
          }
          if (response.status === 401) {
            this.clear();
            return;
          }
          if (!response.ok) {
            throw new Error(`Heartbeat endpoint returned HTTP ${response.status}.`);
          }
          const result: unknown = await response.json();
          if (!result || typeof result !== 'object' || !('authenticated' in result) || result.authenticated !== true ||
              !('expires_in' in result) || typeof result.expires_in !== 'number' ||
              !Number.isSafeInteger(result.expires_in) || result.expires_in <= 0 ||
              !Number.isSafeInteger(Date.now() + result.expires_in * 1000)) {
            throw new Error('Heartbeat endpoint returned an invalid response.');
          }
          if (this.session?.id !== session.id) {
            return;
          }
          const now = Date.now();
          const renewed: HeartbeatState = {
            sessionId: session.id,
            lastHeartbeatAt: now,
            expiresAt: now + result.expires_in * 1000,
            retryAfter: 0
          };
          localStorage.setItem(heartbeatStorageKey, JSON.stringify(renewed));
          this.applyHeartbeatState(renewed);
          this.broadcast({ type: 'heartbeat', state: renewed });
        } catch (error) {
          if (this.session?.id !== session.id) {
            return;
          }
          const retryAfter = Date.now() + heartbeatRetryDelay;
          const failed: HeartbeatState = {
            sessionId: session.id,
            lastHeartbeatAt: session.lastHeartbeatAt,
            expiresAt: session.expiresAt,
            retryAfter
          };
          localStorage.setItem(heartbeatStorageKey, JSON.stringify(failed));
          this.retryAfter = retryAfter;
          this.renewalError.set('Session renewal is temporarily unavailable. The site will retry while you are active.');
          this.broadcast({ type: 'heartbeat-error', sessionId: session.id, retryAfter });
          console.error('Could not renew the session.', error);
        } finally {
          clearTimeout(timer);
        }
      });
    } catch (error) {
      console.error('Could not coordinate session renewal.', error);
      this.retryAfter = Date.now() + heartbeatRetryDelay;
      this.renewalError.set('Session renewal could not be coordinated. You may need to sign in again.');
    } finally {
      this.heartbeatPending = false;
      this.scheduleHeartbeat();
    }
  }

  private readHeartbeatState(): HeartbeatState | null {
    const stored = localStorage.getItem(heartbeatStorageKey);
    if (!stored) {
      return null;
    }
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== 'object' || !('sessionId' in value) || typeof value.sessionId !== 'string' ||
        !('lastHeartbeatAt' in value) || typeof value.lastHeartbeatAt !== 'number' || !Number.isFinite(value.lastHeartbeatAt) ||
        !('expiresAt' in value) || typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt) ||
        !('retryAfter' in value) || typeof value.retryAfter !== 'number' || !Number.isFinite(value.retryAfter)) {
      throw new Error('Invalid stored heartbeat state.');
    }
    return {
      sessionId: value.sessionId,
      lastHeartbeatAt: value.lastHeartbeatAt,
      expiresAt: value.expiresAt,
      retryAfter: value.retryAfter
    };
  }

  private applyHeartbeatState(state: HeartbeatState): void {
    if (!this.session || this.session.id !== state.sessionId) {
      return;
    }
    this.retryAfter = state.retryAfter;
    if (state.lastHeartbeatAt > this.session.lastHeartbeatAt) {
      this.session.lastHeartbeatAt = state.lastHeartbeatAt;
      this.session.expiresAt = state.expiresAt;
      this.renewalError.set('');
      this.scheduleExpiry();
    }
  }

  private refreshFromStoredHeartbeat(): void {
    if (!this.channel) {
      return;
    }
    try {
      const state = this.readHeartbeatState();
      if (state) {
        this.applyHeartbeatState(state);
      }
    } catch (error) {
      console.error('Could not read the shared session renewal state.', error);
      this.renewalError.set('Session renewal could not be coordinated. You may need to sign in again.');
    }
  }

  private broadcast(message: SessionMessage): void {
    this.channel?.postMessage(message);
  }

  private receiveMessage(value: unknown): void {
    if (!value || typeof value !== 'object' || !('type' in value)) {
      return;
    }
    if (value.type === 'request' && 'tabId' in value && typeof value.tabId === 'string') {
      if (this.getAccessToken() && this.session) {
        this.broadcast({ type: 'session', target: value.tabId, session: this.session });
      }
      return;
    }
    if (value.type === 'session' && 'session' in value && this.isSharedSession(value.session) &&
        (!('target' in value) || value.target === this.tabId)) {
      if (value.session.expiresAt > Date.now() &&
          (!this.session || (!('target' in value) &&
            (value.session.createdAt > this.session.createdAt ||
              (value.session.createdAt === this.session.createdAt && value.session.id > this.session.id))))) {
        this.applySession(value.session);
      }
      return;
    }
    if (value.type === 'clear' && 'sessionId' in value && value.sessionId === this.session?.id) {
      this.clearLocalSession();
      return;
    }
    if (value.type === 'ingest-state' && 'state' in value && this.isShayariIngestState(value.state) &&
        value.state.sessionId === this.session?.id) {
      const current = this.ingestStatus();
      if (!current || value.state.revision > current.revision) {
        this.ingestStatus.set(value.state);
      }
      return;
    }
    if (value.type === 'shayari-otp-request' && 'sessionId' in value && value.sessionId === this.session?.id &&
        'requestId' in value && typeof value.requestId === 'string' && value.requestId) {
      this.otpRequest.set(value.requestId);
      return;
    }
    const session = this.session;
    if (value.type === 'activity' && session && 'sessionId' in value && value.sessionId === session.id &&
        'at' in value && typeof value.at === 'number' && Number.isFinite(value.at) && value.at <= Date.now()) {
      session.lastActivityAt = Math.max(session.lastActivityAt, value.at);
      this.scheduleHeartbeat();
      return;
    }
    if (value.type === 'heartbeat' && 'state' in value && this.isHeartbeatState(value.state)) {
      this.applyHeartbeatState(value.state);
      this.scheduleHeartbeat();
      return;
    }
    if (value.type === 'heartbeat-error' && 'sessionId' in value && value.sessionId === this.session?.id &&
        'retryAfter' in value && typeof value.retryAfter === 'number' && Number.isFinite(value.retryAfter)) {
      this.retryAfter = value.retryAfter;
      this.renewalError.set('Session renewal is temporarily unavailable. The site will retry while you are active.');
      this.scheduleHeartbeat();
    }
  }

  private isSharedSession(value: unknown): value is SharedSession {
    if (!value || typeof value !== 'object' || !('user' in value) || !value.user || typeof value.user !== 'object' ||
        !('name' in value.user) || typeof value.user.name !== 'string' || !value.user.name.trim() ||
        !('picture' in value.user) || (value.user.picture !== null && typeof value.user.picture !== 'string') ||
        ('isAdmin' in value.user && typeof value.user.isAdmin !== 'boolean')) {
      return false;
    }
    return 'id' in value && typeof value.id === 'string' && !!value.id &&
      'accessToken' in value && typeof value.accessToken === 'string' && !!value.accessToken &&
      'createdAt' in value && typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) &&
      'expiresAt' in value && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt) &&
      'lastHeartbeatAt' in value && typeof value.lastHeartbeatAt === 'number' && Number.isFinite(value.lastHeartbeatAt) &&
      'lastActivityAt' in value && typeof value.lastActivityAt === 'number' && Number.isFinite(value.lastActivityAt);
  }

  private isHeartbeatState(value: unknown): value is HeartbeatState {
    return !!value && typeof value === 'object' &&
      'sessionId' in value && typeof value.sessionId === 'string' &&
      'lastHeartbeatAt' in value && typeof value.lastHeartbeatAt === 'number' && Number.isFinite(value.lastHeartbeatAt) &&
      'expiresAt' in value && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt) &&
      'retryAfter' in value && typeof value.retryAfter === 'number' && Number.isFinite(value.retryAfter);
  }
}
