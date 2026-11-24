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
