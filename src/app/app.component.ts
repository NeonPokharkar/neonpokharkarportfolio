// MARKER: COMPONENT_START - Main app component with portfolio, navigation, theme, and AI chat
import { Component, effect, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { chatAuthenticationPrompt, createChatRequestHeaders, isChatAuthenticationRequired } from './chat-auth';
import { readIntelliChatFinalAnswer } from './intelli-chat-stream';
import { VerifiedUserService } from './verified-user.service';
import { VerificationDialogComponent } from './app.routes';
import { ChatSessionChannel, ChatSessionState, clearLegacyChatSnapshots, createChatSessionChannel } from './chat-session';

// MARKER: INTERFACES_SECTION - Data structure definitions for portfolio content
interface PortfolioItem {
  number: string;
  title: string;
  description: string;
  tags: string;
  placeholder: ProjectPlaceholder;
}

interface ProjectPlaceholder {
  src: string;
  alt: string;
}

interface ProjectManifestEntry {
  title: string;
  explanation: string;
  tags?: string;
  placeholder: ProjectPlaceholder;
}

interface ExperienceManifestEntry {
  period: string;
  firm: string;
  role: string;
  location: string;
  summary: string;
  qualitativeAssessment?: string[];
  projects?: Array<{
    title: string;
    details: Array<{
      text: string;
      metric?: string;
      suffix?: string;
    }>;
  }>;
}

interface ExperienceManifest {
  experience: ExperienceManifestEntry[];
  skills?: string[];
  interests?: string[];
}

interface EducationManifestEntry {
  period: string;
  title: string;
  detail: string;
  metric?: string;
}

interface ResumeManifest {
  toolkit: string[];
  email: string;
  phone: string;
  linkedin: string;
}

type AvailabilityState = 'available' | 'limited' | 'booked';

interface ProfileAvailability {
  state: AvailabilityState;
  label: string;
  activity: string;
  message: string;
}

interface ProfileFocusItem {
  label: string;
  text: string;
}

interface ProfileFocus {
  eyebrow: string;
  headline: string;
  highlight: string;
  items: ProfileFocusItem[];
}

interface ProfileService {
  eyebrow: string;
  title: string;
  description: string;
}

interface WhatIBring {
  eyebrow: string;
  headline: string;
  highlight: string;
  services: ProfileService[];
}

interface ProfileManifest {
  toolkit: string[];
  interests: string[];
  resumePath: string;
  copyrightYear: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  intelliChatEndpoint: string;
  availability: ProfileAvailability;
  currentFocus: ProfileFocus;
  whatIBring: WhatIBring;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const contextQuestionCategories = [
  'project', 'experience', 'essay', 'education', 'vision', 'gallery', 'links', 'invest', 'home', 'general'
] as const;
type ContextQuestionCategory = typeof contextQuestionCategories[number];
type ContextQuestions = Record<ContextQuestionCategory, { generic: string[]; specific: Record<string, string[]> }>;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet, VerificationDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  // MARKER: THEME_SYSTEM_START - Theme toggle (day/night) with localStorage persistence
  protected themeMode: 'day' | 'night' = 'day';
  private readonly themePreferenceKey = 'aditya-portfolio-theme';
  private hasManualThemePreference = false;
  private systemThemeQuery: MediaQueryList | null = null;
  private automaticThemeTimeout: number | undefined;
  private readonly handleSystemThemeChange = (): void => {
    if (!this.hasManualThemePreference) {
      this.applyAutomaticTheme();
    }
  };
  // MARKER: THEME_SYSTEM_END

  // MARKER: LIFECYCLE_AND_ROUTING - Constructor, route checks (home vs essays vs dynamic)
  constructor(
    protected readonly router: Router,
    protected readonly verifiedUser: VerifiedUserService,
    private readonly zone: NgZone
  ) {
    clearLegacyChatSnapshots();
    effect(() => {
      if (this.verifiedUser.user()) {
        this.chatRequiresSignIn = false;
      }
    });
    this.initializeTheme();
    void this.loadHomeData();
    void this.loadProfile();
    this.contextQuestions = this.loadContextQuestions();
    this.routerEvents = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.cancelContextHover();
        this.closeContextMenu();
        this.closeProfileMenu();
        this.hoveredContext = null;
        this.dismissedContext = null;
      }
    });
  }

  private readonly routerEvents;

  ngOnDestroy(): void {
    this.chatSessionSync?.close();
    this.cancelContextHover();
    if (this.contextStatusTimer !== undefined) {
      clearTimeout(this.contextStatusTimer);
    }
    this.routerEvents.unsubscribe();
  }

  protected get isHomeRoute(): boolean {
    return this.router.url.split(/[?#]/)[0] === '/';
  }

  protected get isEssayRoute(): boolean {
    return this.router.url.split(/[?#]/)[0].startsWith('/essays/');
  }

  protected get isChatRoute(): boolean {
    return this.router.url.split(/[?#]/)[0] === '/chat';
  }
  protected failedProfilePicture = '';
  // MARKER: LIFECYCLE_AND_ROUTING_END

  // MARKER: SCROLL_AND_MOUSE_TRACKING - Cursor position, scroll progress for animations
  protected scrollProgress = 0;
  protected cursorX = 0;
  protected cursorY = 0;
  protected readonly logoCharacters = [...'ADITYA'];
  protected clickPointerVisible = false;
  protected clickPointerX = 0;
  protected clickPointerY = 0;
  protected menuOpen = false;
  protected profileMenuOpen = false;
  private clickPointerTimer: ReturnType<typeof setTimeout> | undefined;
  protected contextMenu: { title: string; questions: string[] } | null = null;
  protected contextStatus = '';
  private contextHoverTimer: ReturnType<typeof setTimeout> | undefined;
  private hoveredContext: HTMLElement | null = null;
  private dismissedContext: HTMLElement | null = null;
  private contextPreviousFocus: HTMLElement | null = null;
  private contextStatusTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly contextQuestions: Promise<ContextQuestions | null>;
  private contextRequestId = 0;
  protected contextHint: { x: number; y: number } | null = null;
  private contextHintTimer: ReturnType<typeof setTimeout> | undefined;
  private lastContextRightClick: number | null = null;

  protected get dialogueSide(): 'left' | 'right' {
    const orbitAngle = ((-32 + this.scrollProgress * 300) % 360 + 360) % 360;
    return orbitAngle > 90 && orbitAngle < 270 ? 'right' : 'left';
  }
  // MARKER: SCROLL_AND_MOUSE_TRACKING_END

  // MARKER: PROFILE_DATA_SECTION - Contact, resume, links, availability
  protected resumePath = '';
  protected copyrightYear = '';
  protected resumeDownloadUrl = '';
  protected get resumeHref(): string {
    const includePhone = Boolean(this.verifiedUser.user());
    return this.resumeIncludesPhone === includePhone
      ? this.resumeDownloadUrl || this.resumePath
      : this.resumePath;
  }
  protected email = '';
  protected phone = '';
  protected linkedin = '';
  protected github = '';
  protected intelliChatEndpoint = '';
  protected availability: ProfileAvailability | undefined;
  protected currentFocus: ProfileFocus | undefined;
  protected whatIBring: WhatIBring | undefined;
  // MARKER: PROFILE_DATA_SECTION_END

  // MARKER: CHAT_SYSTEM_START - AI chat state, messages, input, busy state
  private conversationSummary = '';
  private lastRelevantConversation = '';
  protected chatOpen = false;
  protected chatBusy = false;
  protected chatInput = '';
  protected chatError = '';
  protected chatRequiresSignIn = false;
  protected readonly chatAuthenticationMessage = chatAuthenticationPrompt;
  private chatSessionSync?: ChatSessionChannel;
  private chatSessionId?: string;
  protected readonly chatMessages: ChatMessage[] = [
    {
      role: 'assistant',
      content: 'Hi! I am Aditya\'s AI assistant. Ask me about his experience, projects, or technical skills.'
    }
  ];
  @ViewChild(VerificationDialogComponent)
  private chatVerificationDialog?: VerificationDialogComponent;
  // MARKER: CHAT_SYSTEM_END

  // MARKER: PORTFOLIO_ARRAYS_SECTION - Skills, interests, projects, experience, education
  protected skills: string[] = [];

  protected interests: string[] = [];

  protected resumeError = '';
  protected resumeEmailError = '';
  protected resumeEmailMessage = '';
  protected resumeEmailSending = false;
  private resumePreparation: Promise<void> | undefined;
  private resumeIncludesPhone: boolean | undefined;

  protected projects: PortfolioItem[] = [];

  protected experience: Array<{ period: string; role: string; firm: string; company: string; description: string }> = [];

  protected education: Array<{ period: string; role: string; company: string }> = [];
  // MARKER: PORTFOLIO_ARRAYS_SECTION_END

  // MARKER: DATA_LOADING_SECTION_START - Fetch JSON files for projects, experience, education
  private async loadHomeData(): Promise<void> {
    try {
      const [projectsResponse, experienceResponse, educationResponse] = await Promise.all([
        fetch('assets/projects/projects.json'),
        fetch('assets/experience/experience.json'),
        fetch('assets/education/education.json')
      ]);

      if (!projectsResponse.ok || !experienceResponse.ok || !educationResponse.ok) {
        return;
      }

      const projectsData = await projectsResponse.json() as { projects: ProjectManifestEntry[] };
      const experienceData = await experienceResponse.json() as ExperienceManifest;
      const educationData = await educationResponse.json() as { education: EducationManifestEntry[] };

      this.projects = projectsData.projects.map((project, index) => ({
        number: String(index + 1).padStart(2, '0'),
        title: project.title,
        description: project.explanation,
        tags: project.tags ?? '',
        placeholder: project.placeholder
      }));

      this.experience = experienceData.experience.map((entry) => ({
        period: entry.period.replace('June', 'Jun'),
        role: entry.role,
        firm: entry.firm,
        company: `${entry.firm} · ${entry.location}`,
        description: entry.summary
      }));
      this.education = educationData.education.map((entry) => ({
        period: entry.period,
        role: entry.title,
        company: `${entry.detail} ${entry.metric ?? ''}`.trim()
      }));
    } catch {
      // The home sections remain empty if their shared content manifests cannot be loaded.
    }

  }

  // MARKER: PROFILE_LOADING - Fetch profile.json with contact info, skills, availability
  private async loadProfile(): Promise<void> {
    try {
      const response = await fetch('assets/profile/profile.json');
      if (!response.ok) {
        return;
      }
      const profile = await response.json() as ProfileManifest;
      this.resumePath = profile.resumePath;
      this.copyrightYear = profile.copyrightYear;
      this.email = profile.email;
      this.phone = profile.phone;
      this.linkedin = profile.linkedin;
      this.github = profile.github;
      this.intelliChatEndpoint = profile.intelliChatEndpoint;
      this.availability = profile.availability;
      this.currentFocus = profile.currentFocus;
      this.whatIBring = profile.whatIBring;
      this.skills = profile.toolkit;
      this.interests = profile.interests;
    } catch {
      // Keep shared profile values empty when the manifest cannot be loaded.
    }
  }
  // MARKER: DATA_LOADING_SECTION_END

  // MARKER: PDF_GENERATION_SECTION_START - Resume PDF download functionality
  protected prepareResumeDownload(): void {
    const includePhone = Boolean(this.verifiedUser.user());
    if (!this.resumePreparation || this.resumeIncludesPhone !== includePhone) {
      this.resumeIncludesPhone = includePhone;
      this.resumePreparation = this.createResumeDownload(includePhone);
    }
  }

  protected async emailResume(): Promise<void> {
    const accessToken = this.verifiedUser.getAccessToken();
    if (this.resumeEmailSending) {
      return;
    }
    if (!accessToken) {
      this.resumeEmailError = 'Sign in with Google to email yourself a resume.';
      this.resumeEmailMessage = '';
      return;
    }

    this.resumeEmailSending = true;
    this.resumeEmailError = '';
    this.resumeEmailMessage = '';
    try {
      let apiEndpoint = this.intelliChatEndpoint;
      if (!apiEndpoint) {
        const profileResponse = await fetch('assets/profile/profile.json');
        if (!profileResponse.ok) {
          throw new Error(`Could not load API configuration (HTTP ${profileResponse.status}).`);
        }
        const profile = await profileResponse.json() as { intelliChatEndpoint?: unknown };
        if (typeof profile.intelliChatEndpoint !== 'string' || !profile.intelliChatEndpoint.trim()) {
          throw new Error('Invalid API configuration.');
        }
        apiEndpoint = profile.intelliChatEndpoint;
      }

      const response = await fetch(new URL('/resume/generate', apiEndpoint), {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (this.verifiedUser.getAccessToken() !== accessToken) {
        return;
      }

      const result = await this.readResumeEmailResponse(response);
      if (response.status === 401) {
        this.verifiedUser.clear();
        this.resumeEmailError = 'Your sign-in has expired. Sign in with Google again to email your resume.';
      } else if (response.status === 403) {
        this.resumeEmailError = 'Your Google account does not have a verified email address.';
      } else if (response.status === 429) {
        this.resumeEmailError = 'Please wait five minutes before requesting another resume.';
      } else if (response.status === 503) {
        this.resumeEmailError = 'Resume generation or email delivery is unavailable. Delivery may be uncertain; check your inbox before trying again.';
      } else if (!response.ok) {
        this.resumeEmailError = result.detail || `The resume email request failed (HTTP ${response.status}).`;
      } else if (result.sent === true) {
        this.resumeEmailMessage = 'Resume emailed to your verified Google address. Check your inbox.';
      } else {
        this.resumeEmailError = result.detail || 'The server did not confirm that your resume was emailed.';
      }
    } catch (error) {
      console.error('Resume email request failed.', error);
      this.resumeEmailError = 'Could not confirm whether the resume request completed. Check your inbox before trying again.';
    } finally {
      this.resumeEmailSending = false;
    }
  }

  private async readResumeEmailResponse(response: Response): Promise<{ sent?: boolean; detail?: string }> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {};
    }
    if (!payload || typeof payload !== 'object') {
      return {};
    }
    return {
      sent: 'sent' in payload && typeof payload.sent === 'boolean' ? payload.sent : undefined,
      detail: 'detail' in payload && typeof payload.detail === 'string' ? payload.detail : undefined
    };
  }

  private async createResumeDownload(includePhone: boolean): Promise<void> {
    this.resumeError = '';

    try {
      const [profileResponse, experienceResponse, educationResponse] = await Promise.all([
        fetch('assets/profile/profile.json'),
        fetch('assets/experience/experience.json'),
        fetch('assets/education/education.json')
      ]);

      if (!profileResponse.ok || !experienceResponse.ok || !educationResponse.ok) {
        throw new Error('One or more resume data files could not be loaded.');
      }

      const profile = await profileResponse.json() as ResumeManifest;
      const experience = await experienceResponse.json() as ExperienceManifest;
      const education = await educationResponse.json() as { education: EducationManifestEntry[] };
      const resumeProfile = { ...profile, phone: includePhone ? profile.phone : '' };
      const resumeBlob = await this.generateResumePdf(resumeProfile, experience.experience, education.education);
      this.resumeDownloadUrl = URL.createObjectURL(resumeBlob);
    } catch (error) {
      console.error('Resume generation failed.', error);
      this.resumeError = 'The generated resume is unavailable. The existing resume remains available to download.';
    }
  }

  private async generateResumePdf(
    profile: ResumeManifest,
    experience: ExperienceManifestEntry[],
    education: EducationManifestEntry[]
  ): Promise<Blob> {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
    pdf.setProperties({
      title: 'Aditya Pokharkar - Resume',
      author: 'Aditya Pokharkar',
      subject: 'Software Engineer Resume'
    });

    const margin = 16;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    const navy: [number, number, number] = [31, 45, 61];
    const blue: [number, number, number] = [38, 84, 132];
    const body: [number, number, number] = [48, 56, 66];
    const muted: [number, number, number] = [100, 108, 117];
    const rule: [number, number, number] = [207, 215, 223];
    let cursorY = 17;

    const normalizeText = (text: string): string => text
      .replace(/[–—]/g, '-')
      .replace(/·/g, '|')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const addContinuationHeader = (): void => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...muted);
      pdf.text('ADITYA POKHARKAR | SOFTWARE ENGINEER', margin, cursorY);
      cursorY += 3;
      pdf.setDrawColor(...rule);
      pdf.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 6;
    };

    const ensureSpace = (height: number): void => {
      if (cursorY + height > pageHeight - margin) {
        pdf.addPage();
        cursorY = margin;
        addContinuationHeader();
      }
    };

    const addWrappedText = (
      text: string,
      fontSize = 9,
      bold = false,
      indent = 0,
      after = 1
    ): void => {
      const normalizedText = normalizeText(text);
      if (!normalizedText) {
        return;
      }

      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(fontSize);
      pdf.setTextColor(...body);
      const lines = pdf.splitTextToSize(normalizedText, contentWidth - indent);
      const lineHeight = fontSize * 0.46;
      ensureSpace(lines.length * lineHeight + after);

      for (const line of lines) {
        pdf.text(line, margin + indent, cursorY);
        cursorY += lineHeight;
      }
      cursorY += after;
    };

    const addLabeledText = (label: string, value: string): void => {
      const normalizedValue = normalizeText(value);
      if (!normalizedValue) {
        return;
      }

      const labelText = `${label}: `;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      const labelWidth = pdf.getTextWidth(labelText);
      pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(normalizedValue, contentWidth - labelWidth);
      const lineHeight = 4;
      ensureSpace(lines.length * lineHeight + 1);
      pdf.setTextColor(...navy);
      pdf.setFont('helvetica', 'bold');
      pdf.text(labelText, margin, cursorY);
      pdf.setTextColor(...body);
      pdf.setFont('helvetica', 'normal');
      pdf.text(lines[0], margin + labelWidth, cursorY);
      cursorY += lineHeight;

      for (const line of lines.slice(1)) {
        pdf.text(line, margin + labelWidth, cursorY);
        cursorY += lineHeight;
      }
      cursorY += 1;
    };

    const addBullet = (text: string): void => {
      const normalizedText = normalizeText(text);
      if (!normalizedText) {
        return;
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.7);
      const lines = pdf.splitTextToSize(normalizedText, contentWidth - 5);
      const lineHeight = 4;
      ensureSpace(lines.length * lineHeight + 1);
      pdf.setTextColor(...blue);
      pdf.text('-', margin + 1, cursorY);
      pdf.setTextColor(...body);
      for (const line of lines) {
        pdf.text(line, margin + 5, cursorY);
        cursorY += lineHeight;
      }
      cursorY += 1;
    };

    const addSection = (title: string): void => {
      ensureSpace(10);
      cursorY += 1;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...navy);
      pdf.text(title.toUpperCase(), margin, cursorY);
      cursorY += 2;
      pdf.setDrawColor(...rule);
      pdf.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 4;
    };

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(23);
    pdf.setTextColor(...navy);
    pdf.text('Aditya Pokharkar', margin, cursorY);
    cursorY += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...blue);
    pdf.text('SOFTWARE ENGINEER | BACKEND & FULL-STACK', margin, cursorY);
    cursorY += 5;

    const contactDetails = [
      profile.email,
      profile.phone,
      experience[0]?.location,
      profile.linkedin.replace(/^https?:\/\//, '').replace(/\/$/, '')
    ].filter((detail): detail is string => Boolean(detail));
    addWrappedText(contactDetails.join(' | '), 8.3, false, 0, 2);
    pdf.setDrawColor(...navy);
    pdf.setLineWidth(0.5);
    pdf.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 5;

    addSection('Professional Summary');
    addWrappedText(
      'Software Engineer building enterprise workflow platforms across backend and frontend. Experienced in Java, Spring Boot, Angular, Oracle, REST APIs, configurable workflows, and real-time collaboration, from system design through production delivery.',
      9,
      false,
      0,
      1
    );

    addSection('Professional Experience');
    for (const entry of experience) {
      const period = normalizeText(entry.period);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...navy);
      pdf.text(normalizeText(entry.role), margin, cursorY);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...muted);
      pdf.text(period, pageWidth - margin, cursorY, { align: 'right' });
      cursorY += 4.5;
      addWrappedText(`${entry.firm} | ${entry.location}`, 8.8, false, 0, 2);

      for (const project of entry.projects ?? []) {
        addWrappedText(project.title, 9, true, 0, 1);
        for (const detail of project.details) {
          addBullet(`${detail.text} ${detail.metric ?? ''} ${detail.suffix ?? ''}`);
        }
      }

      for (const assessment of entry.qualitativeAssessment ?? []) {
        addBullet(assessment);
      }
    }

    addSection('Education');
    for (const entry of education) {
      addWrappedText(`${entry.title} | ${entry.period}`, 9, true, 0, 0.5);
      const institution = normalizeText(entry.detail.replace(/[·,\s]+$/, ''));
      const result = entry.metric?.split('·').pop()?.trim();
      addWrappedText(
        `${institution}${result ? ` | ${result}` : ''}`,
        8.5,
        false,
        0,
        1.5
      );
    }

    addSection('Technical Skills');
    const skillCategories: Array<{ label: string; skills: string[] }> = [
      { label: 'Languages', skills: ['Java', 'TypeScript', 'JavaScript', 'Python', 'Dart'] },
      { label: 'Frameworks', skills: ['Spring Boot', 'Angular', 'Flutter'] },
      { label: 'Data & Real-time', skills: ['Oracle & SQL', 'WebSockets'] },
      { label: 'Tools & Practices', skills: ['AOP', 'JUnit', 'Splunk', 'Datical'] }
    ];
    const categorizedSkills = new Set(skillCategories.flatMap((category) => category.skills));
    const remainingSkills = profile.toolkit.filter((skill) => !categorizedSkills.has(skill));
    if (remainingSkills.length) {
      skillCategories[skillCategories.length - 1].skills.push(...remainingSkills);
    }

    for (const category of skillCategories) {
      const categorySkills = category.skills.filter((skill) => profile.toolkit.includes(skill));
      if (categorySkills.length) {
        addLabeledText(category.label, categorySkills.join(', '));
      }
    }

    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...muted);
      pdf.text(`${page} / ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    return pdf.output('blob');
  }
  // MARKER: PDF_GENERATION_SECTION_END

  // MARKER: EVENT_LISTENERS_START - @HostListener for scroll, mouse, keyboard
  @HostListener('window:scroll')
  protected updateScrollProgress(): void {
    this.closeProfileMenu();
    this.cancelContextHover();
    if (!this.contextMenu) {
      this.hoveredContext = null;
    }
    const scrollableHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    this.scrollProgress = Math.min(window.scrollY / scrollableHeight, 1);
  }

  @HostListener('document:click', ['$event'])
  protected closeProfileMenuOnOutsideClick(event: MouseEvent): void {
    if (this.profileMenuOpen && event.target instanceof Element &&
        !event.target.closest('.user-profile-menu')) {
      this.closeProfileMenu();
    }
  }

  @HostListener('document:keydown.escape')
  protected closeProfileMenuOnEscape(): void {
    this.closeProfileMenu();
  }

  protected openProfileMenu(): void {
    this.profileMenuOpen = true;
  }

  protected closeProfileMenu(): void {
    this.profileMenuOpen = false;
  }

  protected closeProfileMenuOnFocusOut(event: FocusEvent): void {
    if (!(event.currentTarget instanceof HTMLElement) ||
        !(event.relatedTarget instanceof Node) ||
        !event.currentTarget.contains(event.relatedTarget)) {
      this.closeProfileMenu();
    }
  }

  protected signOut(): void {
    void this.verifiedUser.logout();
    this.closeProfileMenu();
  }

  @HostListener('document:mousemove', ['$event'])
  protected updateCursorPosition(event: MouseEvent): void {
    this.cursorX = event.clientX;
    this.cursorY = event.clientY;
    if (this.contextMenu) {
      return;
    }

    const context = event.buttons ? null : this.findContext(event.target);
    if (context === this.hoveredContext) {
      return;
    }

    this.cancelContextHover();
    this.hoveredContext = context;
    if (context !== this.dismissedContext) {
      this.dismissedContext = null;
    }
    // Only occasionally nudge the user toward the palette instead of opening it on hover.
    if (context && !this.dismissedContext && Math.random() < 0.3) {
      this.contextHoverTimer = setTimeout(() => {
        this.contextHoverTimer = undefined;
        this.showContextHint();
      }, 1500);
    }
  }

  private findContext(target: EventTarget | null): HTMLElement | null {
    const element = target instanceof Element ? target : null;
    const candidate = this.canUseContextMenu() &&
      !element?.closest('a, button, input, textarea, select, summary, [contenteditable], nav, form, [role="dialog"]')
      ? element?.closest('main article, main section, main')
      : null;
    return candidate instanceof HTMLElement ? candidate.closest<HTMLElement>('article') ?? candidate : null;
  }

  private showContextHint(): void {
    if (this.contextMenu || !this.hoveredContext) {
      return;
    }
    this.contextHint = { x: this.cursorX, y: this.cursorY };
    this.contextHintTimer = setTimeout(() => {
      this.contextHint = null;
      this.contextHintTimer = undefined;
    }, 4000);
  }

  private hideContextHint(): void {
    this.contextHint = null;
    if (this.contextHintTimer !== undefined) {
      clearTimeout(this.contextHintTimer);
      this.contextHintTimer = undefined;
    }
  }

  @HostListener('document:keydown.escape')
  protected closeMenu(): void {
    if (this.contextMenu) {
      this.closeContextMenu();
    }
    this.cancelContextHover();
    this.menuOpen = false;
  }

  @HostListener('document:keydown', ['$event'])
  protected handleContextKeydown(event: KeyboardEvent): void {
    if (this.contextMenu && event.key === 'Tab') {
      const dialog = document.querySelector<HTMLElement>('.context-dialog');
      const buttons = dialog?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (buttons?.length) {
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (document.activeElement === dialog) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    const active = document.activeElement;
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'q' &&
        !(active instanceof Element && active.closest('input, textarea, select, [contenteditable]')) &&
        this.hoveredContext && this.canUseContextMenu()) {
      event.preventDefault();
      this.lastContextRightClick = null;
      void this.openContextMenu(this.hoveredContext);
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  protected handleContextPointerDown(event: PointerEvent): void {
    this.cancelContextHover();
    if (!this.contextMenu && (event.button !== 2 || this.lastContextRightClick === null)) {
      this.hoveredContext = null;
    }
    if (event.button !== 2) {
      this.lastContextRightClick = null;
    }
  }

  @HostListener('document:contextmenu', ['$event'])
  protected handleContextMenuDismiss(event: MouseEvent): void {
    const now = performance.now();
    if (this.contextMenu) {
      event.preventDefault();
      this.closeContextMenu();
      this.lastContextRightClick = event.button === 2 ? now : null;
    } else if (event.button === 2 && this.lastContextRightClick !== null &&
        now - this.lastContextRightClick <= 600) {
      this.lastContextRightClick = null;
      const context = this.findContext(event.target);
      if (context) {
        event.preventDefault();
        this.cancelContextHover();
        this.hoveredContext = context;
        void this.openContextMenu(context);
      }
    } else {
      this.lastContextRightClick = event.button === 2 ? now : null;
    }
  }

  protected cancelContextHover(): void {
    this.contextRequestId += 1;
    this.hideContextHint();
    if (this.contextHoverTimer !== undefined) {
      clearTimeout(this.contextHoverTimer);
      this.contextHoverTimer = undefined;
    }
  }

  @HostListener('window:resize')
  protected checkContextViewport(): void {
    if (!this.canUseContextMenu()) {
      this.cancelContextHover();
      this.closeContextMenu();
      this.hoveredContext = null;
    }
  }

  private canUseContextMenu(): boolean {
    const active = document.activeElement;
    const path = this.router.url.split(/[?#]/)[0];
    return !this.isChatRoute && path !== '/shayari' && !this.chatOpen && !this.menuOpen &&
      !(active instanceof Element && active.closest('input, textarea, select, [contenteditable]')) &&
      !document.querySelector('[role="dialog"]') &&
      window.matchMedia('(min-width: 801px) and (hover: hover) and (pointer: fine)').matches;
  }

  private async loadContextQuestions(): Promise<ContextQuestions | null> {
    try {
      const response = await fetch('assets/context-questions.json');
      if (!response.ok) {
        throw new Error(`Question manifest request failed (${response.status}).`);
      }
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object') {
        throw new Error('Question manifest must be an object.');
      }
      const readList = (value: unknown, label: string): string[] => {
        if (!Array.isArray(value) ||
            !value.every((entry: unknown): entry is string => typeof entry === 'string' && entry.trim().length > 0)) {
          throw new Error(`Question list "${label}" must contain only non-empty strings.`);
        }
        return [...new Set(value.map((entry) => entry.trim()))];
      };
      const questions: ContextQuestions = {
        project: { generic: [], specific: {} },
        experience: { generic: [], specific: {} },
        essay: { generic: [], specific: {} },
        education: { generic: [], specific: {} },
        vision: { generic: [], specific: {} },
        gallery: { generic: [], specific: {} },
        links: { generic: [], specific: {} },
        invest: { generic: [], specific: {} },
        home: { generic: [], specific: {} },
        general: { generic: [], specific: {} }
      };
      for (const category of contextQuestionCategories) {
        const group: unknown = Reflect.get(data, category);
        if (!group || typeof group !== 'object' || Array.isArray(group)) {
          throw new Error(`Question category "${category}" must be an object.`);
        }
        const generic = readList(Reflect.get(group, 'generic'), `${category}.generic`);
        if (generic.length < 5) {
          throw new Error(`Question category "${category}" must contain at least five distinct generic questions.`);
        }
        const specific: unknown = Reflect.get(group, 'specific');
        if (!specific || typeof specific !== 'object' || Array.isArray(specific)) {
          throw new Error(`Question category "${category}" must have a specific question map.`);
        }
        const entries = Object.entries(specific).map(([key, value]) => {
          if (!key.trim()) {
            throw new Error(`Question category "${category}" has an empty content key.`);
          }
          return [key, readList(value, `${category}.specific.${key}`)] as const;
        });
        questions[category] = { generic, specific: Object.fromEntries(entries) };
      }
      return questions;
    } catch (error) {
      console.error('Could not load contextual questions.', error);
      return null;
    }
  }

  private async openContextMenu(context: HTMLElement): Promise<void> {
    this.cancelContextHover();
    const requestId = this.contextRequestId;
    if (!context.isConnected || !this.canUseContextMenu() || window.getSelection()?.toString()) {
      return;
    }
    const manifest = await this.contextQuestions;
    if (requestId !== this.contextRequestId || context !== this.hoveredContext ||
        !context.isConnected || !this.canUseContextMenu() || window.getSelection()?.toString()) {
      return;
    }
    if (!manifest) {
      this.contextStatus = 'Contextual questions could not be loaded. Please reload the page to try again.';
      return;
    }
    const article = context.closest('article');
    const subject = article ?? context;
    const title = (subject.dataset['contextTitle'] || subject.querySelector<HTMLElement>('h1, h2, h3')?.innerText ||
      subject.closest('main')?.querySelector<HTMLElement>('h1')?.innerText || '').replace(/\s+/g, ' ').replace(/\s*↗\s*$/, '').trim();
    if (!title) {
      return;
    }

    const topic = title.length > 100 ? `${title.slice(0, 97).trimEnd()}...` : title;
    const path = this.router.url.split(/[?#]/)[0];
    const identified = subject.closest<HTMLElement>('[data-context-category]');
    const explicitCategory = contextQuestionCategories.find((category) => category === identified?.dataset['contextCategory']);
    let category: ContextQuestionCategory;
    if (explicitCategory) {
      category = explicitCategory;
    } else if (subject.matches('.project-card, .project-entry') || subject.closest('.projects-section')) {
      category = 'project';
    } else if (subject.matches('.experience-firm, .experience-item') && !subject.closest('.education-section')) {
      category = 'experience';
    } else if (subject.matches('.essay-list-card') || path.startsWith('/essays')) {
      category = 'essay';
    } else {
      category = 'general';
    }
    const key = subject.dataset['contextKey'] || identified?.dataset['contextKey'] || subject.id || title;
    const group = manifest[category];
    const specific = Object.hasOwn(group.specific, key) ? group.specific[key] : [];
    const render = (questions: string[]): string[] =>
      [...new Set(questions.map((question) => question.replaceAll('{topic}', topic)))];
    const shuffle = (questions: string[]): string[] => {
      for (let index = questions.length - 1; index > 0; index -= 1) {
        const selected = Math.floor(Math.random() * (index + 1));
        [questions[index], questions[selected]] = [questions[selected], questions[index]];
      }
      return questions;
    };
    const itemQuestions = shuffle(render(specific));
    const genericQuestions = shuffle(render(group.generic)).filter((question) => !itemQuestions.includes(question));
    const questions = shuffle([...itemQuestions, ...genericQuestions].slice(0, 5));
    if (questions.length < 5) {
      console.error(`Not enough distinct contextual questions for "${key}".`);
      this.contextStatus = 'Could not load enough distinct questions for this content.';
      return;
    }
    this.contextPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (this.contextStatusTimer !== undefined) {
      clearTimeout(this.contextStatusTimer);
      this.contextStatusTimer = undefined;
    }
    this.contextStatus = '';
    this.contextMenu = { title: topic, questions };
    setTimeout(() => document.querySelector<HTMLElement>('.context-dialog')?.focus());
  }

  protected closeContextMenu(): void {
    if (!this.contextMenu) {
      return;
    }
    this.dismissedContext = this.hoveredContext;
    this.contextMenu = null;
    this.contextStatus = '';
    this.contextPreviousFocus?.focus();
    this.contextPreviousFocus = null;
  }

  protected askContextQuestion(question: string): void {
    const params = new URLSearchParams({ prompt: question, autoSend: '1' });
    const chatWindow = window.open(`/chat?${params.toString()}`, '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
    if (!chatWindow) {
      this.contextStatus = 'Could not open the chat window. Allow pop-ups and try again.';
      return;
    }
    this.closeContextMenu();
  }
  // MARKER: EVENT_LISTENERS_END

  // MARKER: NAVIGATION_AND_UI_HANDLERS - Menu toggle, click pointer, logo animation
  protected toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  protected showClickPointer(event: MouseEvent): void {
    const clickedCharacter = event.target instanceof HTMLElement
      ? event.target.closest('.logo-character')
      : null;
    if (clickedCharacter) {
      const characterBounds = clickedCharacter.getBoundingClientRect();
      this.clickPointerX = characterBounds.right - 1;
      this.clickPointerY = characterBounds.top + (characterBounds.height / 2);
    } else {
      this.clickPointerX = event.clientX;
      this.clickPointerY = event.clientY;
    }
    this.clickPointerVisible = true;
    if (this.clickPointerTimer) {
      clearTimeout(this.clickPointerTimer);
    }
    this.clickPointerTimer = setTimeout(() => {
      this.clickPointerVisible = false;
      this.clickPointerTimer = undefined;
    }, 1200);
  }

  protected toggleTheme(): void {
    this.themeMode = this.themeMode === 'day' ? 'night' : 'day';
    this.hasManualThemePreference = true;
    this.systemThemeQuery?.removeEventListener('change', this.handleSystemThemeChange);
    if (this.automaticThemeTimeout !== undefined) {
      window.clearTimeout(this.automaticThemeTimeout);
      this.automaticThemeTimeout = undefined;
    }
    this.applyTheme();

    try {
      window.localStorage.setItem(this.themePreferenceKey, this.themeMode);
    } catch (error) {
      console.warn('Theme preference could not be saved.', error);
    }
  }

  // MARKER: THEME_INITIALIZATION_AND_APPLICATION - Theme detection, localStorage, system preference
  private initializeTheme(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    let savedPreference: string | null = null;
    try {
      savedPreference = window.localStorage.getItem(this.themePreferenceKey);
    } catch (error) {
      console.warn('Theme preference could not be loaded.', error);
    }

    if (savedPreference === 'day' || savedPreference === 'night') {
      this.hasManualThemePreference = true;
      this.themeMode = savedPreference;
      this.applyTheme();
      return;
    }

    if (typeof window.matchMedia === 'function') {
      this.systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemThemeQuery.addEventListener('change', this.handleSystemThemeChange);
    }

    this.applyAutomaticTheme();
    this.scheduleAutomaticThemeChange();
  }

  private applyAutomaticTheme(): void {
    const prefersNight = this.systemThemeQuery?.matches ?? false;
    this.themeMode = prefersNight ? 'night' : this.getTimeBasedTheme();
    this.applyTheme();
  }

  private getTimeBasedTheme(): 'day' | 'night' {
    const localHour = new Date().getHours();
    return localHour >= 6 && localHour < 18 ? 'day' : 'night';
  }

  private scheduleAutomaticThemeChange(): void {
    if (this.hasManualThemePreference || typeof window === 'undefined') {
      return;
    }

    const now = new Date();
    const nextChange = new Date(now);
    if (now.getHours() < 6) {
      nextChange.setHours(6, 0, 0, 0);
    } else if (now.getHours() < 18) {
      nextChange.setHours(18, 0, 0, 0);
    } else {
      nextChange.setDate(nextChange.getDate() + 1);
      nextChange.setHours(6, 0, 0, 0);
    }

    const delay = Math.max(nextChange.getTime() - now.getTime(), 1);
    this.automaticThemeTimeout = window.setTimeout(() => {
      this.applyAutomaticTheme();
      this.scheduleAutomaticThemeChange();
    }, delay);
  }

  private applyTheme(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset['theme'] = this.themeMode;
    }
  }

  protected toggleChat(): void {
    this.chatOpen = !this.chatOpen;
    this.chatError = '';
  }

  protected expandChat(): void {
    let newChannel: ChatSessionChannel | undefined;
    let sessionId = this.chatSessionId;

    if (!sessionId) {
      if (typeof crypto.randomUUID !== 'function') {
        this.chatError = 'This browser cannot securely open a synchronized chat window. Continue chatting here instead.';
        return;
      }

      sessionId = crypto.randomUUID();
      const channel = createChatSessionChannel(
        sessionId,
        (state) => this.zone.run(() => this.applyChatSessionState(state)),
        () => this.chatSessionSync?.publish(this.getChatSessionState())
      );
      if (!channel) {
        this.chatError = 'This browser does not support private live chat handoff. Continue chatting here instead.';
        return;
      }
      this.chatSessionSync = channel;
      this.chatSessionId = sessionId;
      newChannel = channel;
    }

    const chatUrl = new URL('/chat', window.location.origin);
    chatUrl.hash = sessionId;
    const chatWindow = window.open(chatUrl.href, 'AditysAI', 'width=900,height=700,resizable=yes,scrollbars=yes');
    if (!chatWindow && newChannel) {
      newChannel.close();
      this.chatSessionSync = undefined;
      this.chatSessionId = undefined;
      this.chatError = 'Allow pop-ups for this site to open the full chat window.';
    }
  }

  protected onChatInputChange(value: string): void {
    this.chatInput = value;
    this.publishChatSessionState();
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
  }

  private publishChatSessionState(): void {
    this.chatSessionSync?.publish(this.getChatSessionState());
  }

  // MARKER: CHAT_SYSTEM_START - AI chat message handling with Intelli Chat API
  @HostListener('window:open-ai-project', ['$event'])
  protected openProjectAssistant(event: Event): void {
    const prompt = (event as CustomEvent<{ prompt: string }>).detail.prompt;
    this.chatOpen = true;
    this.chatInput = prompt;
    this.chatError = '';
  }

  @HostListener('window:open-chat-signin')
  protected openChatSignIn(): void {
    this.chatVerificationDialog?.open();
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

    this.chatMessages.push({ role: 'user', content });
    this.chatInput = '';
    this.chatError = '';
    this.chatRequiresSignIn = false;
    this.chatBusy = true;
    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    this.chatMessages.push(assistantMessage);
    this.publishChatSessionState();

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
        }
      );

      this.conversationSummary = [this.conversationSummary, this.lastRelevantConversation]
        .filter(Boolean)
        .join('\n');
      this.lastRelevantConversation = `User: ${content}\nAssistant: ${assistantMessage.content}`;
      this.publishChatSessionState();
    } catch (error: unknown) {
      const assistantMessageIndex = this.chatMessages.indexOf(assistantMessage);
      if (assistantMessageIndex !== -1) {
        this.chatMessages.splice(assistantMessageIndex, 1);
      }
      this.chatError = error instanceof Error
        ? `${error.message} Make sure the API is running at ${this.intelliChatEndpoint} and allows requests from this app.`
        : `Unable to connect to the AI chat server at ${this.intelliChatEndpoint}.`;
      this.publishChatSessionState();
    } finally {
      this.chatBusy = false;
      this.publishChatSessionState();
    }
  }
  // MARKER: CHAT_SYSTEM_END
}
