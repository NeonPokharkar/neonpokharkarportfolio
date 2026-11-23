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

## Build

```bash
npm run build
```
