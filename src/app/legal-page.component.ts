import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

interface LegalDocument {
  title: string;
  accent: string;
  eyebrow: string;
  description: string;
  lastUpdated: string;
  sections: LegalSection[];
}

type LegalDocumentKey = 'privacy' | 'terms';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  template: `
    @if (loadError) {
      <main class="legal-page">
        <p class="legal-error" role="alert">{{ loadError }}</p>
      </main>
    } @else {
      @if (legalDocument; as document) {
        <main class="legal-page">
          <p class="eyebrow"><span class="eyebrow-line"></span> {{ document.eyebrow }}</p>
          <h1>{{ document.title }} <em>{{ document.accent }}</em></h1>
          <p class="legal-intro">{{ document.description }}</p>
          <p class="legal-updated">Last updated {{ document.lastUpdated }}</p>
          <div class="legal-sections">
            @for (section of document.sections; track section.heading) {
              <section>
                  <h2>{{ section.heading }}</h2>
                  @for (paragraph of section.paragraphs; track $index) {
                    <p>{{ paragraph }}</p>
                  }
                  @if (section.bullets?.length) {
                    <ul>
                      @for (bullet of section.bullets; track $index) {
                        <li>{{ bullet }}</li>
                      }
                    </ul>
                  }
              </section>
            }
          </div>
          <div class="legal-contact">
            <span>Questions about this document?</span>
            <a href="mailto:theadityapokharkar&#64;gmail.com">theadityapokharkar&#64;gmail.com</a>
          </div>
        </main>
      } @else {
        <main class="legal-page" aria-live="polite">
          <p>Loading this document…</p>
        </main>
      }
    }
  `,
  styles: [`
    .legal-page { margin: 0 auto; max-width: 900px; min-height: calc(100vh - 150px); padding: 100px 28px 120px; }
    .legal-page h1 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(52px, 8vw, 88px); letter-spacing: -.07em; line-height: .96; margin: 0 0 28px; }
    .legal-page h1 em { color: #f45b36; font-style: normal; }
    .legal-intro { color: #716f6a; font-size: 18px; line-height: 1.7; margin: 0; max-width: 680px; }
    .legal-updated { color: #716f6a; font-size: 12px; letter-spacing: .06em; margin: 24px 0 0; text-transform: uppercase; }
    .legal-sections { border-top: 1px solid #d8d3ca; display: grid; gap: 34px; margin-top: 42px; padding-top: 12px; }
    .legal-sections section { max-width: 760px; }
    .legal-sections h2 { font-family: 'Space Grotesk', sans-serif; font-size: 22px; letter-spacing: -.035em; margin: 12px 0; }
    .legal-sections p, .legal-sections li { color: #514e49; font-size: 15px; line-height: 1.8; }
    .legal-sections p { margin: 0 0 12px; }
    .legal-sections ul { display: grid; gap: 10px; margin: 12px 0 0; padding-left: 22px; }
    .legal-contact { border-top: 1px solid #d8d3ca; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 55px; padding-top: 20px; }
    .legal-contact a { color: #f45b36; text-decoration: underline; }
    .legal-error { color: #b3261e; }
    :host-context(html[data-theme='night']) .legal-intro,
    :host-context(html[data-theme='night']) .legal-updated { color: #bdb7ad; }
    :host-context(html[data-theme='night']) .legal-sections p,
    :host-context(html[data-theme='night']) .legal-sections li { color: #d3cec5; }
    :host-context(html[data-theme='night']) .legal-sections,
    :host-context(html[data-theme='night']) .legal-contact { border-color: #514c46; }
    @media (max-width: 800px) {
      .legal-page { padding: 75px 20px 90px; }
      .legal-sections h2 { font-size: 20px; }
    }
  `]
})
export class LegalPageComponent implements OnDestroy {
  protected legalDocument: LegalDocument | null = null;
  protected loadError = '';
  private readonly documentKey: LegalDocumentKey;
  private readonly previousTitle: string;
  private readonly previousDescription: string | null;

  constructor(
    route: ActivatedRoute,
    private readonly meta: Meta,
    private readonly title: Title
  ) {
    const key = route.snapshot.data['legalDocument'];
    if (key !== 'privacy' && key !== 'terms') {
      throw new Error('The legal document route is not configured correctly.');
    }
    this.documentKey = key;
    this.previousTitle = this.title.getTitle();
    this.previousDescription = this.meta.getTag('name="description"')?.content ?? null;
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    void this.loadDocument();
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="robots"');
    if (this.previousDescription) {
      this.meta.updateTag({ name: 'description', content: this.previousDescription });
    } else {
      this.meta.removeTag('name="description"');
    }
    this.title.setTitle(this.previousTitle);
  }

  private async loadDocument(): Promise<void> {
    try {
      const response = await fetch('/assets/legal/legal-documents.json');
      if (!response.ok) {
        throw new Error(`Could not load the legal documents (HTTP ${response.status}).`);
      }
      const documents = await response.json() as Record<LegalDocumentKey, LegalDocument>;
      const document = documents[this.documentKey];
      if (!document || !Array.isArray(document.sections)) {
        throw new Error(`The ${this.documentKey} document is missing or invalid.`);
      }
      this.legalDocument = document;
      this.meta.updateTag({ name: 'description', content: document.description });
      this.title.setTitle(`${document.title} ${document.accent} | Aditya Pokharkar`);
    } catch (error: unknown) {
      console.error('Could not load the legal document.', error);
      this.loadError = 'This document is unavailable right now. Please try again later.';
    }
  }
}
