import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sniff, toBase64 } from '../src/files';
import worker, { Env } from '../src/index';
import { issueBody } from '../src/issue';
import { parseSubmission } from '../src/submission';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PDF = new TextEncoder().encode('%PDF-1.7 hello');

const env: Env = {
  GITHUB_TOKEN: 'test-token',
  TURNSTILE_SECRET: 'test-secret',
  GITHUB_REPO: 'owner/repo',
  ATTACHMENT_BRANCH: 'feedback-attachments',
  ALLOWED_ORIGINS: 'https://site.test, http://localhost:4200',
};

function formOf(fields: Record<string, string>, files: File[] = []): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const f of files) form.append('files', f);
  return form;
}

const valid = {
  kind: 'bug',
  title: 'Fel poäng vecka 3',
  description: 'Poängen för vecka 3 stämmer inte med Yahoo.',
  page: '/sasong/2024-25',
  'cf-turnstile-response': 'token',
};

const post = (form: FormData, origin = 'https://site.test') =>
  worker.fetch(
    new Request('https://worker.test/', { method: 'POST', body: form, headers: { origin } }),
    env,
  );

describe('sniff', () => {
  it('reads the type from the bytes, not the name', () => {
    expect(sniff(PNG)).toEqual({ ext: 'png', image: true });
    expect(sniff(PDF)).toEqual({ ext: 'pdf', image: false });
    expect(sniff(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
  });

  it('base64-encodes files larger than one chunk', () => {
    const bytes = new Uint8Array(0x8000 * 2 + 5).map((_, i) => i % 256);
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});

describe('parseSubmission', () => {
  it('accepts a complete bug report', async () => {
    const result = await parseSubmission(formOf(valid, [new File([PNG], 'skärm.png')]));
    expect(result).toMatchObject({
      kind: 'bug',
      title: 'Fel poäng vecka 3',
      page: '/sasong/2024-25',
      attachments: [{ name: 'skärm.png', type: { ext: 'png' } }],
    });
  });

  it('rejects what the form would never send', async () => {
    expect(await parseSubmission(formOf({ ...valid, kind: 'spam' }))).toEqual({
      error: 'invalid-kind',
    });
    expect(await parseSubmission(formOf({ ...valid, title: 'x' }))).toEqual({
      error: 'invalid-title',
    });
    expect(await parseSubmission(formOf({ ...valid, 'cf-turnstile-response': '' }))).toEqual({
      error: 'missing-captcha',
    });
    const svg = new File(['<svg/>'], 'x.png', { type: 'image/png' });
    expect(await parseSubmission(formOf(valid, [svg]))).toEqual({ error: 'unsupported-file' });
    const many = Array.from({ length: 6 }, (_, i) => new File([PNG], `${i}.png`));
    expect(await parseSubmission(formOf(valid, many))).toEqual({ error: 'too-many-files' });
  });

  it('drops a page that is not a site path', async () => {
    const result = await parseSubmission(formOf({ ...valid, page: 'javascript:alert(1)' }));
    expect(result).toMatchObject({ page: null });
  });
});

describe('issueBody', () => {
  it('quiets mentions and embeds images', () => {
    const body = issueBody({
      description: 'Fråga @someone om det',
      page: '/trades',
      files: [
        { name: 'bild [1].png', image: true, url: 'https://raw.test/1.png' },
        { name: 'design.pdf', image: false, url: 'https://blob.test/2.pdf' },
      ],
    });
    expect(body).toContain('@​someone');
    expect(body).toContain('**Page:** `/trades`');
    expect(body).toContain('![bild 1.png](https://raw.test/1.png)');
    expect(body).toContain('[design.pdf](https://blob.test/2.pdf)');
  });
});

describe('worker', () => {
  let calls: { url: string; method: string; body: unknown }[];

  beforeEach(() => {
    calls = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      calls.push({ url, method: init.method ?? 'GET', body });
      if (url.includes('turnstile')) return Response.json({ success: true });
      if (url.endsWith('/git/ref/heads/feedback-attachments')) {
        return Response.json({ message: 'Not Found' }, { status: 404 });
      }
      if (url.endsWith('/issues')) {
        return Response.json({ number: 7, html_url: 'https://github.com/owner/repo/issues/7' });
      }
      return Response.json({ sha: 'abc' });
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('commits attachments to their branch and opens a labelled issue', async () => {
    const res = await post(formOf(valid, [new File([PNG], 'a.png'), new File([PDF], 'b.pdf')]));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ number: 7, url: 'https://github.com/owner/repo/issues/7' });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://site.test');

    const github = calls.filter((c) => c.url.startsWith('https://api.github.com'));
    expect(github.map((c) => `${c.method} ${c.url.replace(/.*\/repos\/owner\/repo/, '')}`)).toEqual(
      [
        'GET /git/ref/heads/feedback-attachments',
        'POST /git/trees',
        'POST /git/commits',
        'POST /git/refs',
        expect.stringMatching(/^PUT \/contents\/\d{4}-\d\d-\d\d-\w{8}\/1\.png$/),
        expect.stringMatching(/^PUT \/contents\/\d{4}-\d\d-\d\d-\w{8}\/2\.pdf$/),
        'POST /issues',
      ],
    );
    expect(github[2].body).toMatchObject({ parents: [] });
    const issue = github.at(-1)!.body as { labels: string[]; body: string };
    expect(issue.labels).toEqual(['bug', 'from-site']);
    expect(issue.body).toMatch(
      /!\[a\.png\]\(https:\/\/raw\.githubusercontent\.com\/owner\/repo\/feedback-attachments\/.+\/1\.png\)/,
    );
  });

  it('opens the issue without touching the branch when nothing is attached', async () => {
    const res = await post(formOf({ ...valid, kind: 'feature' }));
    expect(res.status).toBe(201);
    const github = calls.filter((c) => c.url.startsWith('https://api.github.com'));
    expect(github).toHaveLength(1);
    expect((github[0].body as { labels: string[] }).labels).toEqual(['enhancement', 'from-site']);
  });

  it('refuses other origins and failed captchas', async () => {
    expect((await post(formOf(valid), 'https://evil.test')).status).toBe(403);
    vi.stubGlobal('fetch', async () => Response.json({ success: false }));
    const res = await post(formOf(valid));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'captcha-failed' });
  });

  it('reports a GitHub failure without leaking it', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      url.includes('turnstile')
        ? Response.json({ success: true })
        : new Response('Bad credentials', { status: 401 }),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post(formOf(valid));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'github-failed' });
  });
});
