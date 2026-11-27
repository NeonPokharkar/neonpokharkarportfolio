import { Component, effect, ElementRef, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VerifiedUserService } from './verified-user.service';

interface ShayariDraft {
  text: string;
  date: string;
  type: string;
  language: string;
}

@Component({
  selector: 'app-shayari-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section id="shayari-editor" class="shayari-editor" aria-labelledby="shayari-editor-title">
      <h2 id="shayari-editor-title">Add a shayari.</h2>
      <p>Write a new entry below. You will need an email verification code to submit it. Drafts are not saved.</p>
      <form #shayariForm="ngForm" (ngSubmit)="submitShayari()">
        <label for="shayari-text">Shayari</label>
        <textarea id="shayari-text" name="shayariText" [(ngModel)]="draftText" rows="7" required></textarea>
        <div class="shayari-editor-fields">
          <div>
            <label for="shayari-type">Type</label>
            <input id="shayari-type" name="shayariType" [(ngModel)]="draftType" type="text" required>
          </div>
          <div>
            <label for="shayari-language">Language</label>
            <select id="shayari-language" name="shayariLanguage" [(ngModel)]="draftLanguage" required>
              <option value="" disabled>Select a language</option>
              <option value="English">English</option>
              <option value="Marathi">Marathi</option>
              <option value="Hindi">Hindi</option>
            </select>
          </div>
          <div>
            <label for="shayari-date">Date</label>
            <input id="shayari-date" name="shayariDate" [(ngModel)]="draftDate" type="date" min="0001-01-01" max="9999-12-31" required>
            @if (formattedDraftDate) {
              <small>{{ formattedDraftDate }}</small>
            }
          </div>
        </div>
        <button class="shayari-verify-button" type="submit" [disabled]="shayariForm.invalid || !!verifiedUser.shayariIngestState()?.blocked">Submit Shayari</button>
        @if (draftMessage) {
          <p class="shayari-editor-message" role="status">{{ draftMessage }}</p>
        }
      </form>
    </section>
    <dialog #otpDialog class="otp-dialog" aria-labelledby="otp-title" aria-describedby="otp-description" (cancel)="onOtpCancel($event)">
      <button class="otp-close" type="button" aria-label="Close verification dialog" (click)="closeOtpDialog()" [disabled]="busy">×</button>
      <p class="otp-eyebrow">Admin verification</p>
      <h2 id="otp-title">One more <em>step.</em></h2>
      <p id="otp-description">Enter the six-digit code sent to your authorized Google email. The code is verified when you submit your shayari.</p>
      @if (busy) {
        <p role="status">{{ requestingOtp ? 'Sending your code…' : 'Verifying and submitting…' }}</p>
      }
      @if (otpMessage) {
        <p class="otp-message" role="status">{{ otpMessage }}</p>
      }
      @if (otpError) {
        <p class="otp-error" role="alert">{{ otpError }}</p>
      }
      <label for="shayari-otp">Verification code</label>
      <input id="shayari-otp" name="shayariOtp" [(ngModel)]="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" (keydown.enter)="submitOtp()" [disabled]="busy || !otpAvailable || !!verifiedUser.shayariIngestState()?.blocked">
      @if (otpAvailable) {
        <small>Code expires in {{ otpRemaining }} seconds.</small>
      }
      <div class="otp-actions">
        <button class="shayari-verify-button" type="button" (click)="submitOtp()" [disabled]="busy || !otpAvailable || !!verifiedUser.shayariIngestState()?.blocked">Verify and submit</button>
        <button class="otp-resend" type="button" (click)="requestOtp()" [disabled]="busy || resendWait > 0 || !!verifiedUser.shayariIngestState()?.blocked">
          {{ resendWait > 0 ? 'Request another code in ' + resendWait + 's' : 'Request another code' }}
        </button>
      </div>
    </dialog>
  `,
  styles: [`
    .shayari-editor { background: #f7f5f0; border: 1px solid #d8d3ca; border-radius: 16px; color: #1c1b1a; margin-top: 20px; max-width: 760px; padding: 28px; }
    .shayari-editor h2 { font-family: 'Space Grotesk', sans-serif; font-size: 30px; letter-spacing: -.04em; margin: 0 0 12px; }
    .shayari-editor > p { color: #716f6a; line-height: 1.6; margin: 0 0 24px; }
    .shayari-editor form { display: grid; gap: 12px; }
    .shayari-editor label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; }
    .shayari-editor textarea, .shayari-editor input, .shayari-editor select { background: #fff; border: 1px solid #c7c1b7; border-radius: 8px; box-sizing: border-box; color: #1c1b1a; font: inherit; padding: 12px; width: 100%; }
    .shayari-editor textarea { min-height: 160px; resize: vertical; }
    .shayari-editor :is(textarea, input, select):focus-visible { outline: 2px solid #f45b36; outline-offset: 2px; }
    .shayari-editor-fields { display: grid; gap: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 8px 0 12px; }
    .shayari-editor small { color: #716f6a; display: block; margin-top: 6px; }
    .shayari-editor form > button { justify-self: start; }
    .shayari-verify-button { background: #f45b36; border: 0; border-radius: 8px; color: #fff; cursor: pointer; font: inherit; font-weight: 700; padding: 16px 24px; }
    .shayari-verify-button:disabled { cursor: not-allowed; opacity: .7; }
    .shayari-verify-button:focus-visible { outline: 2px solid #f45b36; outline-offset: 4px; }
    .shayari-editor-message { line-height: 1.5; margin: 0; }
    .otp-dialog { background: #f7f5f0; border: 1px solid #d8d3ca; border-radius: 16px; box-shadow: 0 20px 70px #0006; color: #1c1b1a; max-width: 470px; padding: 42px; width: calc(100% - 40px); }
    .otp-dialog::backdrop { background: #1c1b1acc; }
    .otp-close { background: transparent; border: 0; color: inherit; cursor: pointer; font-size: 28px; position: absolute; right: 18px; top: 14px; }
    .otp-eyebrow { color: #f45b36; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .otp-dialog h2 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(32px, 6vw, 48px); letter-spacing: -.06em; line-height: .95; margin: 0 0 22px; }
    .otp-dialog h2 em { color: #f45b36; font-style: normal; }
    .otp-dialog p { line-height: 1.6; }
    .otp-dialog label { display: block; font-size: 13px; font-weight: 700; margin: 20px 0 6px; }
    .otp-dialog input { background: #fff; border: 1px solid #c7c1b7; border-radius: 8px; box-sizing: border-box; color: #1c1b1a; font: inherit; letter-spacing: .2em; padding: 12px; width: 100%; }
    .otp-dialog small { color: #716f6a; display: block; margin-top: 6px; }
    .otp-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 22px; }
    .otp-resend { background: transparent; border: 1px solid currentColor; border-radius: 8px; color: inherit; cursor: pointer; font: inherit; padding: 12px; }
    .otp-resend:disabled { cursor: not-allowed; opacity: .6; }
    .otp-dialog :is(button, input):focus-visible { outline: 2px solid #f45b36; outline-offset: 3px; }
    .otp-error { color: #b3261e; }
    :host-context(html[data-theme='night']) .shayari-editor { background: #1c1b1a; border-color: #514c46; color: #f2efe9; }
    :host-context(html[data-theme='night']) .shayari-editor > p, :host-context(html[data-theme='night']) .shayari-editor small { color: #bdb7ad; }
    :host-context(html[data-theme='night']) .shayari-editor :is(textarea, input, select) { background: #2a2826; border-color: #655f57; color: #f2efe9; color-scheme: dark; }
    :host-context(html[data-theme='night']) .otp-dialog { background: #1c1b1a; border-color: #514c46; color: #f2efe9; }
    :host-context(html[data-theme='night']) .otp-dialog input { background: #2a2826; border-color: #655f57; color: #f2efe9; }
    :host-context(html[data-theme='night']) .otp-dialog small { color: #bdb7ad; }
    :host-context(html[data-theme='night']) .otp-error { color: #ffb49f; }
    @media (max-width: 600px) {
      .shayari-editor { padding: 22px; }
      .shayari-editor-fields { grid-template-columns: 1fr; }
      .otp-dialog { padding: 32px 24px; }
    }
  `]
})
export class ShayariEditorComponent implements OnDestroy {
  @Output() readonly refreshRequested = new EventEmitter<void>();
  @ViewChild('otpDialog', { read: ElementRef }) private otpDialog?: ElementRef<HTMLDialogElement>;
  protected draftText = '';
  protected draftType = '';
  protected draftLanguage = '';
  protected draftDate: string;
  protected draftMessage = '';
  protected otp = '';
  protected otpMessage = '';
  protected otpError = '';
  protected busy = false;
  protected requestingOtp = false;
  protected now = Date.now();
  private nextOtpAt = 0;
  private otpExpiresAt = 0;
  private otpRequestId: string | null = null;
  private pendingDraft: ShayariDraft | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private requestController?: AbortController;
  private destroyed = false;

  constructor(protected readonly verifiedUser: VerifiedUserService) {
    const now = new Date();
    this.draftDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    effect(() => {
      const requestId = this.verifiedUser.shayariOtpRequest();
      if (requestId && requestId !== this.otpRequestId) {
        this.otpExpiresAt = 0;
        this.otp = '';
        this.otpMessage = '';
        this.otpError = 'A code was requested in another tab. Request a fresh code after the cooldown; the previous code may no longer be valid.';
        this.now = Date.now();
        this.nextOtpAt = Math.max(this.nextOtpAt, this.now + 30000);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.requestController?.abort();
    if (this.timer !== undefined) {
      clearInterval(this.timer);
    }
  }

  protected get resendWait(): number {
    return Math.max(0, Math.ceil((this.nextOtpAt - this.now) / 1000));
  }

  protected get otpRemaining(): number {
    return Math.max(0, Math.ceil((this.otpExpiresAt - this.now) / 1000));
  }

  protected get otpAvailable(): boolean {
    return this.otpRemaining > 0;
  }

  protected get formattedDraftDate(): string {
    if (!this.draftDate) {
      return '';
    }
    const date = new Date(`${this.draftDate}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  }

  protected submitShayari(): void {
    if (!this.draftText.trim() || !this.draftType.trim()) {
      this.draftMessage = 'Please enter shayari text and a type.';
      return;
    }
    if (this.verifiedUser.user()?.isAdmin !== true || this.verifiedUser.shayariIngestState()?.blocked) {
      return;
    }
    if (!this.verifiedUser.getAccessToken()) {
      this.draftMessage = 'Your session has expired. Please sign in again.';
      return;
    }
    this.pendingDraft = {
      text: this.draftText,
      date: this.draftDate,
      type: this.draftType,
      language: this.draftLanguage
    };
    this.draftMessage = '';
    this.otpError = '';
    this.otpDialog?.nativeElement.showModal();
    if (this.timer === undefined) {
      this.timer = setInterval(() => { this.now = Date.now(); }, 1000);
    }
    this.now = Date.now();
    if (!this.otpAvailable && !this.resendWait) {
      void this.requestOtp();
    }
  }

  protected closeOtpDialog(): void {
    if (!this.busy) {
      this.otp = '';
      this.otpDialog?.nativeElement.close();
    }
  }

  protected onOtpCancel(event: Event): void {
    if (this.busy) {
      event.preventDefault();
    } else {
      this.otp = '';
    }
  }

  protected async requestOtp(): Promise<void> {
    const token = this.verifiedUser.getAccessToken();
    this.now = Date.now();
    if (this.busy || !token || this.resendWait || this.verifiedUser.user()?.isAdmin !== true ||
        this.verifiedUser.shayariIngestState()?.blocked) {
      return;
    }
    this.busy = true;
    this.requestingOtp = true;
    this.otp = '';
    this.otpError = '';
    this.otpMessage = '';
    this.otpExpiresAt = 0;
    const requestId = this.verifiedUser.announceShayariOtpRequest(token);
    if (!requestId) {
      this.busy = false;
      this.requestingOtp = false;
      return;
    }
    this.otpRequestId = requestId;
    const requestedAt = Date.now();
    this.nextOtpAt = requestedAt + 30000;
    this.now = requestedAt;
    try {
      const { response, result } = await this.request('/ingest/shayari/otp', token);
      if (!this.isCurrentSession(token)) {
        return;
      }
      if (response.status === 401) {
        this.verifiedUser.clear();
        return;
      }
      if (await this.handleBlockedResponse(response, token)) {
        return;
      }
      if (this.verifiedUser.shayariOtpRequest() !== requestId) {
        return;
      }
      if (response.status === 429) {
        this.nextOtpAt = Date.now() + 30000;
        this.otpError = 'A code was requested too recently. Please wait before requesting another.';
        return;
      }
      if (!response.ok) {
        throw new Error(`OTP endpoint returned HTTP ${response.status}.`);
      }
      if (!result || typeof result !== 'object' || !('sent' in result) || result.sent !== true ||
          !('expires_in' in result) || typeof result.expires_in !== 'number' ||
          !Number.isSafeInteger(result.expires_in) || result.expires_in <= 0 ||
          !Number.isSafeInteger(requestedAt + result.expires_in * 1000)) {
        throw new Error('OTP endpoint returned an invalid response.');
      }
      if (!this.isCurrentSession(token) || this.verifiedUser.shayariOtpRequest() !== requestId) {
        return;
      }
      this.otpExpiresAt = requestedAt + result.expires_in * 1000;
      this.otpMessage = 'A code was sent to your authorized Google email.';
      this.now = Date.now();
    } catch (error) {
      if (!this.isCurrentSession(token) || this.verifiedUser.shayariOtpRequest() !== requestId) {
        return;
      }
      console.error('Could not request a Shayari OTP.', error);
      this.otpError = 'The code could not be confirmed as sent. Please request another after the cooldown.';
    } finally {
      this.busy = false;
      this.requestingOtp = false;
      this.now = Date.now();
    }
  }

  protected async submitOtp(): Promise<void> {
    const token = this.verifiedUser.getAccessToken();
    this.now = Date.now();
    if (this.busy || !token || !this.pendingDraft || !this.otpAvailable ||
        this.verifiedUser.user()?.isAdmin !== true || this.verifiedUser.shayariIngestState()?.blocked) {
      return;
    }
    if (!/^\d{6}$/.test(this.otp)) {
      this.otpError = 'Enter the six-digit verification code.';
      return;
    }
    this.busy = true;
    this.otpError = '';
    this.otpMessage = '';
    try {
      const { response, result } = await this.request('/ingest/shayari', token, this.pendingDraft, this.otp);
      if (!this.isCurrentSession(token)) {
        return;
      }
      if (response.status === 401) {
        await this.verifiedUser.recordShayariIngestFailure(token);
        if (!this.isCurrentSession(token)) {
          return;
        }
        const state = this.verifiedUser.shayariIngestState();
        this.otp = '';
        this.otpError = state?.blocked
          ? 'Admin mode is disabled for this session after unsuccessful verification attempts.'
          : `The code is incorrect or expired, or your session is no longer valid. ${3 - (state?.failures ?? 0)} attempt(s) remain.`;
        return;
      }
      if (await this.handleBlockedResponse(response, token)) {
        return;
      }
      if (!response.ok) {
        throw new Error(`Shayari ingestion returned HTTP ${response.status}.`);
      }
      if (!result || typeof result !== 'object' || !('count' in result) || result.count !== 1 ||
          !('inserted' in result) || typeof result.inserted !== 'number' ||
          !('updated' in result) || typeof result.updated !== 'number' ||
          !Number.isInteger(result.inserted) || !Number.isInteger(result.updated) ||
          result.inserted < 0 || result.updated < 0 || result.inserted + result.updated !== 1 ||
          !('ids' in result) || !Array.isArray(result.ids) || result.ids.length !== 1 ||
          typeof result.ids[0] !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.ids[0])) {
        throw new Error('Shayari ingestion returned an invalid response.');
      }
      if (!this.isCurrentSession(token)) {
        return;
      }
      await this.verifiedUser.resetShayariIngestFailures(token);
      if (!this.isCurrentSession(token)) {
        return;
      }
      this.otpExpiresAt = 0;
      this.otp = '';
      this.otpDialog?.nativeElement.close();
      this.draftText = '';
      this.draftType = '';
      this.draftLanguage = '';
      this.pendingDraft = null;
      this.draftMessage = 'Shayari submitted successfully.';
      this.refreshRequested.emit();
    } catch (error) {
      if (!this.isCurrentSession(token)) {
        return;
      }
      console.error('Could not confirm Shayari ingestion.', error);
      this.otpExpiresAt = 0;
      this.otp = '';
      this.otpError = 'Submission could not be confirmed and may have succeeded. Check the refreshed Shayari list before retrying with a new code to avoid a duplicate.';
      this.refreshRequested.emit();
    } finally {
      this.busy = false;
      this.now = Date.now();
    }
  }

  private async handleBlockedResponse(response: Response, token: string): Promise<boolean> {
    if (response.status === 403 || response.status === 423) {
      const reason = response.status === 423 ? 'lockout' : 'forbidden';
      await this.verifiedUser.blockShayariIngest(token, reason);
      if (this.isCurrentSession(token)) {
        this.otpError = reason === 'lockout'
          ? 'Ingestion is locked on the server. An administrator must reset the OTP lock there.'
          : 'This account is not authorized to add shayari.';
      }
      return true;
    }
    return false;
  }

  private isCurrentSession(token: string): boolean {
    return !this.destroyed && this.verifiedUser.getAccessToken() === token;
  }

  private async request(path: string, token: string, draft?: ShayariDraft, otp?: string): Promise<{ response: Response; result: unknown }> {
    const controller = new AbortController();
    this.requestController = controller;
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
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (draft && otp) {
        headers['Content-Type'] = 'application/json';
        headers['X-Ingest-OTP'] = otp;
      }
      const response = await fetch(new URL(path, profile.intelliChatEndpoint), {
        method: 'POST',
        headers,
        body: draft ? JSON.stringify({ shayari: [draft] }) : undefined,
        signal: controller.signal
      });
      const result: unknown = response.ok ? await response.json() : null;
      return { response, result };
    } finally {
      clearTimeout(timer);
      if (this.requestController === controller) {
        this.requestController = undefined;
      }
    }
  }
}
