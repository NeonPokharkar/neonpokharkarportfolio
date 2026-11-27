// MARKER: STATIC_DISCOVERY_START - Generate crawlable pages and sitemap for GitHub Pages
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist', 'neon-portfolio', 'browser');
const origin = 'https://neonpokharkar.com';
const publicRoutes = ['', 'me', 'vision-mission', 'experience', 'essays', 'projects', 'gallery', 'shayari', 'invest', 'links', 'chat'];

const readSource = (file) => readFile(path.join(root, 'src', ...file.split('/')), 'utf8');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const requiredText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing ${label}`);
  }
  return value;
};

const [shell, essayManifest, projectManifest] = await Promise.all([
  readFile(path.join(output, 'index.html'), 'utf8'),
  readSource('assets/essays/essays.json').then(JSON.parse),
  readSource('assets/projects/projects.json').then(JSON.parse)
]);

if (!Array.isArray(essayManifest.essays) || !Array.isArray(projectManifest.projects)) {
  throw new Error('Essay and project manifests must contain arrays.');
}

const navigation = '<nav aria-label="Main navigation"><a href="/">Home</a> <a href="/projects">Projects</a> <a href="/essays">Essays</a></nav>';
const staticStyle = `<style>
  .static-page { max-width: 820px; margin: 0 auto; padding: 3rem 1.5rem; line-height: 1.7; }
  .static-page nav { display: flex; gap: 1.5rem; margin-bottom: 3rem; }
  .static-page article { margin: 2rem 0; }
  .static-page h1, .static-page h2, .static-page h3 { line-height: 1.2; }
  .static-page a { color: #b83b1c; }
</style>`;

function renderPage(content, metadata = '') {
  if (!shell.includes('<app-root></app-root>') || !shell.includes('</head>')) {
    throw new Error('Angular output is missing the expected app root or head.');
  }
  return shell
    .replace('</head>', `${staticStyle}${metadata}</head>`)
    .replace('<app-root></app-root>', `<app-root><main class="static-page">${navigation}${content}</main></app-root>`);
}

async function writeRoute(route, html) {
  const directory = path.join(output, ...route.split('/'));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), html);
}

const essayPaths = new Set();
const essays = await Promise.all(essayManifest.essays.map(async (essay) => {
  const slug = requiredText(essay.slug, 'essay slug');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || essayPaths.has(slug)) {
    throw new Error(`Invalid or duplicate essay slug: ${slug}`);
  }
  essayPaths.add(slug);
  const file = requiredText(essay.file, `file for ${slug}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/.test(file)) {
    throw new Error(`Invalid essay file: ${file}`);
  }
  for (const field of ['title', 'summary', 'category', 'author', 'publishedAt']) {
    requiredText(essay[field], `${field} for ${slug}`);
  }
  return { ...essay, body: await readSource(`assets/essays/${file}`) };
}));

const essayList = `<h1>Blog and thought essays.</h1>${essays.map((essay) =>
  `<article><p>${escapeHtml(essay.category)}</p><h2><a href="/essays/${essay.slug}">${escapeHtml(essay.title)}</a></h2><p>By ${escapeHtml(essay.author)}</p><p>${escapeHtml(essay.summary)}</p></article>`
).join('')}`;

const projectList = `<h1>Projects built along the way.</h1>${projectManifest.projects.map((project) => {
  for (const field of ['title', 'timeline', 'explanation', 'thoughtProcess', 'resultsSummary']) {
    requiredText(project[field], `project ${field}`);
  }
  const architecture = project.architectureDetails
    ? `<section><h3>Architecture</h3><p>${escapeHtml(project.architectureDetails.approach)}</p>${project.architectureDetails.highlights.map((item) => `<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p>`).join('')}</section>`
    : '';
  return `<article><p>${escapeHtml(project.timeline)}</p><h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.explanation)}</p><p>${escapeHtml(project.thoughtProcess)}</p><p>${escapeHtml(project.resultsSummary)}</p>${architecture}</article>`;
}).join('')}`;

await Promise.all(publicRoutes.filter(Boolean).map((route) =>
  writeRoute(route, route === 'projects' ? renderPage(projectList) : route === 'essays' ? renderPage(essayList) :
    route === 'shayari' ? shell.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>') : shell)
));

await Promise.all(essays.map(async (essay) => {
  const title = escapeHtml(essay.title);
  const summary = escapeHtml(essay.summary);
  const canonical = `${origin}/essays/${essay.slug}/`;
  const metadata = `<link rel="canonical" href="${canonical}"><meta name="author" content="${escapeHtml(essay.author)}"><meta property="article:published_time" content="${escapeHtml(essay.publishedAt)}">`;
  const page = renderPage(`<article><p>${escapeHtml(essay.category)}</p><h1>${title}</h1><p>${summary}</p><p>By ${escapeHtml(essay.author)}</p><time datetime="${escapeHtml(essay.publishedAt)}">${escapeHtml(essay.publishedAt)}</time><div>${essay.body}</div></article>`, metadata)
    .replace(/<title>[^<]*<\/title>/, `<title>${title} | Aditya Pokharkar</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${summary}">`);
  await writeRoute(`essays/${essay.slug}`, page);
}));

const urls = [...publicRoutes.filter((route) => route !== 'chat' && route !== 'shayari'), ...essays.map((essay) => `essays/${essay.slug}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((route) => `  <url><loc>${escapeHtml(`${origin}/${route}${route ? '/' : ''}`)}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(path.join(output, 'sitemap.xml'), sitemap);
console.log(`Generated ${essays.length} essay pages, project and essay indexes, and ${urls.length} sitemap URLs.`);
// MARKER: STATIC_DISCOVERY_END
