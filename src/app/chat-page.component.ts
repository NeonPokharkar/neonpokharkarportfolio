import { Component, effect, ElementRef, HostListener, NgZone, OnDestroy, OnInit, Pipe, PipeTransform, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Marked } from 'marked';
import { Subscription } from 'rxjs';
import { chatAuthenticationPrompt, createChatRequestHeaders, isChatAuthenticationRequired } from './chat-auth';
import { ChatSessionChannel, ChatSessionState, createChatSessionChannel } from './chat-session';
import { readIntelliChatFinalAnswer } from './intelli-chat-stream';
import { VerifiedUserService } from './verified-user.service';

const chatMarkdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html: ({ text }) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    image: ({ text }) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
});

@Pipe({ name: 'chatMarkdown', standalone: true })
class ChatMarkdownPipe implements PipeTransform {
  transform(content: string): string {
    return chatMarkdown.parse(content, { async: false });
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface WelcomeContent {
  tagline: string;
  suggestions: { icon: string; label: string; prompt: string }[];
}

function isWelcomeContent(value: unknown): value is WelcomeContent {
  if (typeof value !== 'object' || value === null || !('tagline' in value) || !('suggestions' in value)) {
    return false;
  }
  return typeof value.tagline === 'string' && value.tagline.trim().length > 0 &&
    Array.isArray(value.suggestions) && value.suggestions.every((suggestion: unknown) =>
      typeof suggestion === 'object' && suggestion !== null &&
      'icon' in suggestion && typeof suggestion.icon === 'string' &&
      'label' in suggestion && typeof suggestion.label === 'string' && suggestion.label.trim().length > 0 &&
      'prompt' in suggestion && typeof suggestion.prompt === 'string' && suggestion.prompt.trim().length > 0
    );
}

interface SpeechResultEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechErrorEvent extends Event {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [FormsModule, ChatMarkdownPipe],
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.css'
})
export class ChatPageComponent implements OnInit, OnDestroy {
  protected intelliChatEndpoint = '';
  protected chatBusy = false;
  protected chatInput = '';
  protected chatError = '';
  protected chatRequiresSignIn = false;
  protected voiceError = '';
  protected actionNotice = '';
  protected welcomeContent: WelcomeContent | null = null;
  protected welcomeError = '';
  protected voiceListening = false;
  protected voiceStopping = false;
  protected isWelcomeState = true;
  protected hasNewTurn = false;
  protected readonly chatMessages: ChatMessage[] = [
    {
      role: 'assistant',
      content: 'Hi! I am Aditya\'s AI assistant. Ask me about his experience, projects, or technical skills.'
    }
  ];

  private conversationSummary = '';
  private lastRelevantConversation = '';
  private recognition: BrowserSpeechRecognition | null = null;
  private followConversation = true;
  private promptSubscription?: Subscription;
  private initialPromptHandled = false;
  private destroyed = false;
  private chatSessionSync?: ChatSessionChannel;
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private zone: NgZone,
    protected readonly verifiedUser: VerifiedUserService
  ) {
    effect(() => {
      if (this.verifiedUser.user()) {
        this.chatRequiresSignIn = false;
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.initializeChatSessionSync(this.route.snapshot.fragment);
    void this.loadWelcomeContent();
    await this.loadProfile();
    if (this.destroyed) {
      return;
    }

    this.promptSubscription = this.route.queryParamMap.subscribe(params => {
      const prompt = params.get('prompt');
      if (prompt) {
        this.chatInput = prompt;
        this.publishChatSessionState();
        if (params.get('autoSend') === '1' && !this.initialPromptHandled) {
          this.initialPromptHandled = true;
          void this.submitInitialPrompt();
        }
      }
    });

    // Auto-focus the input field
    setTimeout(() => {
      const input = document.querySelector<HTMLTextAreaElement>('textarea[name="chatInput"]');
      input?.focus();
    }, 100);
  }

  private async loadWelcomeContent(): Promise<void> {
    try {
      const response = await fetch('assets/chat/welcome.json');
      if (!response.ok) {
        throw new Error(`Welcome content returned HTTP ${response.status}.`);
      }
      const content: unknown = await response.json();
      if (!isWelcomeContent(content)) {
        throw new Error('Welcome content has an invalid format.');
      }
      this.welcomeContent = content;
    } catch (error) {
      console.error('Could not load chat welcome content.', error);
      this.welcomeError = 'Could not load the welcome message and suggested questions. You can still type a question below.';
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.chatSessionSync?.close();
    this.promptSubscription?.unsubscribe();
    this.cancelDictation();
  }

  protected onChatInputChange(value: string): void {
    this.chatInput = value;
    this.publishChatSessionState();
  }

  private initializeChatSessionSync(sessionId: string | null): void {
    if (!sessionId) {
      return;
    }

    this.chatSessionSync = createChatSessionChannel(
      sessionId,
      (state) => this.zone.run(() => this.applyChatSessionState(state)),
      () => this.chatSessionSync?.publish(this.getChatSessionState())
    ) ?? undefined;
    this.chatSessionSync?.requestInitialState();
  }

  private getChatSessionState(): ChatSessionState {
    return {
      messages: this.chatMessages.slice(1).map(({ role, content }) => ({ role, content })),
      draft: this.chatInput,
      conversationSummary: this.conversationSummary,
      lastRelevantConversation: this.lastRelevantConversation,
      busy: this.chatBusy,
      requiresSignIn: this.chatRequiresSignIn
    };
  }

  private applyChatSessionState(state: ChatSessionState): void {
    this.chatMessages.splice(1, this.chatMessages.length - 1, ...state.messages);
    this.chatInput = state.draft;
    this.conversationSummary = state.conversationSummary;
    this.lastRelevantConversation = state.lastRelevantConversation;
    this.chatBusy = state.busy;
    this.chatRequiresSignIn = state.requiresSignIn;
    this.isWelcomeState = !state.messages.some(message => message.content.trim().length > 0);
    this.hasNewTurn = state.messages.length > 0;
    this.updateConversationScroll();
  }

  private publishChatSessionState(): void {
    this.chatSessionSync?.publish(this.getChatSessionState());
  }

  private async submitInitialPrompt(): Promise<void> {
    try {
      const cleared = await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { prompt: null, autoSend: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
      if (!cleared) {
        throw new Error('Could not clear the initial chat prompt.');
      }
      if (!this.destroyed) {
        await this.sendChatMessage();
      }
    } catch (error) {
      console.error('Could not submit the initial chat prompt.', error);
      this.chatError = 'Could not submit the question automatically. Please send it manually.';
    }
  }

  protected toggleDictation(): void {
    if (this.recognition) {
      if (!this.voiceStopping) {
        this.voiceStopping = true;
        this.recognition.stop();
      }
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.voiceError = 'Voice input is not supported in this browser. Try a supported browser such as Chrome or Edge.';
      return;
    }

    this.voiceError = '';
    const recognition = new SpeechRecognition();
    const finalResults = new Set<number>();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language || 'en-US';
    recognition.onresult = (event) => this.zone.run(() => {
      if (this.recognition !== recognition) return;
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal && !finalResults.has(index)) {
          finalResults.add(index);
          const transcript = result[0].transcript.trim();
          if (transcript) {
            this.chatInput += `${this.chatInput && !/\s$/.test(this.chatInput) ? ' ' : ''}${transcript}`;
          }
        }
      }
    });
    recognition.onerror = (event) => this.zone.run(() => {
      if (this.recognition !== recognition) return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.voiceError = 'Microphone access was denied. Allow microphone access in your browser and try again.';
      } else if (event.error === 'no-speech') {
        this.voiceError = 'No speech was detected. Try again.';
      } else if (event.error === 'audio-capture') {
        this.voiceError = 'No microphone was found. Check your microphone and try again.';
      } else {
        this.voiceError = `Voice input failed (${event.error}). Please try again.`;
      }
    });
    recognition.onend = () => this.zone.run(() => {
      if (this.recognition !== recognition) return;
      this.recognition = null;
      this.voiceListening = false;
      this.voiceStopping = false;
    });
    this.recognition = recognition;
    this.voiceListening = true;
    try {
      recognition.start();
    } catch (error) {
      this.recognition = null;
      this.voiceListening = false;
      this.voiceError = 'Could not start voice input. Check your microphone and try again.';
      console.error('Could not start voice input.', error);
    }
  }

  private cancelDictation(): void {
    const recognition = this.recognition;
    this.recognition = null;
    this.voiceListening = false;
    this.voiceStopping = false;
    recognition?.abort();
  }

  private async loadProfile(): Promise<void> {
    try {
      const response = await fetch('assets/profile/profile.json');
      if (!response.ok) {
        return;
      }
      const profile = await response.json() as { intelliChatEndpoint: string };
      this.intelliChatEndpoint = profile.intelliChatEndpoint;
    } catch {
      this.chatError = 'Failed to load profile configuration.';
    }
  }

  protected onChatInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
      return;
    }

    event.preventDefault();
    void this.sendChatMessage();
  }

  protected resizeChatInput(event: Event): void {
    const textarea = event.target;
    if (!(textarea instanceof HTMLTextAreaElement)) {
      return;
    }

    textarea.style.height = 'auto';
    const maxHeight = Number.parseFloat(getComputedStyle(textarea).maxHeight);
    const contentHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(contentHeight, maxHeight)}px`;
    textarea.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
  }

  protected async sendChatMessage(): Promise<void> {
    const content = this.chatInput.trim();
    if (!content || this.chatBusy || this.chatRequiresSignIn) {
      return;
    }

    if (!this.verifiedUser.ready()) {
      this.chatError = 'Checking your sign-in session. Please try again in a moment.';
      return;
    }

    if (!this.intelliChatEndpoint) {
      this.chatError = 'The AI chat endpoint is not available yet. Please try again shortly.';
      return;
    }

    this.cancelDictation();
    this.isWelcomeState = false; // Switch to conversation view when first message is sent
    this.chatMessages.push({ role: 'user', content });
    this.chatInput = '';
    this.chatError = '';
    this.chatRequiresSignIn = false;
    this.actionNotice = '';
    this.chatBusy = true;
    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    this.chatMessages.push(assistantMessage);
    this.publishChatSessionState();

    this.hasNewTurn = true;
    this.followConversation = true;
    this.updateConversationScroll();

    try {
      const accessToken = this.verifiedUser.getAccessToken();
      const response = await fetch(this.intelliChatEndpoint, {
        method: 'POST',
        headers: createChatRequestHeaders(accessToken),
        body: JSON.stringify({
          query: content,
          conversation_summary: this.conversationSummary,
          last_relevant_conversation: this.lastRelevantConversation
        })
      });

      if (await isChatAuthenticationRequired(response)) {
        if (accessToken) {
          this.verifiedUser.clear();
        }
        this.chatMessages.splice(this.chatMessages.indexOf(assistantMessage), 1);
        this.chatRequiresSignIn = true;
        this.publishChatSessionState();
        this.updateConversationScroll();
        return;
      }

      if (!response.ok) {
        throw new Error(`The AI chat server returned HTTP ${response.status}.`);
      }

      assistantMessage.content = await readIntelliChatFinalAnswer(
        response,
        (answer) => {
          assistantMessage.content = answer;
          this.publishChatSessionState();
          this.updateConversationScroll();
        }
      );

      this.conversationSummary = [this.conversationSummary, this.lastRelevantConversation]
        .filter(Boolean)
        .join('\n');
      this.lastRelevantConversation = `User: ${content}\nAssistant: ${assistantMessage.content}`;
      this.publishChatSessionState();
      this.updateConversationScroll();
    } catch (error: unknown) {
      const assistantMessageIndex = this.chatMessages.indexOf(assistantMessage);
      if (assistantMessageIndex !== -1) {
        this.chatMessages.splice(assistantMessageIndex, 1);
      }
      this.chatError = error instanceof Error
        ? `${error.message} Make sure the API is running at ${this.intelliChatEndpoint} and allows requests from this app.`
        : `Unable to connect to the AI chat server at ${this.intelliChatEndpoint}.`;
      this.publishChatSessionState();
      this.updateConversationScroll();
    } finally {
      this.chatBusy = false;
      this.publishChatSessionState();
    }
  }

  protected openGoogleSignIn(): void {
    window.dispatchEvent(new CustomEvent('open-chat-signin'));
  }

  protected get chatAuthenticationMessage(): string {
    return chatAuthenticationPrompt;
  }

  protected submitSuggestion(suggestion: string): void {
    this.cancelDictation();
    this.chatInput = suggestion;
    this.publishChatSessionState();
    // Send the message after a brief delay to allow Angular change detection
    setTimeout(() => {
      this.sendChatMessage();
    }, 0);
  }

  protected onConversationScroll(): void {
    const container = this.messagesContainer?.nativeElement;
    if (container) {
      this.followConversation = container.scrollHeight - container.scrollTop - container.clientHeight <= 48;
    }
  }

  @HostListener('window:resize')
  protected onConversationResize(): void {
    if (this.hasNewTurn) {
      this.updateConversationScroll();
    }
  }

  private updateConversationScroll(): void {
    setTimeout(() => {
      const container = this.messagesContainer?.nativeElement;
      const spacer = container?.querySelector<HTMLElement>('.chat-scroll-spacer');
      const messages = container?.querySelectorAll<HTMLElement>('.chat-message-expanded');
      const questions = container?.querySelectorAll<HTMLElement>('.chat-message-expanded-user');
      if (!container || !spacer || !messages?.length || !questions?.length) return;

      const lastMessage = messages[messages.length - 1];
      const lastQuestion = questions[questions.length - 1];
      const turnHeight = lastMessage.getBoundingClientRect().bottom - lastQuestion.getBoundingClientRect().top;
      const bottomPadding = parseFloat(getComputedStyle(container).paddingBottom);
      spacer.style.height = `${Math.max(0, container.clientHeight - 48 - turnHeight - bottomPadding)}px`;
      if (this.followConversation) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }

  protected async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.actionNotice = 'Response copied.';
    } catch (error) {
      console.error('Failed to copy response.', error);
      this.actionNotice = 'Could not copy the response. Check your browser permissions.';
    }
  }

  protected async shareResponse(text: string): Promise<void> {
    if (!navigator.share) {
      await this.copyToClipboard(text);
      if (this.actionNotice === 'Response copied.') {
        this.actionNotice = 'Sharing is unavailable here; response copied instead.';
      }
      return;
    }

    try {
      await navigator.share({ text });
      this.actionNotice = '';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to share response.', error);
      this.actionNotice = 'Could not share the response. Please try again.';
    }
  }
}
