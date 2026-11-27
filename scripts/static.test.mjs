// MARKER: STATIC_DISCOVERY_TESTS - Verify generated URLs and content without JavaScript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist', 'neon-portfolio', 'browser');
const read = (file) => readFile(path.join(root, file), 'utf8');
const built = (file) => readFile(path.join(output, file), 'utf8');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

test('sitemap links to existing public pages and every essay', async () => {
  const [sitemap, robots, manifest] = await Promise.all([
    built('sitemap.xml'), built('robots.txt'),
    read('src/assets/essays/essays.json').then(JSON.parse)
  ]);
  assert.match(robots, /Sitemap: https:\/\/neonpokharkar\.com\/sitemap\.xml/);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(!urls.includes('https://neonpokharkar.com/chat/'));
  assert.ok(urls.includes('https://neonpokharkar.com/projects/'));
  assert.ok(urls.includes('https://neonpokharkar.com/essays/'));
  for (const essay of manifest.essays) {
    assert.ok(urls.includes(`https://neonpokharkar.com/essays/${essay.slug}/`));
  }
  for (const url of urls) {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://neonpokharkar.com');
    assert.ok((await built(path.join(parsed.pathname, 'index.html'))).includes('<app-root>'));
  }
});

test('shayari route is excluded from discovery but remains available', async () => {
  const [robots, sitemap, shayariPage, homePage] = await Promise.all([
    built('robots.txt'), built('sitemap.xml'), built('shayari/index.html'), built('index.html')
  ]);
  assert.match(robots, /^Disallow: \/shayari$/m);
  assert.match(robots, /^Disallow: \/assets\/shayari\/$/m);
  assert.ok(!sitemap.includes('https://neonpokharkar.com/shayari/'));
  assert.match(shayariPage, /<meta name="robots" content="noindex, nofollow">/);
  assert.ok(shayariPage.includes('<app-root>'));
  assert.doesNotMatch(homePage, /<meta name="robots" content="noindex/);
});

test('static essays and project index contain manifest content', async () => {
  const [essays, projects, essayIndex, projectIndex] = await Promise.all([
    read('src/assets/essays/essays.json').then(JSON.parse),
    read('src/assets/projects/projects.json').then(JSON.parse),
    built('essays/index.html'),
    built('projects/index.html')
  ]);
  for (const essay of essays.essays) {
    const page = await built(`essays/${essay.slug}/index.html`);
    const body = await read(`src/assets/essays/${essay.file}`);
    assert.ok(essayIndex.includes(`href="/essays/${essay.slug}"`));
    assert.ok(page.includes(`<h1>${escapeHtml(essay.title)}</h1>`));
    assert.ok(page.includes(body));
    assert.ok(page.includes(`href="https://neonpokharkar.com/essays/${essay.slug}/"`));
    assert.ok(page.includes(`<meta name="description" content="${escapeHtml(essay.summary)}">`));
  }
  for (const project of projects.projects) {
    assert.ok(projectIndex.includes(`<h2>${escapeHtml(project.title)}</h2>`));
    assert.ok(projectIndex.includes(escapeHtml(project.explanation)));
  }
});

test('built contextual question manifest contains usable templates', async () => {
  const [source, output] = await Promise.all([
    read('src/assets/context-questions.json').then(JSON.parse),
    built('assets/context-questions.json').then(JSON.parse)
  ]);
  assert.deepEqual(output, source);
  for (const category of ['project', 'experience', 'essay', 'education', 'vision', 'gallery', 'links', 'invest', 'home', 'general']) {
    const { generic, specific } = output[category];
    assert.ok(Array.isArray(generic), `Missing generic list: ${category}`);
    assert.ok(generic.every((question) => typeof question === 'string' && question.trim()));
    assert.ok(new Set(generic.map((question) => question.trim())).size >= 5);
    assert.ok(specific && typeof specific === 'object' && !Array.isArray(specific));
    for (const [key, questions] of Object.entries(specific)) {
      assert.ok(key.trim());
      assert.ok(Array.isArray(questions));
      assert.ok(questions.every((question) => typeof question === 'string' && question.trim()));
    }
  }
  const [projects, essays, experience, education, vision, hobbies, links, profile, home] = await Promise.all([
    read('src/assets/projects/projects.json').then(JSON.parse),
    read('src/assets/essays/essays.json').then(JSON.parse),
    read('src/assets/experience/experience.json').then(JSON.parse),
    read('src/assets/education/education.json').then(JSON.parse),
    read('src/assets/vision/vision.json').then(JSON.parse),
    read('src/assets/hobbies/hobbies.json').then(JSON.parse),
    read('src/assets/links/links.json').then(JSON.parse),
    read('src/assets/profile/profile.json').then(JSON.parse),
    read('src/app/app.component.html')
  ]);
  for (const key of Object.keys(output.project.specific)) {
    assert.ok(projects.projects.some((project) => project.title === key), `Unknown project: ${key}`);
  }
  for (const key of Object.keys(output.essay.specific)) {
    assert.ok(essays.essays.some((essay) => essay.slug === key), `Unknown essay: ${key}`);
  }
  for (const key of Object.keys(output.experience.specific)) {
    assert.ok(experience.experience.some((entry) => entry.firm === key), `Unknown experience: ${key}`);
  }
  for (const [category, items] of [
    ['education', education.education], ['vision', vision.cards],
    ['gallery', hobbies.hobbies], ['links', links.links]
  ]) {
    for (const key of Object.keys(output[category].specific)) {
      assert.ok(items.some((item) => item.title === key), `Unknown ${category} item: ${key}`);
    }
  }
  for (const key of Object.keys(output.home.specific)) {
    assert.ok(
      home.includes(`id="${key}"`) || home.includes(`data-context-key="${key}"`) ||
      profile.whatIBring.services.some((service) => service.title === key),
      `Unknown home section or service: ${key}`
    );
  }
});
