import { GitHub } from './github';
import { issueBody, issueTitle, LABELS, StoredFile } from './issue';
import { LIMITS } from './limits';
import { parseSubmission, Submission } from './submission';

export interface Env {
  GITHUB_TOKEN: string;
  TURNSTILE_SECRET: string;
  /** `owner/name` of the repository that gets the issues. */
  GITHUB_REPO: string;
  ATTACHMENT_BRANCH: string;
  /** Comma-separated origins the form may post from. */
  ALLOWED_ORIGINS: string;
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  Response.json(body, { status, headers });

async function verifyTurnstile(secret: string, token: string, ip: string | null): Promise<boolean> {
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

/** Commits the attachments to their own branch, then opens the issue that shows them. */
export async function fileIssue(
  submission: Submission,
  env: Env,
  now = new Date(),
): Promise<{ number: number; url: string }> {
  const github = new GitHub(env.GITHUB_TOKEN, env.GITHUB_REPO);
  const branch = env.ATTACHMENT_BRANCH;
  const files: StoredFile[] = [];

  if (submission.attachments.length > 0) {
    await github.ensureBranch(branch);
    const folder = `${now.toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}`;
    // One at a time: parallel commits to the same branch conflict.
    for (const [i, file] of submission.attachments.entries()) {
      const path = `${folder}/${i + 1}.${file.type.ext}`;
      await github.putFile(branch, path, file.bytes, `feedback: ${path}`);
      files.push({
        name: file.name,
        image: file.type.image,
        url: file.type.image
          ? `https://raw.githubusercontent.com/${env.GITHUB_REPO}/${branch}/${path}`
          : `https://github.com/${env.GITHUB_REPO}/blob/${branch}/${path}`,
      });
    }
  }

  const issue = await github.createIssue({
    title: issueTitle(submission.title),
    body: issueBody({ description: submission.description, page: submission.page, files }),
    labels: LABELS[submission.kind],
  });
  return { number: issue.number, url: issue.html_url };
}

export default {
  async fetch(request, env): Promise<Response> {
    const origin = request.headers.get('origin') ?? '';
    const allowed = env.ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .includes(origin);
    const cors: Record<string, string> = allowed
      ? { 'access-control-allow-origin': origin, vary: 'Origin' }
      : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: allowed ? 204 : 403,
        headers: {
          ...cors,
          'access-control-allow-methods': 'POST',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
        },
      });
    }
    if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405, cors);
    if (!allowed) return json({ error: 'forbidden-origin' }, 403, cors);
    if (!env.GITHUB_TOKEN || !env.TURNSTILE_SECRET) {
      console.error('GITHUB_TOKEN or TURNSTILE_SECRET is not set');
      return json({ error: 'not-configured' }, 500, cors);
    }
    // Room for the text fields and multipart framing on top of the files.
    if (Number(request.headers.get('content-length') ?? 0) > LIMITS.totalBytes + 64 * 1024) {
      return json({ error: 'too-large' }, 413, cors);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: 'bad-request' }, 400, cors);
    }
    const submission = await parseSubmission(form);
    if ('error' in submission) return json(submission, 400, cors);

    const ip = request.headers.get('cf-connecting-ip');
    if (!(await verifyTurnstile(env.TURNSTILE_SECRET, submission.turnstileToken, ip))) {
      return json({ error: 'captcha-failed' }, 403, cors);
    }

    try {
      return json(await fileIssue(submission, env), 201, cors);
    } catch (e) {
      console.error(e);
      return json({ error: 'github-failed' }, 502, cors);
    }
  },
} satisfies ExportedHandler<Env>;
