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

Shayari entries are fetched from `GET /shayari` on the origin of
`intelliChatEndpoint` in `src/assets/profile/profile.json`, requesting dates
from `0001-01-01` through `9999-12-31`. The request uses the bearer token returned
by Google verification. The API must allow requests from this site via CORS,
including the `Authorization` header. The page chooses card colors, widths and
font sizes from the collection and sizes each card to its text. Entries appear
newest first, retaining the API's order for matching dates.
The Shayari page and the old JSON path are disallowed in `robots.txt`; the page also
uses `noindex, nofollow` and is excluded from the sitemap. These directives are
not access controls, and a crawler blocked by robots.txt cannot read noindex.
Before any entries are fetched, the visitor signs in with Google and the page
runs reCAPTCHA Enterprise. It sends
`POST /auth/google/verify` to the origin of `intelliChatEndpoint` in
`src/assets/profile/profile.json`, with JSON
`{ "id_token": "...", "recaptcha_token": "...", "recaptcha_action": "login" }`.
The backend must validate both tokens, allow requests from this site via CORS,
and return `verified: true`, the user profile, `access_token`, `token_type:
"Bearer"`, and `expires_in` only after successful verification. The site origin
must also be authorized for the Google OAuth client. The backend logs the user;
the site does not modify the visitor's Google profile. The profile and bearer token are shared
in memory between open same-origin tabs; they are not stored persistently.
`POST /auth/heartbeat` runs after sign-in and every 30 minutes while there has
been interaction in any tab during the preceding 30 minutes. Tabs coordinate
to avoid duplicate renewals; a lost response can still cause a retry. A 401
clears the session in every tab.
The browser must support BroadcastChannel, Web Locks and local storage for
cross-tab coordination. Only heartbeat timing and session identifiers are
stored in local storage, along with Shayari OTP failure and lockout metadata;
bearer tokens, profiles, drafts and OTPs are not stored there. If coordination or a
renewal fails, the page displays a warning. After signing in, the five newest
entries are initially displayed; the rest can be shown without signing in again.
The verification response may include a top-level boolean `is_admin`. Only an
explicit `true` shows the Add Shayari form; the flag is shared with the
in-memory session across tabs. Submitting the form requests an emailed code via
`POST /ingest/shayari/otp`; the six-digit code is sent in `X-Ingest-OTP` with a
bearer-authenticated `POST /ingest/shayari` for a single new entry. The API
must allow this header via CORS. Resending is subject to a 30-second cooldown,
and codes expire according to the response. Requesting a code in another
coordinated tab invalidates the previously displayed code locally as a
precaution. The backend verifies the code and
must enforce admin access; the frontend's visibility check is not authorization.
Ingest 401 responses are ambiguous between OTP and session failures, so each
counts toward a three-failure session limit; an OTP-request 401 clears the
session. The failure count and session-level block are coordinated across
supported same-origin tabs. A server 423 disables ingestion immediately; the
server's lock persists across sessions and requires its documented local reset.
Because an OTP can be consumed before a failed or interrupted ingestion, a new
code is required after an uncertain result. The list is refreshed and the user
is warned to check it before retrying, since a lost response could otherwise
lead to a duplicate. Drafts are not persisted.

Individual essay pages use the same verification prompt and shared session; the
essay listing remains open. Essays are still publicly served in static HTML and
assets and indexed by search engines, so the prompt is not an access control.
Prompt text is configured by context in `src/assets/verification/prompts.json`.
To use it on another page, add a context there, include
`VerificationDialogComponent`, and gate that page's content on
`VerifiedUserService.ready()` and `user()`. Adding JSON alone does not enable a
prompt on a route.

On desktop, hovering over portfolio content briefly opens contextual questions.
Select one to open the chat and send it; press Escape, right-click, or click outside to close. Alt+Q also opens
the questions for the content under the pointer. Double right-click while the
menu is open to pause automatic hover questions for this tab, including after a
reload. Press Alt+Q over content to resume. Edit `src/assets/context-questions.json` to add or change
question templates. Each of `project`, `experience`, `essay`, `education`,
`vision`, `gallery`, `links`, `invest`, `home`, and `general` has a `generic`
array and a `specific` object. The generic array needs at least five distinct
non-empty questions. Specific lists can be any length, including empty. For example:

```json
"essay": {
  "generic": [
    "Summarize {topic}.",
    "What is the main idea behind {topic}?",
    "What inspired {topic}?",
    "What are the key takeaways from {topic}?",
    "How can the ideas in {topic} be applied?"
  ],
  "specific": {
    "designing-for-clarity": ["How does empathy help make technical products clearer?"]
  }
}
```

Use the exact project title, essay slug, experience firm, or education title from
its content manifest as the specific key. These keys work on both cards and
detail pages. Vision cards, gallery entries, and link cards use their titles;
the Invest page uses `overview`. Home sections use their HTML `id` (or `hero`
for the hero), and home service cards use their titles. Project, experience,
and education cards on the home page use their respective categories. For other
general content, use the section's HTML `id` if it has one; otherwise use its
displayed heading text. Keys are case-sensitive. `{topic}` is replaced with the
content heading. Each
opening randomly selects up to five distinct specific questions first, then
fills any remaining slots from that category's generic questions; the selected
questions are also displayed in random order. Content without a matching list
uses the generic questions.

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
