import { FileType, sniff } from './files';
import { LIMITS } from './limits';

export type Kind = 'bug' | 'feature';

export interface Attachment {
  /** The sender's file name, for display only; the stored file is named by its position. */
  name: string;
  bytes: Uint8Array;
  type: FileType;
}

export interface Submission {
  kind: Kind;
  title: string;
  description: string;
  /** The site path the report is about, e.g. `/sasong/2024-25`. */
  page: string | null;
  attachments: Attachment[];
  turnstileToken: string;
}

/** Error codes the web form turns into Swedish messages. */
export type Rejection =
  | 'invalid-kind'
  | 'invalid-title'
  | 'invalid-description'
  | 'too-many-files'
  | 'file-too-large'
  | 'too-large'
  | 'unsupported-file'
  | 'missing-captcha';

const PAGE = /^\/[\w\-./?=&%]*$/;

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

export async function parseSubmission(form: FormData): Promise<Submission | { error: Rejection }> {
  const kind = text(form, 'kind');
  if (kind !== 'bug' && kind !== 'feature') return { error: 'invalid-kind' };

  const title = text(form, 'title').replace(/\s+/g, ' ');
  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) {
    return { error: 'invalid-title' };
  }

  const description = text(form, 'description').replace(/\r\n/g, '\n');
  if (description.length < LIMITS.descriptionMin || description.length > LIMITS.descriptionMax) {
    return { error: 'invalid-description' };
  }

  const rawPage = text(form, 'page');
  const page = rawPage.length <= LIMITS.pageMax && PAGE.test(rawPage) ? rawPage : null;

  const files = form.getAll('files').filter((f): f is File => typeof f !== 'string' && f.size > 0);
  if (files.length > LIMITS.files) return { error: 'too-many-files' };
  if (files.some((f) => f.size > LIMITS.fileBytes)) return { error: 'file-too-large' };
  if (files.reduce((sum, f) => sum + f.size, 0) > LIMITS.totalBytes) return { error: 'too-large' };

  const attachments: Attachment[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniff(bytes);
    if (!type) return { error: 'unsupported-file' };
    attachments.push({ name: file.name, bytes, type });
  }

  const turnstileToken = text(form, 'cf-turnstile-response');
  if (!turnstileToken) return { error: 'missing-captcha' };

  return { kind, title, description, page, attachments, turnstileToken };
}
