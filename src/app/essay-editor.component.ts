import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VerifiedUserService } from './verified-user.service';

export interface EssayEditorRecord {
  slug: string;
  category: string;
  title: string;
  summary: string;
  author: string;
  publishedAt: string;
  file: string | null;
  html: string;
}

export interface EssayEditorSavedEvent {
  created: boolean;
  essay: EssayEditorRecord;
}

interface EssayDraft {
  title: string;
  category: string;
  html: string;
}

interface EssayApiConfig {
  intelliChatEndpoint: string;
}

@Component({
  selector: 'app-essay-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="essay-editor" aria-labelledby="essay-editor-title">
      <h2 id="essay-editor-title">{{ essay ? 'Edit this essay.' : 'Add a new essay.' }}</h2>
      <p>Paste your document into the writing area, then save it with an email verification code.</p>
      @if (verifiedUser.shayariIngestState()?.blocked; as reason) {
        <p class="essay-editor-error" role="alert">
          @if (reason === 'lockout') {
            Ingestion is locked on the server. An administrator must reset the OTP lock there.
          } @else if (reason === 'forbidden') {
            This account is not authorized to ingest essays.
          } @else if (reason === 'coordination') {
            Admin mode is unavailable because session coordination failed. Check your browser storage settings.
          } @else {
            Admin mode is disabled for this session after unsuccessful verification attempts.
          }
        </p>
      }
      <form (ngSubmit)="saveDraft()">
        <label for="essay-title-input">Title</label>
        <input id="essay-title-input" name="title" [(ngModel)]="title" type="text" required [disabled]="busy">
        <label for="essay-category-input">Category</label>
        <input id="essay-category-input" name="category" [(ngModel)]="category" type="text" required [disabled]="busy">
        <label for="essay-body-input">Essay</label>
        <div
          #bodyEditor
          id="essay-body-input"
          class="essay-editor-body"
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          aria-label="Essay content"
          [attr.aria-disabled]="busy"
          [attr.contenteditable]="busy ? 'false' : 'true'"
          [innerHTML]="initialHtml"
          (input)="captureHtml($event)"></div>
        @if (formError) {
          <p class="essay-editor-error" role="alert">{{ formError }}</p>
        }
        @if (formMessage) {
          <p class="essay-editor-message" role="status">{{ formMessage }}</p>
        }
        <div class="essay-editor-actions">
          <button class="essay-editor-save" type="submit" [disabled]="busy || !!verifiedUser.shayariIngestState()?.blocked">
            {{ essay ? 'Save changes' : 'Save essay' }}
          </button>
          <button class="essay-editor-cancel" type="button" (click)="cancel()" [disabled]="busy">Cancel</button>
        </div>
      </form>
    </section>
    <dialog #otpDialog class="essay-otp-dialog" aria-labelledby="essay-otp-title" (cancel)="onOtpCancel($event)">
      <p class="essay-otp-eyebrow">Admin verification</p>
      <h2 id="essay-otp-title">One more <em>step.</em></h2>
      <p>A one-time code will be sent to your authorized Google email. It expires in five minutes and is required to save this essay.</p>
      @if (busy) {
        <p role="status">{{ requestingOtp ? 'Sending your code…' : 'Saving your essay…' }}</p>
      }
      @if (otpMessage) {
        <p class="essay-editor-message" role="status">{{ otpMessage }}</p>
      }
      @if (otpError) {
        <p class="essay-editor-error" role="alert">{{ otpError }}</p>
      }
      <label for="essay-otp-input">Verification code</label>
      <input
        id="essay-otp-input"
        name="essayOtp"
        [(ngModel)]="otp"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
        pattern="[0-9]{6}"
        (keydown.enter)="submitOtp()"
        [disabled]="busy || !otpAvailable || !!verifiedUser.shayariIngestState()?.blocked">
      @if (otpAvailable) {
        <small>Code expires in {{ otpRemaining }} seconds.</small>
      }
      <div class="essay-editor-actions">
        <button class="essay-editor-save" type="button" (click)="submitOtp()" [disabled]="busy || !otpAvailable || !!verifiedUser.shayariIngestState()?.blocked">
          Verify and save
        </button>
        <button class="essay-editor-cancel" type="button" (click)="requestOtp()" [disabled]="busy || resendWait > 0 || !!verifiedUser.shayariIngestState()?.blocked">
          {{ resendWait > 0 ? 'Request another code in ' + resendWait + 's' : 'Request another code' }}
        </button>
        <button class="essay-editor-cancel" type="button" (click)="closeOtpDialog()" [disabled]="busy">Cancel</button>
      </div>
    </dialog>
  `,
  styles: [`
    .essay-editor { background: #f7f5f0; border: 1px solid #d8d3ca; color: #1c1b1a; margin: 30px 0; padding: clamp(22px, 4vw, 42px); }
    .essay-editor h2 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(30px, 5vw, 44px); letter-spacing: -.05em; margin: 0 0 10px; }
    .essay-editor > p { color: #716f6a; line-height: 1.6; margin: 0 0 28px; }
    .essay-editor form { display: grid; gap: 10px; }
    .essay-editor label, .essay-otp-dialog label { font-size: 13px; font-weight: 700; }
    .essay-editor input, .essay-otp-dialog input { background: #fff; border: 1px solid #c7c1b7; border-radius: 6px; box-sizing: border-box; color: #1c1b1a; font: inherit; padding: 12px; width: 100%; }
    .essay-editor-body { background: #fff; border: 1px solid #c7c1b7; color: #1c1b1a; font-size: 17px; line-height: 1.8; margin-top: 2px; min-height: 65vh; outline: none; overflow-wrap: anywhere; padding: clamp(20px, 5vw, 54px); }
    .essay-editor-body:focus { border-color: #f45b36; box-shadow: 0 0 0 1px #f45b36; }
    .essay-editor-body[aria-disabled='true'] { opacity: .7; pointer-events: none; }
    .essay-editor :is(input, .essay-editor-body):focus-visible, .essay-otp-dialog input:focus-visible { outline: 2px solid #f45b36; outline-offset: 3px; }
    .essay-editor-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
    .essay-editor-save, .essay-editor-cancel { border: 1px solid #1c1b1a; border-radius: 6px; cursor: pointer; font: inherit; font-weight: 700; padding: 12px 18px; }
    .essay-editor-save { background: #1c1b1a; color: #fff; }
    .essay-editor-cancel { background: transparent; color: inherit; }
    .essay-editor-save:disabled, .essay-editor-cancel:disabled { cursor: not-allowed; opacity: .55; }
    .essay-editor-error { color: #b3261e; line-height: 1.5; margin: 8px 0; }
    .essay-editor-message { color: #2e6d42; line-height: 1.5; margin: 8px 0; }
    .essay-otp-dialog { background: #f7f5f0; border: 1px solid #d8d3ca; border-radius: 12px; box-shadow: 0 20px 70px #0006; color: #1c1b1a; max-width: 480px; padding: 36px; width: calc(100% - 40px); }
    .essay-otp-dialog::backdrop { background: #1c1b1acc; }
    .essay-otp-dialog h2 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(34px, 6vw, 48px); letter-spacing: -.06em; margin: 0 0 18px; }
    .essay-otp-dialog h2 em { color: #f45b36; font-style: normal; }
    .essay-otp-dialog p { line-height: 1.6; }
    .essay-otp-dialog small { color: #716f6a; display: block; margin-top: 6px; }
    .essay-otp-eyebrow { color: #f45b36; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    :host-context(html[data-theme='night']) .essay-editor,
    :host-context(html[data-theme='night']) .essay-otp-dialog { background: #1c1b1a; border-color: #514c46; color: #f2efe9; }
    :host-context(html[data-theme='night']) .essay-editor > p,
    :host-context(html[data-theme='night']) .essay-otp-dialog small { color: #bdb7ad; }
    :host-context(html[data-theme='night']) .essay-editor input,
    :host-context(html[data-theme='night']) .essay-editor-body,
    :host-context(html[data-theme='night']) .essay-otp-dialog input { background: #11110f; border-color: #655f57; color: #f2efe9; color-scheme: dark; }
    :host-context(html[data-theme='night']) .essay-editor-save { background: #f45b36; border-color: #f45b36; color: #fff; }
    :host-context(html[data-theme='night']) .essay-editor-cancel { border-color: #817a70; }
    :host-context(html[data-theme='night']) .essay-editor-error { color: #ffb49f; }
    :host-context(html[data-theme='night']) .essay-editor-message { color: #a9d8b8; }
    @media (max-width: 600px) {
      .essay-otp-dialog { padding: 26px 22px; }
      .essay-editor-body { min-height: 60vh; }
    }
  `]
})
export class EssayEditorComponent implements OnChanges, OnDestroy {
  @Input() essay: EssayEditorRecord | null = null;
  @Output() readonly saved = new EventEmitter<EssayEditorSavedEvent>();
  @Output() readonly cancelled = new EventEmitter<void>();
  @ViewChild('otpDialog', { read: ElementRef }) private otpDialog?: ElementRef<HTMLDialogElement>;
  protected title = '';
  protected category = '';
  protected initialHtml = '';
  protected draftHtml = '';
  protected formError = '';
  protected formMessage = '';
  protected otp = '';
  protected otpError = '';
  protected otpMessage = '';
  protected busy = false;
  protected requestingOtp = false;
  protected now = Date.now();
  private htmlChanged = false;
  private nextOtpAt = 0;
  private otpExpiresAt = 0;
  private otpRequestId: string | null = null;
  private pendingDraft: EssayDraft | null = null;
  private requestController?: AbortController;
  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;

  constructor(protected readonly verifiedUser: VerifiedUserService) {
    effect(() => {
      const requestId = this.verifiedUser.shayariOtpRequest();
      if (requestId && requestId !== this.otpRequestId) {
        this.otpExpiresAt = 0;
        this.otp = '';
        this.otpMessage = '';
        this.otpError = 'A code was requested in another tab. The previous code may no longer be valid. Wait for the cooldown before requesting another.';
        this.now = Date.now();
        this.nextOtpAt = Math.max(this.nextOtpAt, this.now + 30000);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['essay']) {
      this.title = this.essay?.title ?? '';
      this.category = this.essay?.category ?? '';
      this.initialHtml = this.essay?.html ?? '';
      this.draftHtml = this.initialHtml;
      this.htmlChanged = false;
      this.formError = '';
      this.formMessage = '';
    }
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

  protected captureHtml(event: Event): void {
    if (!(event.target instanceof HTMLElement)) {
      throw new Error('Essay editor input target is unavailable.');
    }
    this.draftHtml = event.target.innerHTML;
    this.htmlChanged = true;
  }

  protected saveDraft(): void {
    if (this.busy) {
      return;
    }
    if (this.verifiedUser.user()?.isAdmin !== true) {
      this.formError = 'An authorized administrator must be signed in to save essays.';
      return;
    }
    const html = this.htmlChanged ? this.draftHtml : this.initialHtml;
    if (!this.title.trim() || !this.category.trim() || !this.hasText(html)) {
      this.formError = 'Please provide a title, category, and essay content.';
      return;
    }
    if (this.verifiedUser.shayariIngestState()?.blocked) {
      this.formError = 'Essay ingestion is currently blocked for this session.';
      return;
    }
    if (!this.verifiedUser.getAccessToken()) {
      this.formError = 'Your session has expired. Please sign in again.';
      return;
    }
    this.pendingDraft = {
      title: this.title.trim(),
      category: this.category.trim(),
      html
    };
    this.formError = '';
    this.formMessage = '';
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

  protected cancel(): void {
    if (!this.busy) {
      this.cancelled.emit();
    }
  }

  protected closeOtpDialog(): void {
    if (!this.busy) {
      this.otp = '';
      this.pendingDraft = null;
      this.otpDialog?.nativeElement.close();
    }
  }

  protected onOtpCancel(event: Event): void {
    if (this.busy) {
      event.preventDefault();
    } else {
      this.otp = '';
      this.pendingDraft = null;
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
      const { response, result } = await this.request('/ingest/essay/otp', token);
      if (!this.isCurrentSession(token)) {
        return;
      }
      if (response.status === 401) {
        this.verifiedUser.clear();
        this.otpError = 'Your session is no longer valid. Sign in again to continue.';
        return;
      }
      if (await this.handleBlockedResponse(response, token)) {
        return;
      }
      if (this.verifiedUser.shayariOtpRequest() !== requestId) {
        this.otpError = 'A newer code was requested in another tab. Wait for the cooldown before trying again.';
        return;
      }
      if (response.status === 429) {
        this.nextOtpAt = Date.now() + 30000;
        this.otpError = 'A code was requested too recently. Please wait before requesting another.';
        return;
      }
      if (response.status === 502) {
        this.otpError = 'The verification code could not be emailed. Please try again after the cooldown.';
        return;
      }
      if (response.status === 422) {
        this.otpError = 'The OTP request was not accepted. Check the request and try again.';
        return;
      }
      if (response.status === 503) {
        this.otpError = 'Essay ingestion is temporarily unavailable because server configuration is incomplete.';
        return;
      }
      if (!response.ok) {
        throw new Error(`Essay OTP endpoint returned HTTP ${response.status}.`);
      }
      if (!result || typeof result !== 'object' || !('sent' in result) || result.sent !== true ||
          !('expires_in' in result) || typeof result.expires_in !== 'number' ||
          !Number.isSafeInteger(result.expires_in) || result.expires_in <= 0 ||
          !Number.isSafeInteger(requestedAt + result.expires_in * 1000)) {
        throw new Error('Essay OTP endpoint returned an invalid response.');
      }
      this.otpExpiresAt = requestedAt + result.expires_in * 1000;
      this.otpMessage = 'A verification code was sent to your authorized Google email.';
      this.now = Date.now();
    } catch (error: unknown) {
      if (!this.isCurrentSession(token) || this.verifiedUser.shayariOtpRequest() !== requestId) {
        return;
      }
      console.error('Could not request an essay OTP.', error);
      this.otpError = 'The code could not be confirmed as sent. Please wait for the cooldown before trying again.';
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
    const draft = this.pendingDraft;
    const payload = this.essay
      ? { slug: this.essay.slug, ...draft }
      : draft;
    try {
      const { response, result } = await this.request('/ingest/essay', token, payload, this.otp);
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
        this.otpExpiresAt = 0;
        this.otpError = state?.blocked
          ? 'Ingestion is locked for this session after too many incorrect codes. An administrator must reset the lock on the server.'
          : `The code is incorrect or expired, or your session is no longer valid. ${3 - (state?.failures ?? 0)} attempt(s) remain.`;
        return;
      }
      if (await this.handleBlockedResponse(response, token)) {
        return;
      }
      if (response.status === 404) {
        this.otpError = 'This essay could not be found.';
        return;
      }
      if (response.status === 409) {
        this.otpError = 'This essay is deleted on the server and must be restored before it can be updated.';
        return;
      }
      if (response.status === 422) {
        this.otpError = 'The essay was not accepted. Check the title, category, and content.';
        return;
      }
      if (response.status === 503) {
        this.otpError = 'Essay ingestion is temporarily unavailable because server configuration is incomplete.';
        return;
      }
      if (!response.ok) {
        throw new Error(`Essay ingestion returned HTTP ${response.status}.`);
      }
      if (!this.isEssaySaveResponse(result, this.essay === null)) {
        throw new Error('Essay ingestion returned an invalid response.');
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
      this.pendingDraft = null;
      this.otpDialog?.nativeElement.close();
      this.formMessage = result.created ? 'Essay created successfully.' : 'Essay updated successfully.';
      this.saved.emit(result);
    } catch (error: unknown) {
      if (!this.isCurrentSession(token)) {
        return;
      }
      console.error('Could not confirm essay ingestion.', error);
      this.otpExpiresAt = 0;
      this.otp = '';
      this.otpError = 'The save could not be confirmed. It may have succeeded; check the essay list before retrying with a new code.';
    } finally {
      this.busy = false;
      this.now = Date.now();
    }
  }

  private hasText(html: string): boolean {
    return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').trim().length > 0;
  }

  private isEssaySaveResponse(value: unknown, expectedCreated: boolean): value is EssayEditorSavedEvent {
    if (!value || typeof value !== 'object' || !('created' in value) || value.created !== expectedCreated ||
        !('essay' in value) || !value.essay || typeof value.essay !== 'object') {
      return false;
    }
    const essay = value.essay as Record<string, unknown>;
    return typeof essay['slug'] === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(essay['slug']) &&
      typeof essay['category'] === 'string' && !!essay['category'].trim() &&
      typeof essay['title'] === 'string' && !!essay['title'].trim() &&
      typeof essay['summary'] === 'string' &&
      typeof essay['author'] === 'string' && !!essay['author'].trim() &&
      typeof essay['publishedAt'] === 'string' && Number.isFinite(Date.parse(essay['publishedAt'])) &&
      ('file' in essay) && (essay['file'] === null || typeof essay['file'] === 'string') &&
      typeof essay['html'] === 'string' &&
      'proof' in essay && !!essay['proof'] && typeof essay['proof'] === 'object' && !Array.isArray(essay['proof']);
  }

  private async handleBlockedResponse(response: Response, token: string): Promise<boolean> {
    if (response.status === 403 || response.status === 423) {
      const reason = response.status === 423 ? 'lockout' : 'forbidden';
      await this.verifiedUser.blockShayariIngest(token, reason);
      if (this.isCurrentSession(token)) {
        this.otpError = reason === 'lockout'
          ? 'Ingestion is locked on the server. An administrator must reset the OTP lock there.'
          : 'This account is not authorized to ingest essays.';
      }
      return true;
    }
    return false;
  }

  private isCurrentSession(token: string): boolean {
    return !this.destroyed && this.verifiedUser.getAccessToken() === token;
  }

  private async request(
    path: string,
    token: string,
    draft?: EssayDraft & { slug?: string },
    otp?: string
  ): Promise<{ response: Response; result: unknown }> {
    const controller = new AbortController();
    this.requestController?.abort();
    this.requestController = controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const profileResponse = await fetch('/assets/profile/profile.json', { signal: controller.signal });
      if (!profileResponse.ok) {
        throw new Error(`Could not load API configuration (HTTP ${profileResponse.status}).`);
      }
      const profile: unknown = await profileResponse.json();
      if (!profile || typeof profile !== 'object' || !('intelliChatEndpoint' in profile) ||
          typeof profile.intelliChatEndpoint !== 'string') {
        throw new Error('Invalid API configuration.');
      }
      const config = profile as EssayApiConfig;
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (draft && otp) {
        headers['Content-Type'] = 'application/json';
        headers['X-Ingest-OTP'] = otp;
      }
      const response = await fetch(new URL(path, config.intelliChatEndpoint), {
        method: 'POST',
        headers,
        body: draft ? JSON.stringify(draft) : undefined,
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
