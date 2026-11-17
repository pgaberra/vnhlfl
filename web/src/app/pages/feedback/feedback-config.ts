import { isDevMode } from '@angular/core';

/**
 * Where the form posts (the Cloudflare Worker in `feedback/`) and the Turnstile site key. Both
 * are public. Production values come from deploying the Worker (feedback/README.md); while the
 * endpoint is empty the page says the form is not open yet.
 */
export const FEEDBACK_CONFIG = isDevMode()
  ? // `npm run dev` in feedback/, and Turnstile's always-pass test key.
    { endpoint: 'http://localhost:8787', turnstileSiteKey: '1x00000000000000000000AA' }
  : { endpoint: '', turnstileSiteKey: '' };
