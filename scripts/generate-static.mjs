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
const essays = essayManifest.essays.map((essay) => {
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
  return essay;
});

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
  const page = renderPage(`<article><p>${escapeHtml(essay.category)}</p><h1>${title}</h1><p>${summary}</p><p>By ${escapeHtml(essay.author)}</p><time datetime="${escapeHtml(essay.publishedAt)}">${escapeHtml(essay.publishedAt)}</time><p>Sign in with Google to read this essay.</p></article>`, metadata)
    .replace(/<title>[^<]*<\/title>/, `<title>${title} | Aditya Pokharkar</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${summary}">`);
  await writeRoute(`essays/${essay.slug}`, page);
}));

const urls = [...publicRoutes.filter((route) => route !== 'chat' && route !== 'shayari'), ...essays.map((essay) => `essays/${essay.slug}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((route) => `  <url><loc>${escapeHtml(`${origin}/${route}${route ? '/' : ''}`)}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(path.join(output, 'sitemap.xml'), sitemap);
// Agent-facing files expose a fixed allowlist of public profile fields only (no phone, WhatsApp, or recommendations).
const [profile, experienceManifest, educationManifest, visionManifest] = await Promise.all(
  ['profile/profile', 'experience/experience', 'education/education', 'vision/vision']
    .map((name) => readSource(`assets/${name}.json`).then(JSON.parse))
);
const agentProfile = {
  name: 'Aditya Pokharkar',
  website: `${origin}/`,
  linkedin: requiredText(profile.linkedin, 'profile linkedin'),
  email: requiredText(profile.email, 'profile email'),
  skillset: profile.toolkit,
  whatIBring: profile.whatIBring.services.map(({ title, description }) => ({ title, description })),
  experience: experienceManifest.experience.map(({ period, firm, role, location, summary }) => ({ period, firm, role, location, summary })),
  education: educationManifest.education.map(({ period, title, detail, metric }) => ({ period, title, institution: detail.replace(/\s*·\s*$/u, ''), result: metric })),
  projects: projectManifest.projects.map(({ title, timeline, tags, explanation, resultsSummary }) => ({ title, timeline, technologies: tags, summary: explanation, outcome: resultsSummary })),
  visionAndMission: visionManifest.cards.map(({ title, description }) => ({ title, description }))
};
const bullets = (items) => items.map((item) => `- ${item}`).join('\n');
const llmsTxt = `# Aditya Pokharkar

> Full Stack & Systems Engineer. Public profile summary for AI agents.

- Portfolio: ${agentProfile.website}
- LinkedIn: ${agentProfile.linkedin}
- Email: ${agentProfile.email}

## Skillset
${agentProfile.skillset.join(', ')}

## What I bring
${bullets(agentProfile.whatIBring.map((item) => `**${item.title}**: ${item.description}`))}

## Experience
${bullets(agentProfile.experience.map((item) => `${item.period}, ${item.role} at ${item.firm} (${item.location}): ${item.summary}`))}

## Education
${bullets(agentProfile.education.map((item) => `${item.period}, ${item.title}, ${item.institution} (${item.result})`))}

## Projects
${bullets(agentProfile.projects.map((item) => `**${item.title}** (${item.timeline}; ${item.technologies}): ${item.summary}`))}

## Vision and mission
${bullets(agentProfile.visionAndMission.map((item) => `**${item.title}**: ${item.description}`))}

## Optional
- [Projects](${origin}/projects/)
- [Essays](${origin}/essays/)
- [Structured profile](${origin}/.well-known/portfolio-profile.json)
`;
const ardManifest = {
  specVersion: '0.91',
  entries: [
    {
      identifier: 'urn:air:neonpokharkar.com:portfolio:llms-txt',
      displayName: 'Aditya Pokharkar - public profile (llms.txt)',
      description: 'Markdown summary of experience, education, skills, projects, vision and mission.',
      type: 'text/markdown',
      url: `${origin}/llms.txt`,
      representativeQueries: ['Who is Aditya Pokharkar?', 'What is Aditya Pokharkar\'s experience and skillset?', 'How can I contact Aditya Pokharkar?']
    },
    {
      identifier: 'urn:air:neonpokharkar.com:portfolio:profile',
      displayName: 'Aditya Pokharkar - structured public profile',
      description: 'JSON profile with experience, education, skillset, projects, vision and mission.',
      type: 'application/json',
      url: `${origin}/.well-known/portfolio-profile.json`,
      representativeQueries: ['Aditya Pokharkar projects and technologies', 'Aditya Pokharkar education background', 'Aditya Pokharkar vision and mission']
    }
  ]
};
await mkdir(path.join(output, '.well-known'), { recursive: true });
await Promise.all([
  writeFile(path.join(output, 'llms.txt'), llmsTxt),
  writeFile(path.join(output, '.well-known', 'portfolio-profile.json'), `${JSON.stringify(agentProfile, null, 2)}\n`),
  writeFile(path.join(output, '.well-known', 'ard.json'), `${JSON.stringify(ardManifest, null, 2)}\n`),
  writeFile(path.join(output, 'ard.json'), `${JSON.stringify(ardManifest, null, 2)}\n`)
]);
console.log(`Generated ${essays.length} essay pages, project and essay indexes, ${urls.length} sitemap URLs, llms.txt and ARD manifest.`);
// MARKER: STATIC_DISCOVERY_END
