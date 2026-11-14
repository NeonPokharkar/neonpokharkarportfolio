import { Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface PortfolioItem {
  number: string;
  title: string;
  description: string;
  tags: string;
}

interface ProjectManifestEntry {
  title: string;
  explanation: string;
  tags?: string;
}

interface ExperienceManifestEntry {
  period: string;
  firm: string;
  role: string;
  location: string;
  summary: string;
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

interface ProfileManifest {
  toolkit: string[];
  interests: string[];
  resumePath: string;
  email: string;
  phone: string;
  linkedin: string;
  intelliChatEndpoint: string;
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
  protected intelliChatEndpoint = '';
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
        tags: project.tags ?? ''
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
      this.intelliChatEndpoint = profile.intelliChatEndpoint;
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
    const margin = 17;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let cursorY = margin;

    const ensureSpace = (height: number): void => {
      if (cursorY + height > pageHeight - margin) {
        pdf.addPage();
        cursorY = margin;
      }
    };

    const addSection = (title: string): void => {
      ensureSpace(12);
      cursorY += 3;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(244, 91, 54);
      pdf.text(title.toUpperCase(), margin, cursorY);
      cursorY += 6;
      pdf.setTextColor(35, 33, 31);
    };

    const addText = (text: string, fontSize = 9, bold = false, indent = 0): void => {
      const normalizedText = text.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!normalizedText) {
        return;
      }

      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(fontSize);
      const lines = pdf.splitTextToSize(normalizedText, contentWidth - indent);
      const lineHeight = fontSize * 0.48;

      for (const line of lines) {
        ensureSpace(lineHeight);
        pdf.text(line, margin + indent, cursorY);
        cursorY += lineHeight;
      }
      cursorY += 1.5;
    };

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(35, 33, 31);
    pdf.text('Aditya Pokharkar', margin, cursorY);
    cursorY += 7;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(95, 91, 86);
    addText(`${profile.email} | ${profile.phone} | ${profile.linkedin}`, 8);
    cursorY += 2;

    addSection('Professional Experience');
    for (const entry of experience) {
      addText(`${entry.role} | ${entry.firm}`, 10, true);
      addText(`${entry.period} | ${entry.location}`, 8);
      addText(entry.summary, 9);

      for (const project of entry.projects ?? []) {
        addText(project.title, 9, true);
        for (const detail of project.details) {
          addText(`- ${detail.text} ${detail.metric ?? ''}${detail.suffix ?? ''}`, 8.5, false, 3);
        }
      }
      cursorY += 2;
    }

    addSection('Education');
    for (const entry of education) {
      addText(`${entry.title} | ${entry.period}`, 9, true);
      addText(`${entry.detail} ${entry.metric ?? ''}`, 8.5);
    }

    addSection('Technical Skills');
    addText(profile.toolkit.join(' | '), 8.5);

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

      if (!response.body) {
        throw new Error('The AI chat server did not return a readable response stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let plainResponse = '';
      let hasStructuredEvents = false;

      const appendPlainText = (chunk: string): void => {
        plainResponse += chunk;
        const finalAnswerMarker = /Final[_\s]+answer\s*:\s*/i.exec(plainResponse);
        assistantMessage.content = finalAnswerMarker
          ? plainResponse.slice(finalAnswerMarker.index + finalAnswerMarker[0].length).trimStart()
          : '';
      };

      const processPending = (flush: boolean): void => {
        while (pending) {
          const firstContentIndex = pending.search(/\S/);
          if (firstContentIndex === -1) {
            if (flush) {
              pending = '';
            }
            return;
          }

          if (firstContentIndex > 0) {
            const rest = pending.slice(firstContentIndex);
            if (rest.startsWith('{')) {
              pending = rest;
            } else {
              const nextEventIndex = rest.indexOf('{');
              if (nextEventIndex === -1) {
                appendPlainText(pending);
                pending = '';
                return;
              }
              appendPlainText(pending.slice(0, firstContentIndex + nextEventIndex));
              pending = rest.slice(nextEventIndex);
              continue;
            }
          }

          if (!pending.startsWith('{')) {
            const nextEventIndex = pending.indexOf('{');
            if (nextEventIndex === -1) {
              appendPlainText(pending);
              pending = '';
              return;
            }
            appendPlainText(pending.slice(0, nextEventIndex));
            pending = pending.slice(nextEventIndex);
            continue;
          }

          let objectDepth = 0;
          let insideString = false;
          let escaped = false;
          let eventEnd = -1;

          for (let index = 0; index < pending.length; index += 1) {
            const character = pending[index];
            if (insideString) {
              if (escaped) {
                escaped = false;
              } else if (character === '\\') {
                escaped = true;
              } else if (character === '"') {
                insideString = false;
              }
            } else if (character === '"') {
              insideString = true;
            } else if (character === '{') {
              objectDepth += 1;
            } else if (character === '}') {
              objectDepth -= 1;
              if (objectDepth === 0) {
                eventEnd = index;
                break;
              }
            }
          }

          if (eventEnd === -1) {
            if (flush) {
              appendPlainText(pending);
              pending = '';
            }
            return;
          }

          const eventText = pending.slice(0, eventEnd + 1);
          pending = pending.slice(eventEnd + 1);

          try {
            const event: unknown = JSON.parse(eventText);
            if (
              typeof event === 'object' &&
              event !== null &&
              'type' in event &&
              typeof event.type === 'string' &&
              'content' in event &&
              typeof event.content === 'string'
            ) {
              hasStructuredEvents = true;
              if (event.type === 'final_answer') {
                assistantMessage.content += event.content;
              }
            } else {
              appendPlainText(eventText);
            }
          } catch {
            appendPlainText(eventText);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        processPending(done);
        if (done) {
          break;
        }
      }

      if (!hasStructuredEvents && !/Final[_\s]+answer\s*:\s*/i.test(plainResponse)) {
        assistantMessage.content = plainResponse.trim();
      }

      if (!assistantMessage.content.trim()) {
        throw new Error('The AI chat server returned an empty response.');
      }

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
