import { Component, HostListener } from '@angular/core';
import { ActivatedRoute, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Meta } from '@angular/platform-browser';

interface PageContent {
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  biography?: string;
  technicalToolkit?: string;
  interests?: string;
  experienceSource?: string;
  whereToNext?: string;
  nextLinks?: Array<{ label: string; href: string }>;
  reminder?: string;
  reminderLink?: { label: string; href: string };
  linksSource?: string;
  cardsSource?: string;
  profileSource?: string;
  educationSource?: string;
  cards: Array<{ title: string; description: string; href?: string; requiresReveal?: boolean }>;
}

interface LinksManifest {
  links: Array<{ title: string; description: string; href?: string; requiresReveal?: boolean }>;
}

interface CardsManifest {
  cards: Array<{ title: string; description: string; href?: string; requiresReveal?: boolean }>;
}

interface ProfileManifest {
  toolkit: string[];
  interests: string[];
  resumePath: string;
  email: string;
  phone: string;
  linkedin: string;
}

interface EducationEntry {
  period: string;
  title: string;
  detail: string;
  metric?: string;
  grades?: Array<{ semester: string; sgpa: string }>;
  achievements?: Array<{ text: string; metric?: string; suffix?: string }>;
}

interface EducationManifest {
  education: EducationEntry[];
}

interface ProjectEntry {
  title: string;
  timeline: string;
  trialLink: string;
  githubLink: string;
  photos?: string[];
  explanation: string;
  thoughtProcess: string;
  resultsSummary: string;
  createdWith: 'solely' | 'group' | 'ai';
}

interface ProjectManifest {
  projects: ProjectEntry[];
}

interface ContactField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'textarea' | 'number';
  placeholder?: string;
  required?: boolean;
}

interface ContactReason {
  value: string;
  label: string;
  fields: ContactField[];
}

interface ContactManifest {
  recipient: string;
  reasons: ContactReason[];
}

@Component({
  selector: 'app-invest-contact',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="invest-page">
      <p class="eyebrow"><span class="eyebrow-line"></span> Open to meaningful conversations</p>
      <h1>Let's talk about <em>what comes next.</em></h1>
      <p class="invest-intro">Share a little context and I’ll help turn the conversation into a clear next step.</p>
      @if (loadError) {
        <p class="invest-load-error">{{ loadError }}</p>
      } @else if (manifest) {
        <form class="invest-form" (ngSubmit)="openEmailDraft()">
          <label>
            Your name
            <input name="name" type="text" [(ngModel)]="formValues['name']" required placeholder="Your full name">
          </label>
          <label>
            Your email
            <input name="email" type="email" [(ngModel)]="formValues['email']" required placeholder="you@example.com">
          </label>
          <label>
            Reason for reaching out
            <select name="reason" [(ngModel)]="selectedReason" (ngModelChange)="resetReasonFields()" required>
              <option value="" disabled>Select a reason</option>
              @for (reason of manifest.reasons; track reason.value) {
                <option [value]="reason.value">{{ reason.label }}</option>
              }
            </select>
          </label>
          @if (activeReason) {
            <div class="invest-reason-fields">
              @for (field of activeReason.fields; track field.key) {
                <label>
                  {{ field.label }}
                  @if (field.type === 'textarea') {
                    <textarea [name]="field.key" [(ngModel)]="formValues[field.key]" [required]="field.required ?? false" rows="4" [placeholder]="field.placeholder ?? ''"></textarea>
                  } @else {
                    <input [name]="field.key" [type]="field.type" [(ngModel)]="formValues[field.key]" [required]="field.required ?? false" [placeholder]="field.placeholder ?? ''">
                  }
                </label>
              }
            </div>
          }
          @if (formError) {
            <p class="invest-form-error" role="alert">{{ formError }}</p>
          }
          <button class="button button-dark" type="submit">Open Gmail draft <span aria-hidden="true">↗</span></button>
        </form>
      }
    </main>
  `,
  styles: [`
    .invest-page { margin: 0 auto; max-width: 900px; min-height: calc(100vh - 150px); padding: 110px 28px 130px; }
    .invest-page h1 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(50px, 8vw, 100px); letter-spacing: -.07em; line-height: .9; margin: 0 0 32px; max-width: 820px; }
    .invest-page h1 em { color: #f45b36; font-style: normal; }
    .invest-intro { color: #716f6a; font-size: 18px; line-height: 1.7; margin: 0; max-width: 620px; }
    .invest-form { border-top: 1px solid #d8d3ca; display: grid; gap: 20px; margin-top: 65px; padding-top: 28px; }
    .invest-form label { color: #1c1b1a; display: grid; font-size: 12px; font-weight: 700; gap: 8px; }
    .invest-form input, .invest-form select, .invest-form textarea { background: #fff; border: 1px solid #b9b3aa; color: #1c1b1a; font: inherit; font-size: 14px; padding: 12px; resize: vertical; }
    .invest-form input:focus, .invest-form select:focus, .invest-form textarea:focus { border-color: #f45b36; outline: 0; }
    .invest-reason-fields { border-left: 2px solid #f45b36; display: grid; gap: 20px; padding-left: 20px; }
    .invest-form .button { justify-self: end; margin-top: 10px; }
    .invest-form-error { color: #b3261e; font-size: 13px; margin: 0; }
    .invest-load-error { color: #b3261e; margin-top: 50px; }
    @media (max-width: 800px) {
      .invest-page { padding: 75px 20px 90px; }
      .invest-form .button { justify-self: start; }
    }
  `]
})
export class InvestContactComponent {
  protected manifest: ContactManifest | null = null;
  protected selectedReason = '';
  protected formValues: Record<string, string> = { name: '', email: '' };
  protected loadError = '';
  protected formError = '';

  constructor() {
    void this.loadContactConfig();
  }

  protected get activeReason(): ContactReason | undefined {
    return this.manifest?.reasons.find((reason) => reason.value === this.selectedReason);
  }

  protected resetReasonFields(): void {
    this.formError = '';
    for (const key of Object.keys(this.formValues)) {
      if (key !== 'name' && key !== 'email') {
        delete this.formValues[key];
      }
    }
  }

  protected openEmailDraft(): void {
    this.formError = '';
    const reason = this.activeReason;
    if (!this.manifest || !reason) {
      this.formError = 'Please select a reason for reaching out.';
      return;
    }

    if (!this.formValues['name']?.trim() || !this.formValues['email']?.trim()) {
      this.formError = 'Please complete your name and email.';
      return;
    }

    const missingField = reason.fields.find((field) => field.required && !this.formValues[field.key]?.trim());
    if (missingField) {
      this.formError = `Please complete: ${missingField.label}.`;
      return;
    }

    const details = [
      `Name: ${this.formValues['name']}`,
      `Email: ${this.formValues['email']}`,
      `Reason: ${reason.label}`,
      '',
      ...reason.fields.map((field) => `${field.label}: ${this.formValues[field.key] ?? ''}`)
    ].join('\n');
    const subject = `${reason.label} — Aditya Pokharkar`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(this.manifest.recipient)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(details)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  }

  private async loadContactConfig(): Promise<void> {
    try {
      const response = await fetch('assets/contact/contact.json');
      if (!response.ok) {
        this.loadError = 'The contact form could not be loaded right now.';
        return;
      }

      this.manifest = await response.json() as ContactManifest;
    } catch {
      this.loadError = 'The contact form could not be loaded right now.';
    }
  }
}

@Component({
  selector: 'app-project-list',
  standalone: true,
  template: `
    <main class="project-page">
      <p class="eyebrow"><span class="eyebrow-line"></span> Selected work</p>
      <h1>Projects built <em>along the way.</em></h1>
      <p class="project-intro">A selection of projects spanning native development, optimisation, enterprise workflows, and collaborative software.</p>
      @if (loadError) {
        <p class="project-load-error">{{ loadError }}</p>
      } @else {
        <div class="project-list">
          @for (project of projects; track project.title) {
            <article class="project-entry">
              <div class="project-entry-header">
                <div>
                  <span class="project-timeline">{{ project.timeline }}</span>
                  <h2>{{ project.title }}</h2>
                </div>
              </div>
              <p class="project-created-with">Created {{ project.createdWith === 'solely' ? 'solely' : project.createdWith === 'group' ? 'in a group' : 'with help from AI' }}</p>
              @if (project.photos?.length) {
                <div class="project-photos">
                  @for (photo of project.photos; track photo) {
                    <img [src]="photo" [alt]="project.title + ' project example'">
                  }
                </div>
              }
              <div class="project-sections">
                <section><p>Explanation</p><div>{{ project.explanation }}</div></section>
                <section><p>Thought process</p><div>{{ project.thoughtProcess }}</div></section>
                <section><p>Results summary</p><div>{{ project.resultsSummary }}</div></section>
              </div>
              <div class="project-links">
                <a [href]="project.trialLink" target="_blank" rel="noreferrer">Try it ↗</a>
                <a [href]="project.githubLink" target="_blank" rel="noreferrer">GitHub ↗</a>
                <button type="button" (click)="askAiAboutProject(project)">Ask AI in detail ↗</button>
              </div>
            </article>
          }
        </div>
      }
    </main>
  `,
  styles: [`
    .project-page { margin: 0 auto; max-width: 1176px; min-height: calc(100vh - 150px); padding: 110px 0 130px; }
    .project-page h1 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(55px, 9vw, 112px); letter-spacing: -.07em; line-height: .9; margin: 0 0 35px; max-width: 850px; }
    .project-page h1 em { color: #f45b36; font-style: normal; }
    .project-intro { color: #716f6a; font-size: 16px; line-height: 1.7; margin: 0; max-width: 680px; }
    .project-list { border-top: 1px solid #d8d3ca; margin-top: 70px; }
    .project-entry { border-bottom: 1px solid #d8d3ca; padding: 34px 0 42px; }
    .project-entry-header { align-items: flex-start; display: flex; gap: 24px; justify-content: space-between; }
    .project-timeline { color: #f45b36; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .project-created-with { color: #716f6a; font-size: 12px; margin: 14px 0 0; }
    .project-entry h2 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(28px, 4vw, 48px); letter-spacing: -.05em; line-height: 1; margin: 12px 0 0; }
    .project-links { display: flex; flex-wrap: wrap; gap: 18px; justify-content: flex-end; margin-top: 30px; }
    .project-links a, .project-links button { background: transparent; border: 0; color: #f45b36; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; letter-spacing: .1em; padding: 0; text-decoration: none; text-transform: uppercase; }
    .project-links a:hover, .project-links button:hover { color: #1c1b1a; }
    .project-photos { display: grid; gap: 14px; grid-template-columns: repeat(3, 1fr); margin-top: 28px; }
    .project-photos img { aspect-ratio: 16 / 9; background: #f5f0eb; object-fit: cover; width: 100%; }
    .project-sections { display: grid; gap: 22px; grid-template-columns: repeat(3, 1fr); margin-top: 32px; }
    .project-sections section { border-left: 2px solid #f45b36; padding-left: 18px; }
    .project-sections p { color: #f45b36; font-size: 11px; font-weight: 700; letter-spacing: .12em; margin: 0 0 10px; text-transform: uppercase; }
    .project-sections div { color: #1c1b1a; font-size: 15px; line-height: 1.65; }
    .project-load-error { color: #b3261e; margin-top: 50px; }
    @media (max-width: 800px) {
      .project-page { margin: 0 20px; padding: 75px 0 90px; }
      .project-entry-header { display: block; }
      .project-links { margin-top: 20px; }
      .project-photos, .project-sections { grid-template-columns: 1fr; }
    }
  `]
})
export class ProjectListComponent {
  protected projects: ProjectEntry[] = [];
  protected loadError = '';

  constructor() {
    void this.loadProjects();
  }

  protected askAiAboutProject(project: ProjectEntry): void {
    window.dispatchEvent(new CustomEvent('open-ai-project', {
      detail: {
        prompt: `Tell me in detail about the ${project.title} project, including its timeline, explanation, thought process, implementation decisions, and results.`
      }
    }));
  }

  private async loadProjects(): Promise<void> {
    try {
      const response = await fetch('assets/projects/projects.json');
      if (!response.ok) {
        this.loadError = 'Projects could not be loaded right now.';
        return;
      }

      const manifest = await response.json() as ProjectManifest;
      this.projects = manifest.projects;
    } catch {
      this.loadError = 'Projects could not be loaded right now.';
    }
  }
}

interface HobbyEntry {
  title: string;
  associatedHobby: string;
  act: string;
  process: string;
  results: string;
  photos?: string[];
  resultLinks?: Array<{ label: string; url: string }>;
}

interface HobbyManifest {
  hobbies: HobbyEntry[];
}

@Component({
  selector: 'app-hobby-list',
  standalone: true,
  template: `
    <main class="hobby-page">
      <p class="eyebrow"><span class="eyebrow-line"></span> Personal practice</p>
      <h1>Hobbies and <em>creative work.</em></h1>
      <p class="hobby-intro">A collection of activities, experiments, and outcomes beyond my professional work.</p>
      @if (loadError) {
        <p class="hobby-load-error">{{ loadError }}</p>
      } @else {
        <nav class="hobby-filters" aria-label="Filter hobbies">
          @for (filter of filters; track filter) {
            <button type="button" [class.active]="selectedHobby === filter" (click)="selectedHobby = filter">{{ filter }}</button>
          }
        </nav>
        <div class="hobby-list">
          @for (hobby of filteredHobbies; track hobby.title) {
            <article class="hobby-entry">
              <p class="hobby-type">{{ hobby.associatedHobby }}</p>
              <h2>{{ hobby.title }}</h2>
              @if (hobby.photos?.length) {
                <div class="hobby-photos">
                  @for (photo of hobby.photos; track photo) {
                    <img [src]="photo" [alt]="hobby.title + ' example'">
                  }
                </div>
              }
              <div class="hobby-sections">
                <section><p>The act</p><div>{{ hobby.act }}</div></section>
                <section><p>The process</p><div>{{ hobby.process }}</div></section>
                <section><p>The results</p><div>{{ hobby.results }}</div></section>
              </div>
              @if (hobby.resultLinks?.length) {
                <div class="hobby-result-links">
                  <span>Results</span>
                  @for (link of hobby.resultLinks; track link.url) {
                    <a [href]="link.url" target="_blank" rel="noreferrer">{{ link.label }} ↗</a>
                  }
                </div>
              }
            </article>
          }
        </div>
      }
    </main>
  `,
  styles: [`
    .hobby-page { margin: 0 auto; max-width: 1176px; min-height: calc(100vh - 150px); padding: 110px 0 130px; }
    .hobby-page h1 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(55px, 9vw, 112px); letter-spacing: -.07em; line-height: .9; margin: 0 0 35px; max-width: 850px; }
    .hobby-page h1 em { color: #f45b36; font-style: normal; }
    .hobby-intro { color: #716f6a; font-size: 16px; line-height: 1.7; margin: 0; max-width: 680px; }
    .hobby-filters { display: flex; flex-wrap: wrap; gap: 10px; margin: 55px 0 30px; }
    .hobby-filters button { background: transparent; border: 1px solid #d8d3ca; color: #716f6a; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; letter-spacing: .1em; padding: 10px 13px; text-transform: uppercase; }
    .hobby-filters button.active, .hobby-filters button:hover { background: #1c1b1a; border-color: #1c1b1a; color: #fff; }
    .hobby-list { border-top: 1px solid #d8d3ca; }
    .hobby-entry { border-bottom: 1px solid #d8d3ca; padding: 34px 0 42px; }
    .hobby-type { color: #f45b36; font-size: 11px; font-weight: 700; letter-spacing: .12em; margin: 0 0 12px; text-transform: uppercase; }
    .hobby-entry h2 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(30px, 5vw, 58px); letter-spacing: -.06em; line-height: 1; margin: 0; }
    .hobby-photos { display: grid; gap: 14px; grid-template-columns: repeat(3, 1fr); margin-top: 28px; }
    .hobby-photos img { aspect-ratio: 16 / 9; background: #f5f0eb; object-fit: cover; width: 100%; }
    .hobby-sections { display: grid; gap: 22px; grid-template-columns: repeat(3, 1fr); margin-top: 32px; }
    .hobby-sections section { border-left: 2px solid #f45b36; padding-left: 18px; }
    .hobby-sections p, .hobby-result-links span { color: #f45b36; font-size: 11px; font-weight: 700; letter-spacing: .12em; margin: 0 0 10px; text-transform: uppercase; }
    .hobby-sections div { color: #1c1b1a; font-size: 15px; line-height: 1.65; }
    .hobby-result-links { align-items: baseline; display: flex; flex-wrap: wrap; gap: 18px; margin-top: 30px; }
    .hobby-result-links a { color: #f45b36; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-decoration: none; text-transform: uppercase; }
    .hobby-result-links a:hover { color: #1c1b1a; }
    .hobby-load-error { color: #b3261e; margin-top: 50px; }
    @media (max-width: 800px) {
      .hobby-page { margin: 0 20px; padding: 75px 0 90px; }
      .hobby-photos, .hobby-sections { grid-template-columns: 1fr; }
    }
  `]
})
export class HobbyListComponent {
  protected hobbies: HobbyEntry[] = [];
  protected selectedHobby = 'All';
  protected loadError = '';

  protected get filters(): string[] {
    return ['All', ...new Set(this.hobbies.map((hobby) => hobby.associatedHobby))];
  }

  protected get filteredHobbies(): HobbyEntry[] {
    return this.selectedHobby === 'All'
      ? this.hobbies
      : this.hobbies.filter((hobby) => hobby.associatedHobby === this.selectedHobby);
  }

  constructor() {
    void this.loadHobbies();
  }

  private async loadHobbies(): Promise<void> {
    try {
      const response = await fetch('assets/hobbies/hobbies.json');
      if (!response.ok) {
        this.loadError = 'Hobbies could not be loaded right now.';
        return;
      }

      const manifest = await response.json() as HobbyManifest;
      this.hobbies = manifest.hobbies;
    } catch {
      this.loadError = 'Hobbies could not be loaded right now.';
    }
  }
}

interface ExperienceEntry {
  period: string;
  firm: string;
  role: string;
  location: string;
  summary: string;
  projects: Array<{ title: string; details: Array<{ text: string; metric?: string; suffix?: string }> }>;
  qualitativeAssessment?: string[];
  recommendations?: Array<{ name: string; relation: string; linkedin: string; comment: string }>;
}

interface ExperienceManifest {
  experience: ExperienceEntry[];
}

@Component({
  selector: 'app-home-route',
  standalone: true,
  template: ''
})
export class HomeRouteComponent {}

interface EssayIndexItem {
  slug: string;
  category: string;
  title: string;
  summary: string;
  author: string;
  publishedAt: string;
  file: string;
}

interface EssayContent extends EssayIndexItem {
  body: string;
}

interface EssayManifest {
  essays: EssayIndexItem[];
}

@Component({
  selector: 'app-essay-list',
  standalone: true,
  template: `
    <main class="essay-list-page">
      <p class="eyebrow"><span class="eyebrow-line"></span> Notes from the process</p>
      <h1>Blog and thought <em>essays.</em></h1>
      @if (loadError) {
        <p class="essay-load-error">{{ loadError }}</p>
      } @else {
        <div class="essay-list-grid">
          @for (essay of essays; track essay.slug) {
            <article class="essay-list-card">
              <p>{{ essay.category }}</p>
              <h2><a [href]="'/essays/' + essay.slug" target="_blank" rel="noreferrer">{{ essay.title }} <span aria-hidden="true">↗</span></a></h2>
              <small>By {{ essay.author }}</small>
              <div>{{ essay.summary }}</div>
            </article>
          }
        </div>
      }
    </main>
  `,
  styles: [`
    .essay-list-page { margin: 0 auto; max-width: 1080px; padding: 110px 28px 120px; }
    .essay-list-page h1 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(48px, 8vw, 92px); letter-spacing: -.07em; line-height: .95; margin: 0; max-width: 760px; }
    .essay-list-page h1 em { color: #f45b36; font-style: normal; }
    .essay-list-grid { border-top: 1px solid #d8d3ca; display: grid; grid-template-columns: repeat(2, 1fr); margin-top: 85px; }
    .essay-list-card { border-bottom: 1px solid #d8d3ca; min-height: 210px; padding: 28px 35px 28px 0; }
    .essay-list-card:nth-child(odd) { border-right: 1px solid #d8d3ca; padding-right: 40px; }
    .essay-list-card:nth-child(even) { padding-left: 40px; }
    .essay-list-card > p { color: #716f6a; font-size: 11px; font-weight: 700; letter-spacing: .12em; margin: 0 0 35px; text-transform: uppercase; }
    .essay-list-card h2 { font-family: 'Space Grotesk', sans-serif; font-size: 27px; letter-spacing: -.04em; margin: 0 0 12px; }
    .essay-list-card h2 a { color: inherit; text-decoration: none; }
    .essay-list-card h2 a:hover { color: #f45b36; }
    .essay-list-card div { color: #716f6a; font-size: 14px; line-height: 1.6; max-width: 400px; }
    .essay-list-card small { color: #1c1b1a; display: block; font-size: 12px; margin-bottom: 10px; }
    .essay-load-error { color: #b3261e; margin-top: 50px; }
    @media (max-width: 800px) {
      .essay-list-page { padding: 75px 20px 90px; }
      .essay-list-grid { grid-template-columns: 1fr; margin-top: 60px; }
      .essay-list-card:nth-child(odd), .essay-list-card:nth-child(even) { border-right: 0; padding-left: 0; padding-right: 0; }
    }
  `]
})
export class EssayListComponent {
  protected essays: EssayIndexItem[] = [];
  protected loadError = '';

  constructor() {
    void this.loadEssays();
  }

  private async loadEssays(): Promise<void> {
    try {
      const response = await fetch('assets/essays/essays.json');
      if (!response.ok) {
        this.loadError = 'Essays could not be loaded right now.';
        return;
      }

      const manifest = await response.json() as EssayManifest;
      this.essays = manifest.essays;
    } catch {
      this.loadError = 'Essays could not be loaded right now.';
    }
  }
}

@Component({
  selector: 'app-essay-page',
  standalone: true,
  template: `
    <main class="essay-page">
      <button class="essay-close" type="button" (click)="closeEssay()">Close essay ×</button>
      @if (loadError) {
        <p class="essay-load-error">{{ loadError }}</p>
      } @else if (essay) {
        <p class="eyebrow"><span class="eyebrow-line"></span> {{ essay.category }}</p>
        <h1>{{ essay.title }}</h1>
        <p class="essay-summary">{{ essay.summary }}</p>
        <div class="essay-body">
          <div class="essay-meta">
            <p>By {{ essay.author }}</p>
            <time [attr.datetime]="essay.publishedAt">{{ formatPublishedAt(essay.publishedAt) }}</time>
          </div>
          <div [innerHTML]="essay.body"></div>
        </div>
      }
    </main>
  `,
  styles: [`
    .essay-page { margin: 0 auto; max-width: 820px; min-height: 100vh; padding: 80px 28px 120px; position: relative; }
    .eyebrow { align-items: center; color: #716f6a; display: flex; font-size: 11px; font-weight: 700; gap: 12px; letter-spacing: .12em; margin: 0 0 28px; text-transform: uppercase; }
    .eyebrow-line { background: #f45b36; display: inline-block; height: 1px; width: 26px; }
    .essay-page h1 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(48px, 8vw, 92px); letter-spacing: -.07em; line-height: .95; margin: 0 0 32px; max-width: 720px; }
    .essay-summary { color: #716f6a; font-size: clamp(18px, 2vw, 24px); line-height: 1.55; margin: 0; max-width: 650px; }
    .essay-body { border-top: 1px solid #d8d3ca; margin-top: 64px; padding-top: 28px; }
    .essay-body { color: #1c1b1a; font-size: 18px; line-height: 1.8; max-width: 680px; }
    .essay-body :is(p, ul, ol, blockquote) { margin: 0 0 22px; }
    .essay-body h2 { font-family: 'Space Grotesk', sans-serif; font-size: 28px; letter-spacing: -.04em; margin: 38px 0 14px; }
    .essay-meta { color: #716f6a; font-size: 12px; margin-bottom: 34px; text-align: left; }
    .essay-meta p { color: #1c1b1a; font-weight: 700; margin: 0 0 5px; }
    .essay-meta time { display: block; }
    .essay-close { background: transparent; border: 0; color: #f45b36; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; letter-spacing: .1em; padding: 0; position: absolute; right: 28px; text-transform: uppercase; top: 80px; }
    .essay-close:hover { color: #1c1b1a; }
  `]
})
export class EssayPageComponent {
  protected essay: EssayContent | null = null;
  protected loadError = '';

  constructor(route: ActivatedRoute, private readonly meta: Meta) {
    const slug = route.snapshot.paramMap.get('slug');
    void this.loadEssay(slug);
    window.history.pushState(null, '', window.location.href);
  }

  @HostListener('window:popstate')
  protected preventBackNavigation(): void {
    window.history.forward();
  }

  protected closeEssay(): void {
    window.close();
  }

  private async loadEssay(slug: string | null): Promise<void> {
    try {
      if (!slug) {
        this.loadError = 'This essay could not be found.';
        return;
      }

      const manifestResponse = await fetch('assets/essays/essays.json');
      if (!manifestResponse.ok) {
        this.loadError = 'This essay could not be loaded right now.';
        return;
      }

      const manifest = await manifestResponse.json() as EssayManifest;
      const entry = manifest.essays.find((essay) => essay.slug === slug);
      if (!entry) {
        this.loadError = 'This essay could not be found.';
        return;
      }

      const bodyResponse = await fetch(`assets/essays/${entry.file}`);
      if (!bodyResponse.ok) {
        this.loadError = 'This essay could not be loaded right now.';
        return;
      }

      this.essay = { ...entry, body: await bodyResponse.text() };
      this.meta.updateTag({ name: 'author', content: entry.author });
      this.meta.updateTag({ property: 'article:author', content: entry.author });
      this.meta.updateTag({ property: 'article:published_time', content: entry.publishedAt });
    } catch {
      this.loadError = 'This essay could not be loaded right now.';
    }
  }

  protected formatPublishedAt(value: string): string {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    }).format(new Date(value)) + ' IST';
  }
}

@Component({
  selector: 'app-dummy-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="dummy-page">
      <p class="eyebrow"><span class="eyebrow-line"></span> {{ content.eyebrow }}</p>
      <h1>{{ content.title }} <em>{{ content.accent }}</em></h1>
      @if (content.biography) {
        <div class="profile-photo-wrap" [style.--vignette-strength]="vignetteStrength">
          <img class="profile-photo" src="assets/Me.jpg" alt="Aditya Pokharkar">
          <div class="profile-vignette" aria-hidden="true"></div>
          @if (content.biography) {
            <div class="biography-overlay" [style.opacity]="overlayOpacity">
              <p class="biography-overlay-label">Autobiography</p>
              <p>{{ content.biography }}</p>
            </div>
          }
          @if (profile) {
            <div class="profile-overlay" [style.opacity]="toolkitOpacity">
              <p><strong>Toolkit</strong>{{ profile.toolkit.join(', ') }}.</p>
              <p><strong>Interests</strong>{{ profile.interests.join(', ') }}.</p>
            </div>
          }
        </div>
      }

      @if (content.experienceSource && experience.length) {
        <section class="experience-block">
          <p class="story-label">Experience</p>
          <div class="experience-list">
            @for (firm of experience; track firm.firm) {
              <article class="experience-firm">
                <div class="experience-firm-header">
                  <div>
                    <span class="experience-period">{{ firm.period }}</span>
                    <h2>{{ firm.firm }}</h2>
                    <p class="experience-role">{{ firm.role }} · {{ firm.location }}</p>
                  </div>
                </div>
                <p class="experience-summary">{{ firm.summary }}</p>
                @if (firm.qualitativeAssessment?.length) {
                  <section class="experience-qualitative">
                    <div class="experience-qualitative-header">
                      <div>
                        <p class="experience-qualitative-label">Qualitative assessment</p>
                      </div>
                      <button
                        class="experience-reload-button"
                        type="button"
                        title="This AI assessment is formed through a personal AI project. Check the Projects section to learn more."
                        aria-label="Reload AI assessment. This AI assessment is formed through a personal AI project. Check the Projects section to learn more.">
                        Reload AI assessment
                      </button>
                    </div>
                    <ul>
                      @for (detail of firm.qualitativeAssessment; track detail) {
                        <li>{{ detail }}</li>
                      }
                    </ul>
                  </section>
                }
                @if (firm.recommendations?.length) {
                  <details class="experience-recommendations">
                    <summary>Recommendations <span aria-hidden="true">+</span></summary>
                    <div class="recommendation-list">
                      @for (recommendation of firm.recommendations; track recommendation.name) {
                        <blockquote class="recommendation">
                          <p class="recommendation-comment">“{{ recommendation.comment }}”</p>
                          <footer><a [href]="recommendation.linkedin" target="_blank" rel="noreferrer">{{ recommendation.name }}</a><span>{{ recommendation.relation }}</span></footer>
                        </blockquote>
                      }
                    </div>
                  </details>
                }
                <div class="experience-projects">
                  @for (project of firm.projects; track project.title) {
                    <details class="experience-project">
                      <summary>
                        <span class="experience-project-label">Project</span>
                        <span class="experience-project-title">{{ project.title }}</span>
                        <span class="experience-project-toggle" aria-hidden="true">+</span>
                      </summary>
                      <ul>
                        @for (detail of project.details; track detail) {
                          <li>{{ detail.text }} @if (detail.metric) { <strong class="experience-metric">{{ detail.metric }}</strong> }{{ detail.suffix }}</li>
                        }
                      </ul>
                    </details>
                  }
                </div>
              </article>
            }
          </div>
        </section>
      }
      @if (experienceLoadError) {
        <p class="experience-load-error">{{ experienceLoadError }}</p>
      }

      @if (content.educationSource && education.length) {
        <section class="education-block">
          <p class="story-label">Education</p>
          <div class="education-list">
            @for (item of education; track item.period) {
              <article class="education-item">
                <span class="education-period">{{ item.period }}</span>
                <h2>{{ item.title }}</h2>
                <p>{{ item.detail }} @if (item.metric) { <strong class="education-metric">{{ item.metric }}</strong> }</p>

                @if (item.grades?.length) {
                  <div class="grades-table-wrap">
                    <table class="grades-table">
                      <tbody>
                        <tr class="grades-row semesters">
                          @for (grade of item.grades; track grade.semester) {
                            <th>{{ grade.semester }}</th>
                          }
                        </tr>
                        <tr class="grades-row values">
                          @for (grade of item.grades; track grade.semester) {
                            <td>{{ grade.sgpa }}</td>
                          }
                        </tr>
                      </tbody>
                    </table>
                  </div>
                }

                @if (item.achievements) {
                  <div class="education-achievements">
                    <p class="education-achievements-label">College achievements</p>
                    <ul>
                      @for (achievement of item.achievements; track $index) {
                        <li>{{ achievement.text }} @if (achievement.metric) { <strong class="education-metric">{{ achievement.metric }}</strong> }{{ achievement.suffix }}</li>
                      }
                    </ul>
                  </div>
                }
              </article>
            }
          </div>
        </section>
      }
      @if (educationLoadError) {
        <p class="education-load-error">{{ educationLoadError }}</p>
      }

      @if (content.whereToNext) {
        <section class="next-block">
          <p class="story-label">Where to next</p>
          <p class="next-copy">{{ content.whereToNext }}</p>
          @if (content.nextLinks?.length) {
            <nav class="next-links" aria-label="Explore more">
              @for (link of content.nextLinks; track link.href) {
                <a [href]="link.href">{{ link.label }} <span aria-hidden="true">↗</span></a>
              }
            </nav>
          }
        </section>
      }

      @if (content.reminder) {
        <section class="next-block links-reminder">
            <p class="story-label">A small reminder</p>
            <p class="next-copy">{{ content.reminder }}</p>
            @if (content.reminderLink) {
              <nav class="next-links" aria-label="Contact">
                <a [href]="content.reminderLink.href">{{ content.reminderLink.label }} <span aria-hidden="true">↗</span></a>
              </nav>
            }
        </section>
      }
      @if (pageCards.length) {
        <div class="dummy-grid">
          @for (card of pageCards; track card.title) {
            <article class="dummy-card">
              <h2>{{ card.title }}</h2>
              <p>{{ card.description }}</p>
            </article>
          }
        </div>
      }
      @if (links.length) {
        <div class="dummy-grid">
            @for (card of links; track card.title) {
              <article class="dummy-card">
                @if (card.requiresReveal) {
                  <h2><button class="dummy-card-link dummy-card-button" type="button" (click)="openPhoneDialog()">Phone <span aria-hidden="true">↗</span></button></h2>
                } @else if (card.href) {
                  <h2><a class="dummy-card-link" [href]="card.href" target="_blank" rel="noreferrer">{{ card.title }} <span aria-hidden="true">↗</span></a></h2>
                } @else {
                  <h2>{{ card.title }}</h2>
                }
                <p>{{ card.description }}</p>
              </article>
              }
        </div>
      }
    </main>
    @if (phoneDialogOpen) {
      <div class="phone-dialog-backdrop" role="presentation" (click)="closePhoneDialog()">
        <section class="phone-dialog" role="dialog" aria-modal="true" aria-labelledby="phone-dialog-title" (click)="$event.stopPropagation()">
          <button class="phone-dialog-close" type="button" (click)="closePhoneDialog()" aria-label="Close phone request dialog">×</button>
          @if (!phoneRevealed) {
            <p class="eyebrow"><span class="eyebrow-line"></span> Before we connect</p>
            <h2 id="phone-dialog-title">Tell me a little<br><em>about the call.</em></h2>
            <p class="phone-dialog-copy">Share your purpose and callback number. The request will be saved in this browser before my phone number is revealed.</p>
            <form (ngSubmit)="submitPhoneRequest()">
              <label>
                Purpose of the call
                <textarea name="purpose" [(ngModel)]="phonePurpose" required rows="3" placeholder="What would you like to discuss?"></textarea>
              </label>
              <label>
                Your phone number
                <input name="callbackNumber" [(ngModel)]="callbackNumber" required type="tel" placeholder="+91 ...">
              </label>
              @if (phoneError) {
                <p class="phone-error">{{ phoneError }}</p>
              }
              <button class="button button-dark" type="submit">Send request & reveal <span aria-hidden="true">↗</span></button>
            </form>
          } @else {
            <p class="eyebrow"><span class="eyebrow-line"></span> Request prepared</p>
            <h2 id="phone-dialog-title">Here is my<br><em>number.</em></h2>
            <p class="revealed-phone"><a [href]="'tel:' + (profile?.phone ?? '')">{{ profile?.phone }}</a></p>
            <p class="phone-dialog-copy">Your request was saved locally in this browser. A server would be needed to send it to Aditya automatically.</p>
            <button class="button button-dark" type="button" (click)="closePhoneDialog()">Done <span aria-hidden="true">×</span></button>
          }
        </section>
      </div>
    }
  `,
  styles: [`
    .dummy-page { margin: 0 auto; max-width: 1176px; min-height: calc(100vh - 150px); padding: 110px 0 130px; }
    .eyebrow { align-items: center; color: #716f6a; display: flex; font-size: 11px; font-weight: 700; gap: 12px; letter-spacing: .12em; margin: 0 0 28px; text-transform: uppercase; }
    .eyebrow-line { background: #f45b36; display: inline-block; height: 1px; width: 26px; }
    .dummy-page h1 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(55px, 9vw, 112px); letter-spacing: -.07em; line-height: .9; margin: 0 0 35px; max-width: 850px; }
    .dummy-page h1 em { color: #f45b36; font-style: normal; }
    .profile-photo-wrap { --vignette-strength: .08; margin: 42px calc((1176px - 100vw) / 2) 0; position: relative; }
    .profile-photo { display: block; height: auto; width: 100%; }
    .profile-vignette { background: radial-gradient(ellipse at center, transparent 32%, rgba(0, 0, 0, var(--vignette-strength)) 100%); inset: 0; pointer-events: none; position: absolute; }
    .profile-overlay, .biography-overlay { background: #1c1b1af2; color: #fff; position: absolute; transition: opacity .15s ease-out; width: 40%; z-index: 2; }
    .profile-overlay { align-content: center; bottom: 24px; display: grid; gap: 18px; min-height: 220px; padding: 24px; right: 24px; text-align: right; }
    .profile-overlay p { font-size: 13px; line-height: 1.55; margin: 0; }
    .profile-overlay strong { color: #f45b36; display: block; font-size: 11px; letter-spacing: .12em; margin-bottom: 5px; text-transform: uppercase; }
    .biography-overlay { left: 24px; padding: 24px; top: 24px; }
    .biography-overlay p { font-size: 14px; line-height: 1.6; margin: 0; }
    .biography-overlay-label { color: #f45b36; font-size: 11px !important; font-weight: 700; letter-spacing: .12em; margin-bottom: 10px !important; text-transform: uppercase; }
    .story-block, .education-block { border-top: 1px solid #d8d3ca; margin-top: 50px; padding-top: 28px; }
    .experience-block { border-top: 1px solid #d8d3ca; margin-top: 50px; padding-top: 28px; }
    .experience-list { display: grid; gap: 24px; margin-top: 24px; }
    .experience-firm { border: 1px solid #d8d3ca; padding: 28px; }
    .experience-period { color: #f45b36; display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: .08em; margin-bottom: 10px; text-transform: uppercase; }
    .experience-firm h2 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(28px, 4vw, 44px); letter-spacing: -.05em; line-height: 1; margin: 0 0 8px; }
    .experience-role, .experience-summary { color: #716f6a; font-size: 15px; line-height: 1.6; margin: 0; }
    .experience-summary { color: #1c1b1a; margin-top: 20px; max-width: 850px; }
    .experience-qualitative { background: #fffaf7; border: 1px solid #e7dfd7; margin-top: 24px; padding: 20px 22px; }
    .experience-qualitative-header { align-items: flex-start; display: flex; gap: 22px; justify-content: space-between; }
    .experience-qualitative-label { color: #f45b36; font-size: 11px; font-weight: 700; letter-spacing: .12em; margin: 0 0 10px; text-transform: uppercase; }
    .experience-qualitative-disclaimer { color: #716f6a; font-size: 12px; line-height: 1.5; margin: 0; max-width: 650px; }
    .experience-reload-button { background: transparent; border: 1px solid #d8d3ca; color: #716f6a; cursor: pointer; flex: 0 0 auto; font: inherit; font-size: 10px; font-weight: 700; letter-spacing: .08em; padding: 9px 11px; text-transform: uppercase; }
    .experience-reload-button:hover { border-color: #f45b36; color: #f45b36; }
    .experience-qualitative ul { display: grid; gap: 8px; margin: 0; padding-left: 18px; }
    .experience-qualitative li { color: #716f6a; font-size: 14px; line-height: 1.6; padding-left: 4px; }
    .experience-recommendations { border-top: 1px solid #e7dfd7; margin-top: 28px; padding-top: 18px; }
    .experience-recommendations summary { color: #f45b36; cursor: pointer; font-size: 11px; font-weight: 700; letter-spacing: .12em; list-style: none; text-transform: uppercase; }
    .experience-recommendations summary::-webkit-details-marker { display: none; }
    .experience-recommendations summary span { float: right; font-size: 18px; font-weight: 400; line-height: .6; }
    .experience-recommendations[open] summary span { transform: rotate(45deg); }
    .recommendation-list { display: grid; gap: 16px; margin-top: 18px; }
    .recommendation { border-left: 2px solid #f45b36; margin: 0; padding: 4px 0 4px 18px; }
    .recommendation-comment { color: #1c1b1a; font-size: 15px; line-height: 1.65; margin: 0 0 10px; }
    .recommendation footer { align-items: baseline; display: flex; flex-wrap: wrap; gap: 10px; }
    .recommendation footer a { color: #1c1b1a; font-size: 13px; font-weight: 700; text-decoration: none; }
    .recommendation footer a:hover { color: #f45b36; }
    .recommendation footer span { color: #716f6a; font-size: 12px; }
    .experience-projects { display: grid; gap: 18px; margin-top: 28px; }
    .experience-project { border-left: 2px solid #f45b36; padding: 4px 0 4px 20px; }
    .experience-project summary { cursor: pointer; list-style: none; padding-right: 28px; position: relative; }
    .experience-project summary::-webkit-details-marker { display: none; }
    .experience-project-label { color: #f45b36; display: block; font-size: 11px; font-weight: 700; letter-spacing: .12em; margin: 0 0 8px; text-transform: uppercase; }
    .experience-project-title { display: block; font-family: 'Space Grotesk', sans-serif; font-size: 24px; letter-spacing: -.04em; }
    .experience-project-toggle { color: #f45b36; font-size: 22px; font-weight: 400; position: absolute; right: 0; top: 14px; }
    .experience-project[open] .experience-project-toggle { transform: rotate(45deg); }
    .experience-project ul { display: grid; gap: 8px; margin: 18px 0 0; padding-left: 18px; }
    .experience-project li { color: #1c1b1a; font-size: 15px; line-height: 1.6; padding-left: 4px; }
    .experience-metric { color: #1c1b1a; font-weight: 800; }
    .experience-project:hover .experience-metric { color: #f45b36; }
    .experience-load-error { color: #b3261e; margin-top: 28px; }
    .education-load-error { color: #b3261e; margin-top: 28px; }
    .story-label { color: #f45b36; font-size: 11px; font-weight: 700; letter-spacing: .12em; margin: 0 0 18px; text-transform: uppercase; }
    .story-copy { color: #1c1b1a; font-size: clamp(16px, 1.35vw, 20px); line-height: 1.7; margin: 0; max-width: 820px; }
    .compact-profile { display: grid; gap: 7px; margin: 0 0 34px auto; max-width: 650px; text-align: center; }
    .compact-profile p { color: #716f6a; display: grid; font-size: 13px; grid-template-columns: 1fr auto; line-height: 1.55; margin: 0; text-align: right; }
    .compact-profile strong { color: #f45b36; font-size: 11px; letter-spacing: .1em; margin-left: 8px; text-transform: uppercase; }
    .education-list { display: grid; gap: 20px; margin-top: 24px; }
    .education-item { border: 1px solid #d8d3ca; padding: 24px 26px; transition: background-color .2s ease, border-color .2s ease, box-shadow .2s ease; }
    .education-item:hover { background: #fffaf7; border-color: #f45b36; box-shadow: 0 16px 34px rgba(244, 91, 54, 0.1); }
    .education-period { color: #f45b36; display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: .08em; margin-bottom: 10px; text-transform: uppercase; }
    .education-item h2 { font-family: 'Space Grotesk', sans-serif; font-size: 26px; letter-spacing: -.04em; margin: 0 0 10px; }
    .education-item p { color: #716f6a; font-size: 15px; line-height: 1.6; margin: 0; }
    .education-metric { color: #1c1b1a; font-weight: 800; }
    .education-item:hover .education-metric { color: #f45b36; }
    .education-achievements { border-left: 2px solid #f45b36; margin-top: 24px; padding-left: 16px; }
    .education-achievements-label { color: #f45b36 !important; font-size: 11px !important; font-weight: 700; letter-spacing: .12em; margin-bottom: 8px !important; text-transform: uppercase; }
    .education-achievements ul { display: grid; gap: 8px; margin: 0; padding-left: 18px; }
    .education-achievements li { color: #1c1b1a; font-size: 15px; line-height: 1.6; padding-left: 4px; }
    .next-block { border-top: 1px solid #d8d3ca; margin-top: 70px; padding-top: 28px; }
    .next-copy { color: #1c1b1a; font-size: clamp(16px, 1.35vw, 20px); line-height: 1.7; margin: 0 0 0 32px; max-width: 900px; }
    .next-links { display: flex; flex-wrap: wrap; gap: 24px; margin: 24px 0 0 32px; }
    .next-links a { color: #f45b36; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-decoration: none; text-transform: uppercase; }
    .next-links a:hover { color: #1c1b1a; }
    .grades-table-wrap { margin-top: 18px; overflow-x: auto; }
    .grades-table {
      background: linear-gradient(180deg, #fffaf7 0%, #fff 100%);
      border: 1px solid #e7dfd7;
      border-collapse: separate;
      border-spacing: 0;
      box-shadow: 0 14px 34px rgba(28, 27, 26, 0.04);
      min-width: 560px;
      width: 100%;
    }
    .grades-table th, .grades-table td {
      border: 1px solid #e7dfd7;
      padding: 14px 16px;
      text-align: center;
      white-space: nowrap;
    }
    .grades-table .semesters th {
      background: #f5f0eb;
      color: #1c1b1a;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .grades-table .values td {
      color: #f45b36;
      font-size: 15px;
      font-weight: 700;
    }
    .dummy-grid { border-top: 1px solid #d8d3ca; display: grid; grid-template-columns: repeat(2, 1fr); margin: 85px 0 45px; }
    .dummy-card { border-bottom: 1px solid #d8d3ca; min-height: 210px; padding: 28px 35px 28px 0; }
    .dummy-card:nth-child(odd) { border-right: 1px solid #d8d3ca; padding-right: 40px; }
    .dummy-card:nth-child(even) { padding-left: 40px; }
    .button { align-items: center; display: inline-flex; font-size: 13px; font-weight: 700; gap: 28px; padding: 16px 20px; }
    .button-dark { background: #1c1b1a; color: #fff; }
    .dummy-card h2 { font-family: 'Space Grotesk', sans-serif; font-size: 27px; letter-spacing: -.04em; margin: 35px 0 12px; }
    .dummy-card p { color: #716f6a; font-size: 14px; line-height: 1.6; max-width: 400px; }
    @media (max-width: 800px) {
      .dummy-page { margin: 0 20px; padding: 75px 0 90px; }
      .profile-photo-wrap { margin: 28px 0 0; }
      .profile-overlay, .biography-overlay { left: 14px; min-height: 0; padding: 16px; right: 14px; width: auto; }
      .profile-overlay { bottom: 14px; top: auto; }
      .dummy-grid { grid-template-columns: 1fr; margin-top: 60px; }
      .dummy-card:nth-child(odd), .dummy-card:nth-child(even) { border-right: 0; padding-left: 0; padding-right: 0; }
      .experience-qualitative-header { display: block; }
      .experience-reload-button { margin-top: 16px; }
    }
    .dummy-card-button { background: transparent; border: 0; color: inherit; cursor: pointer; font: inherit; padding: 0; text-align: left; }
    .dummy-card-button:hover { color: #f45b36; }
    .phone-dialog-backdrop { align-items: center; background: #1c1b1acc; display: flex; inset: 0; justify-content: center; padding: 20px; position: fixed; z-index: 20; }
    .phone-dialog { background: #f7f5f0; box-shadow: 0 20px 70px #0006; max-width: 510px; padding: 42px; position: relative; width: 100%; }
    .phone-dialog h2 { font-family: 'Space Grotesk', sans-serif; font-size: 48px; letter-spacing: -.06em; line-height: .95; margin: 0 0 22px; }
    .phone-dialog h2 em { color: #f45b36; font-style: normal; }
    .phone-dialog-close { background: transparent; border: 0; color: #1c1b1a; cursor: pointer; font-size: 28px; position: absolute; right: 18px; top: 14px; }
    .phone-dialog-copy { color: #716f6a; font-size: 14px; line-height: 1.55; }
    .phone-dialog form { display: grid; gap: 16px; margin-top: 24px; }
    .phone-dialog label { color: #1c1b1a; display: grid; font-size: 12px; font-weight: 700; gap: 7px; }
    .phone-dialog input, .phone-dialog textarea { background: #fff; border: 1px solid #b9b3aa; color: #1c1b1a; font: inherit; font-size: 13px; padding: 11px; resize: vertical; }
    .phone-dialog input:focus, .phone-dialog textarea:focus { border-color: #f45b36; outline: 0; }
    .phone-error { color: #bd3c23; font-size: 12px; margin: 0; }
    .revealed-phone { font-family: 'Space Grotesk', sans-serif; font-size: 32px; margin: 30px 0; }
    .revealed-phone a { color: #f45b36; }
    @media (max-width: 800px) { .phone-dialog { padding: 32px 24px; } .phone-dialog h2 { font-size: 40px; } }
  `]
})
export class DummyPageComponent {
  private readonly phoneRequestStorageKey = 'aditya-portfolio-phone-requests';
  protected readonly content: PageContent;
  protected pageCards: PageContent['cards'] = [];
  protected links: PageContent['cards'] = [];
  protected profile: ProfileManifest | null = null;
  protected experience: ExperienceEntry[] = [];
  protected experienceLoadError = '';
  protected linksLoadError = '';
  protected education: EducationEntry[] = [];
  protected educationLoadError = '';
  protected vignetteStrength = 0.08;
  protected overlayOpacity = 1;
  protected toolkitOpacity = 1;
  protected phoneDialogOpen = false;
  protected phoneRevealed = false;
  protected phonePurpose = '';
  protected callbackNumber = '';
  protected phoneError = '';

  constructor(route: ActivatedRoute) {
    this.content = route.snapshot.data['content'] as PageContent;
    this.pageCards = this.content.cards;
    this.links = this.content.cards;
    if (this.content.cardsSource) {
      void this.loadCards(this.content.cardsSource);
    }
    if (this.content.linksSource) {
      void this.loadLinks(this.content.linksSource);
    }
    if (this.content.profileSource) {
      void this.loadProfile(this.content.profileSource);
    }
    if (this.content.experienceSource) {
      void this.loadExperience(this.content.experienceSource);
    }

    if (this.content.educationSource) {
      void this.loadEducation(this.content.educationSource);
    }
  }

  private async loadLinks(source: string): Promise<void> {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        this.linksLoadError = 'Links could not be loaded right now.';
        return;
      }

      const manifest = await response.json() as LinksManifest;
      this.links = manifest.links;
    } catch {
      this.linksLoadError = 'Links could not be loaded right now.';
    }
  }

  private async loadCards(source: string): Promise<void> {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        return;
      }

      const manifest = await response.json() as CardsManifest;
      this.pageCards = manifest.cards;
    } catch {
      // Keep the route's configured cards when the optional manifest is unavailable.
    }
  }

  private async loadProfile(source: string): Promise<void> {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        return;
      }

      this.profile = await response.json() as ProfileManifest;
    } catch {
      this.profile = null;
    }
  }

  private async loadExperience(source: string): Promise<void> {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        this.experienceLoadError = 'Experience details could not be loaded right now.';
        return;
      }

      const manifest = await response.json() as ExperienceManifest;
      this.experience = manifest.experience;
    } catch {
      this.experienceLoadError = 'Experience details could not be loaded right now.';
    }
  }

  private async loadEducation(source: string): Promise<void> {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        this.educationLoadError = 'Education details could not be loaded right now.';
        return;
      }

      const manifest = await response.json() as EducationManifest;
      this.education = manifest.education;
    } catch {
      this.educationLoadError = 'Education details could not be loaded right now.';
    }
  }

  @HostListener('window:scroll')
  protected updateVignette(): void {
    const delayedScroll = Math.max(window.scrollY - 180, 0);
    const scrollProgress = Math.min(delayedScroll / 900, 1);
    this.vignetteStrength = 0.08 + (scrollProgress * 0.42);
    this.overlayOpacity = Math.max(0, 1 - (scrollProgress * 1.25));
    const toolkitProgress = Math.min(delayedScroll / 3000, 1);
    this.toolkitOpacity = Math.max(0, 1 - toolkitProgress);
  }

  protected openPhoneDialog(): void {
    this.phoneDialogOpen = true;
    this.phoneError = '';
  }

  protected closePhoneDialog(): void {
    this.phoneDialogOpen = false;
  }

  protected submitPhoneRequest(): void {
    if (!this.phonePurpose.trim() || !this.callbackNumber.trim()) {
      this.phoneError = 'Please provide both your purpose and phone number.';
      return;
    }

    const request = {
      purpose: this.phonePurpose.trim(),
      callbackNumber: this.callbackNumber.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      const existingRequests = JSON.parse(
        localStorage.getItem(this.phoneRequestStorageKey) ?? '[]'
      ) as unknown;
      const requests = Array.isArray(existingRequests) ? existingRequests : [];
      localStorage.setItem(
        this.phoneRequestStorageKey,
        JSON.stringify([...requests, request])
      );
      this.phoneRevealed = true;
      this.phoneError = '';
    } catch (error: unknown) {
      this.phoneError = error instanceof Error
        ? `The request could not be saved: ${error.message}`
        : 'The request could not be saved in this browser.';
    }
  }
}

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: HomeRouteComponent
  },
  {
    path: 'home',
    redirectTo: '/',
    pathMatch: 'full'
  },
  {
    path: 'me',
    component: DummyPageComponent,
    data: {
      content: {
        eyebrow: 'A little about me',
        title: 'About',
        accent: 'Aditya.',
        description: 'A Full Stack Developer with 3+ years of experience building scalable backend systems and intuitive frontend experiences.',
        biography: 'I grew up curious about how systems work, how products are shaped, and why some experiences feel effortless while others create friction. That curiosity led me into engineering, where I learned to enjoy both the logic of backend systems and the clarity of thoughtful interfaces. I care about building technology that is useful, reliable, and genuinely improves the way people work and learn. During my time at IIT BHU, I also developed a strong interest in creative expression and leadership, which led me to contribute to the Film and Media Council and the Cine Club through storytelling, cinematography, and community building.',
        profileSource: 'assets/profile/profile.json',
        whereToNext: 'I am learning how human experience grows alongside products, and how businesses can grow sustainably with themselves, society, and the consumers they serve. Currently, I am working in engineering and taking a low-level view of overarching systems: understanding how their foundations, interactions, and constraints shape the experiences built on top of them.',
        nextLinks: [
          { label: 'Read more about my vision', href: '/vision-mission' },
          { label: 'Read my thoughts in detail', href: '/essays' }
        ],
        educationSource: 'assets/education/education.json',
        cards: []
      }
    },
  },
  {
    path: 'about',
    redirectTo: '/me',
    pathMatch: 'full'
  },
  {
    path: 'projects',
    component: ProjectListComponent
  },
  {
    path: 'experience',
    component: DummyPageComponent,
    data: {
      content: {
        eyebrow: 'The journey so far',
        title: 'Experience that',
        accent: 'shaped me.',
        description: 'Professional experience focused on backend engineering, API design, databases, performance, and collaborative product development.',
        experienceSource: 'assets/experience/experience.json',
        cards: []
      }
    }
  },
  {
    path: 'vision-mission',
    component: DummyPageComponent,
    data: {
      content: {
        eyebrow: 'Personal direction',
        title: 'Personal vision and',
        accent: 'mission.',
        description: 'A space for the principles, ambitions, and long-term direction that guide Aditya’s work.',
        cardsSource: 'assets/vision/vision.json',
        cards: []
      }
    }
  },
  {
    path: 'essays',
    component: EssayListComponent
  },
  {
   path: 'essays/:slug',
   component: EssayPageComponent,
  },
  {
    path: 'invest',
    component: InvestContactComponent
  },
  {
    path: 'gallery',
    component: HobbyListComponent
  },
  {
    path: 'links',
    component: DummyPageComponent,
    data: {
      content: {
        eyebrow: 'Find me elsewhere',
        title: 'Useful',
        accent: 'links.',
        description: 'A simple directory for professional profiles, code, writing, and other places to connect with Aditya.',
        reminder: 'It is better to contact me here, as I am likely to respond faster.',
        reminderLink: { label: 'Visit the Invest page', href: '/invest' },
        linksSource: 'assets/links/links.json',
        cards: []
      }
    }
  },
  { path: '**', redirectTo: '/' }
];
