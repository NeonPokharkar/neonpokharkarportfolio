import { Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { readIntelliChatFinalAnswer } from './intelli-chat-stream';

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

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  constructor(protected readonly router: Router) {
    void this.loadHomeData();
    void this.loadProfile();
  }

  protected get isHomeRoute(): boolean {
    return this.router.url.split(/[?#]/)[0] === '/';
  }

  protected get isEssayRoute(): boolean {
    return this.router.url.split(/[?#]/)[0].startsWith('/essays/');
  }

  protected scrollProgress = 0;
  protected cursorX = 0;
  protected cursorY = 0;
  protected readonly logoCharacters = [...'ADITYA'];
  protected clickPointerVisible = false;
  protected clickPointerX = 0;
  protected clickPointerY = 0;
  protected menuOpen = false;
  private clickPointerTimer: ReturnType<typeof setTimeout> | undefined;

  protected get dialogueSide(): 'left' | 'right' {
    const orbitAngle = ((-32 + this.scrollProgress * 300) % 360 + 360) % 360;
    return orbitAngle > 90 && orbitAngle < 270 ? 'right' : 'left';
  }
  protected resumePath = '';
  protected resumeDownloadUrl = '';
  protected email = '';
  protected phone = '';
  protected linkedin = '';
  protected github = '';
  protected intelliChatEndpoint = '';
  protected availability: ProfileAvailability | undefined;
  protected currentFocus: ProfileFocus | undefined;
  protected whatIBring: WhatIBring | undefined;
  private conversationSummary = '';
  private lastRelevantConversation = '';
  protected chatOpen = false;
  protected chatBusy = false;
  protected chatInput = '';
  protected chatError = '';
  protected readonly chatMessages: ChatMessage[] = [
    {
      role: 'assistant',
      content: 'Hi! I am Aditya\'s AI assistant. Ask me about his experience, projects, or technical skills.'
    }
  ];

  protected skills: string[] = [];

  protected interests: string[] = [];

  protected resumeError = '';
  private resumePreparation: Promise<void> | undefined;

  protected projects: PortfolioItem[] = [];

  protected experience: Array<{ period: string; role: string; company: string; description: string }> = [];

  protected education: Array<{ period: string; role: string; company: string }> = [];

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

  private async loadProfile(): Promise<void> {
    try {
      const response = await fetch('assets/profile/profile.json');
      if (!response.ok) {
        return;
      }
      const profile = await response.json() as ProfileManifest;
      this.resumePath = profile.resumePath;
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

  protected prepareResumeDownload(): void {
    if (!this.resumePreparation) {
      this.resumePreparation = this.createResumeDownload();
    }
  }

  private async createResumeDownload(): Promise<void> {
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
      const resumeBlob = await this.generateResumePdf(profile, experience.experience, education.education);
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

  @HostListener('window:scroll')
  protected updateScrollProgress(): void {
    const scrollableHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    this.scrollProgress = Math.min(window.scrollY / scrollableHeight, 1);
  }

  @HostListener('document:mousemove', ['$event'])
  protected updateCursorPosition(event: MouseEvent): void {
    this.cursorX = event.clientX;
    this.cursorY = event.clientY;
  }

  @HostListener('document:keydown.escape')
  protected closeMenu(): void {
    this.menuOpen = false;
  }

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

  protected toggleChat(): void {
    this.chatOpen = !this.chatOpen;
    this.chatError = '';
  }

  @HostListener('window:open-ai-project', ['$event'])
  protected openProjectAssistant(event: Event): void {
    const prompt = (event as CustomEvent<{ prompt: string }>).detail.prompt;
    this.chatOpen = true;
    this.chatInput = prompt;
    this.chatError = '';
  }

  protected async sendChatMessage(): Promise<void> {
    const content = this.chatInput.trim();
    if (!content || this.chatBusy) {
      return;
    }

    if (!this.intelliChatEndpoint) {
      this.chatError = 'The AI chat endpoint is not available yet. Please try again shortly.';
      return;
    }

    this.chatMessages.push({ role: 'user', content });
    this.chatInput = '';
    this.chatError = '';
    this.chatBusy = true;
    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    this.chatMessages.push(assistantMessage);

    try {
      const response = await fetch(this.intelliChatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: content,
          conversation_summary: this.conversationSummary,
          last_relevant_conversation: this.lastRelevantConversation
        })
      });

      if (!response.ok) {
        throw new Error(`The AI chat server returned HTTP ${response.status}.`);
      }

      assistantMessage.content = await readIntelliChatFinalAnswer(
        response,
        (answer) => assistantMessage.content = answer
      );

      this.conversationSummary = [this.conversationSummary, this.lastRelevantConversation]
        .filter(Boolean)
        .join('\n');
      this.lastRelevantConversation = `User: ${content}\nAssistant: ${assistantMessage.content}`;
    } catch (error: unknown) {
      const assistantMessageIndex = this.chatMessages.indexOf(assistantMessage);
      if (assistantMessageIndex !== -1) {
        this.chatMessages.splice(assistantMessageIndex, 1);
      }
      this.chatError = error instanceof Error
        ? `${error.message} Make sure the API is running at ${this.intelliChatEndpoint} and allows requests from this app.`
        : `Unable to connect to the AI chat server at ${this.intelliChatEndpoint}.`;
    } finally {
      this.chatBusy = false;
    }
  }
}
