# Neon portfolio

A small Angular landing page for Neon, an independent creative studio.

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:4200` in your browser.

The expanded chat supports dictation in browsers with the Web Speech API. Click the
microphone, allow access, and click it again to stop; dictated text is not sent
until you submit it. Speech recognition may use your browser's online service.
Edit `src/assets/chat/welcome.json` to change the expanded chat's welcome tagline
and suggested questions. Each suggestion has an icon, a visible label, and the
prompt sent to the assistant.

The expanded chat renders assistant responses as Markdown. Raw HTML is shown as
text, and images are shown as their alt text.

Project details load independently of media. Gallery images load lazily, and
animated previews are prepared when their gallery approaches the viewport.

## Build

```bash
npm run build
```

The production build generates `sitemap.xml` and static HTML for the projects
page, essay index, and each essay from the project and essay manifests. Angular
takes over when JavaScript loads. GitHub Pages also receives route entry points
for the other public pages. Update the public route list in
`scripts/generate-static.mjs` when adding or removing routes; new manifest
entries are picked up automatically on the next build. The sitemap and
`robots.txt` use `https://neonpokharkar.com` as the public site URL.
After building, run `npm run test:static` to verify the generated discovery
files and content.
