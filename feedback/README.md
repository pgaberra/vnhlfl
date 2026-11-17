# Feedback Worker

The Cloudflare Worker behind the site's **Tyck till** page (`/tyck-till`). A member describes a
bug or suggests a feature, optionally with images or PDFs, and the Worker turns it into an issue
in this repository. The site is static, so this is the one place that holds a GitHub token.

```
form (GitHub Pages) ──POST multipart──▶ Worker ──▶ Turnstile siteverify (is it a person?)
                                              ├──▶ commit files to the feedback-attachments branch
                                              └──▶ open the issue (labels bug|enhancement, from-site)
```

- **Attachments** live on the orphan branch `feedback-attachments` (no site code; the Worker
  creates it on first use), one folder per submission, and the issue embeds or links them. GitHub's
  API cannot attach files to an issue directly.
- **Everything is public.** The form tells members not to write real names and to hide them in
  screenshots, and it re-encodes photos in the browser so their EXIF data (GPS position, camera)
  never leaves the device. Remove an issue that names someone anyway, and delete its files from the
  branch.
- **Abuse:** Turnstile on every submission, an origin check, type sniffing (only PNG, JPEG, GIF,
  WebP and PDF), at most 5 files of 4 MB and 10 MB in total. `@mentions` are defused so a
  submission cannot ping GitHub users.
- **Limits** are in `src/limits.ts`, mirrored by the form in
  `web/src/app/pages/feedback/feedback.ts`. They are low because the Workers free plan allows
  10 ms of CPU per request and every byte is base64-encoded for GitHub. On the paid plan they can
  go up.

## Setting it up (once)

1. **Turnstile.** Cloudflare dashboard → Turnstile → *Add widget*: hostname `pgaberra.github.io`,
   mode *Managed*. Note the site key and the secret key.
2. **GitHub token.** github.com → Settings → Developer settings → *Fine-grained tokens* →
   *Generate*: resource owner `pgaberra`, *Only select repositories* → `vnhlfl`, permissions
   **Issues: Read and write** and **Contents: Read and write**. Set an expiry date and a reminder to
   rotate it. Contents write could also push to `main`, so protect `main` with a ruleset that blocks
   direct pushes from anyone but you.
3. **Label.** `gh label create from-site --repo pgaberra/vnhlfl --description "Sent from the site's feedback form"`.
4. **Deploy.** From `feedback/`:
   ```bash
   npm ci
   npx wrangler login
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler secret put TURNSTILE_SECRET
   npm run deploy
   ```
   Wrangler prints the Worker's URL (`https://vnhlfl-feedback.<account>.workers.dev`).
5. **Point the site at it.** Put that URL and the Turnstile site key in
   `web/src/app/pages/feedback/feedback-config.ts`, commit and push. Until then the page says the
   form is not open yet.

If the site gets a custom domain, add it to `ALLOWED_ORIGINS` in `wrangler.jsonc` and to the
Turnstile widget's hostnames.

## Running it locally

```bash
cp .dev.vars.example .dev.vars   # then fill in GITHUB_TOKEN
npm run dev                      # http://localhost:8787
```

With `npm start` in `web/`, the dev build posts to `localhost:8787` and uses Turnstile's
always-pass test key. The token is real, so a local submission opens a real issue.

```bash
npm test; npm run typecheck; npm run format:check
```
