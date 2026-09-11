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

interface ProfileManifest {
  toolkit: string[];
  interests: string[];
  resumePath: string;
  email: string;
  phone: string;
  linkedin: string;
  ollamaEndpoint: string;
  ollamaModel: string;
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
  protected email = '';
  protected phone = '';
  protected linkedin = '';
  protected ollamaEndpoint = '';
  protected ollamaModel = '';
  protected chatOpen = false;
  protected chatBusy = false;
  protected chatInput = '';
  protected chatError = '';
  protected readonly chatMessages: ChatMessage[] = [
    {
      role: 'assistant',
      content: 'Hi! I am Aditya\'s local AI assistant. Ask me about his experience, projects, or technical skills.'
    }
  ];

  protected skills: string[] = [];

  protected interests: string[] = [];

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
      this.ollamaEndpoint = profile.ollamaEndpoint;
      this.ollamaModel = profile.ollamaModel;
      this.skills = profile.toolkit;
      this.interests = profile.interests;
    } catch {
      // Keep shared profile values empty when the manifest cannot be loaded.
    }
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

    this.chatMessages.push({ role: 'user', content });
    this.chatInput = '';
    this.chatError = '';
    this.chatBusy = true;

    try {
      const response = await fetch(this.ollamaEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaModel,
          stream: false,
          messages: [
            {
              role: 'system',
              content: 'You are the portfolio assistant for Aditya Pokharkar. Be concise and helpful. Aditya is a Full Stack Developer with 3+ years of experience at BofA Continuum, working with Java, Spring Boot, Angular, TypeScript, databases, WebSockets, and AI/ML concepts.'
            },
            ...this.chatMessages
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}.`);
      }

      const data: unknown = await response.json();
      const reply = this.readOllamaReply(data);
      this.chatMessages.push({ role: 'assistant', content: reply });
    } catch (error: unknown) {
      this.chatError = error instanceof Error
        ? `${error.message} Make sure Ollama is running at ${this.ollamaEndpoint} and allows requests from this app.`
        : 'Unable to connect to the local Ollama server.';
    } finally {
      this.chatBusy = false;
    }
  }

  private readOllamaReply(data: unknown): string {
    if (
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof data.message === 'object' &&
      data.message !== null &&
      'content' in data.message &&
      typeof data.message.content === 'string'
    ) {
      return data.message.content;
    }

    throw new Error('The Ollama response did not contain a message.');
  }
}
