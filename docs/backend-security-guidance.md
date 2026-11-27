# Backend and hosting security handoff

## What this repository can enforce

The site is deployed as static files through GitHub Pages. GitHub Pages does not let this repository set arbitrary HTTP response headers. The production build uses an explicit script-source allowlist; the early theme bootstrap is a same-origin external file, not an inline script. `src/index.html` adds a meta CSP for resource restrictions and Trusted Types. These help in supporting browsers, but they do not replace response headers: a meta policy cannot set HSTS, COOP, `frame-ancestors`, `X-Frame-Options`, or report-only CSP.

Configure matching CSP headers at the CDN, reverse proxy, or origin serving `https://neonpokharkar.com`. Multiple CSPs intersect, so keep the header's source lists aligned with the meta policy. Configure the API host independently.

## Static-site response headers

Use this as a starting point and verify it against the deployed build and all sign-in flows:

```text
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'; script-src 'self' https://accounts.google.com/gsi/ https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; script-src-attr 'none'; img-src 'self' data: blob: https://*.googleusercontent.com; connect-src 'self' https://simba.vimba-buri.ts.net https://accounts.google.com/gsi/ https://www.google.com https://www.recaptcha.net https://www.gstatic.com/recaptcha/; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style; frame-src https://accounts.google.com/gsi/ https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' blob:; trusted-types angular angular#bundler portfolio-scripts goog#html recaptcha 'allow-duplicates'; require-trusted-types-for 'script'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin-allow-popups
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=(), usb=()
Strict-Transport-Security: max-age=31536000
```

The `script-src` list covers Angular's same-origin bundles plus Google Identity Services and reCAPTCHA. Application code assigns those two external script URLs through the narrowly allowlisted `portfolio-scripts` Trusted Types policy. The `style-src 'unsafe-inline'` allowance is currently needed for Angular's runtime component styles and critical styles; keep it limited to styles. Do not add `unsafe-inline` or `unsafe-eval` to `script-src`. Google Identity Services' CSP guidance recommends the `https://accounts.google.com/gsi/` parent URL for `connect-src` and `frame-src`.

`frame-ancestors` and `X-Frame-Options` are response-header protections and are not effective from `src/index.html`. Keep both in the hosting configuration. `X-Frame-Options: DENY` is a legacy fallback for the equivalent CSP frame restriction.

## Staged CSP deployment

1. Deploy the matching site CSP as `Content-Security-Policy-Report-Only` first, with a reporting endpoint owned by the site operator. Do not accept user-supplied report destinations or log report bodies indefinitely; CSP reports can contain URLs and other browsing metadata.
2. Exercise production routes and integrations: Google sign-in with FedCM enabled and disabled where available, reCAPTCHA, essays, chat, fonts, profile images, and lazy-loaded Angular chunks. Inspect browser CSP reports and console errors.
3. Fix only confirmed required sources, keep origins/path scope narrow, and move the same policy to `Content-Security-Policy`.
4. Verify the generated production index contains the explicit script allowlist and no inline executable scripts. Re-run the production build and browser flow checks after Angular or third-party integration updates.

Trusted Types currently permits Angular's `angular` and `angular#bundler` policies for AOT rendering and lazy chunks, the application's `portfolio-scripts` policy for the Google Identity and reCAPTCHA loader URLs, and Google's `goog#html` and `recaptcha` policies. The reCAPTCHA Enterprise loader uses `trustedtypes=true` to create its own trusted script URL. Google Identity and reCAPTCHA each create `goog#html`, so `'allow-duplicates'` is needed; it permits duplicate creation of any allowlisted policy name, weakening the uniqueness restriction while retaining the name allowlist and sink enforcement. Do not add `angular#unsafe-bypass` or `angular#unsafe-jit` unless the corresponding APIs are intentionally introduced, reviewed, and tested.

## HSTS, COOP, and origin isolation

- Start HSTS with a short `max-age` while confirming every production response is HTTPS. Increase to at least `max-age=31536000` after validation; the header template shows this one-year value without subdomain scope.
- Add `includeSubDomains` only after confirming every subdomain is permanently HTTPS-capable. Add `preload` only after the domain meets the current preload requirements and the operator accepts the difficult-to-reverse browser preload commitment.
- Use `Cross-Origin-Opener-Policy: same-origin-allow-popups` as the initial setting to preserve Google sign-in popup communication. Google Identity Services notes that popup behavior can need COOP adjustments when FedCM is disabled. `same-origin` is stricter but can sever that communication; test it only if the sign-in flow is confirmed compatible.
- COOP alone does not provide full cross-origin isolation. Do not add `Cross-Origin-Embedder-Policy` by default: it can break Google sign-in, reCAPTCHA, fonts, and other cross-origin resources. Introduce it only for a demonstrated feature requirement and after an integration audit.

## API authentication, CORS, and CSRF

The current browser session keeps the bearer token in an in-memory `VerifiedUserService` session and coordinates that session with other same-origin tabs through a separate auth `BroadcastChannel`; API calls send it in the `Authorization` header. The token is not written to a cookie or web storage. `localStorage` contains heartbeat/ingestion coordination metadata, not the bearer token. The chat-window synchronization described below never carries the token. This is not ambient-cookie authentication, so conventional cookie-based CSRF is not the current primary risk; same-origin XSS remains able to act as the user.

For the API host:

- Require and validate the bearer token on every protected endpoint. Do not silently fall back to an authenticated cookie.
- Allow only the production site origin (`https://neonpokharkar.com`, and an explicitly needed `www` origin) in CORS. Return `Vary: Origin`; allow only the required methods and headers (`Authorization`, `Content-Type`, and `X-Ingest-OTP` where needed). Do not combine wildcard origins with credentials.
- Do not enable `Access-Control-Allow-Credentials` unless cookie authentication is intentionally introduced.
- Validate `Origin` on state-changing requests as defense in depth. CORS is not a substitute for authorization or CSRF protection.
- If cookie authentication is added later, use `Secure`, `HttpOnly`, and an appropriate `SameSite` value, retain strict Origin validation, and require a CSRF token for state-changing requests. Revisit OAuth callback and cross-site navigation behavior before selecting `SameSite=Strict`.
- Never put bearer tokens, OTP values, chat prompts, or transcripts in URLs, analytics, access logs, or error messages.

## Chat synchronization privacy

The embedded widget and the expanded `/chat` page exchange only chat messages, the current draft, conversation context, and busy/sign-in-required flags over a per-window `BroadcastChannel`. Its random ID is kept in the URL fragment (not sent in HTTP requests); state is not written to `localStorage` or `sessionStorage`, and the bearer token is not included. Old chat snapshots in `sessionStorage` are cleared on app startup. Closing the page ends its channel connection. A user who edits both composers at once can have the draft replaced by the most recently synchronized state; use one composer at a time.

Keep the channel same-origin and ephemeral. Do not persist or log its payloads, include authentication data in it, or reuse its random ID for unrelated tabs. The backend still receives submitted prompts as part of normal chat requests; apply the API's data-retention, access-control, and log-redaction policies there. Warn users not to submit secrets or other people's sensitive information.

## Verification checklist

- Confirm the deployed site's response headers with `curl -I https://neonpokharkar.com/` and an equivalent check on the API host.
- Confirm HTTPS redirects and HSTS on the apex, `www` (if served), static assets, 404 route, and API responses.
- Use browser developer tools to check enforced CSP/Trusted Types, Google sign-in popup completion, reCAPTCHA, font/image loading, and lazy routes.
- Test that an embedded conversation and draft appear in `/chat`, edits synchronize in both directions, a chat refresh re-requests current in-memory state when the other page remains open, and no transcript or token is written to browser storage.
- Verify API preflight behavior and confirm disallowed origins and missing/invalid bearer tokens are rejected.

## References

- [Angular security best practices](https://angular.dev/best-practices/security)
- [Google Identity Services setup, CSP, and COOP guidance](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [MDN: Content Security Policy](https://developer.mozilla.org/docs/Web/HTTP/CSP)
- [MDN: Strict-Transport-Security](https://developer.mozilla.org/docs/Web/HTTP/Headers/Strict-Transport-Security)
