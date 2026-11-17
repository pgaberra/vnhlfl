import { Kind } from './submission';

export interface StoredFile {
  name: string;
  image: boolean;
  /** Where GitHub serves the raw file (images) or its page (other files). */
  url: string;
}

export const LABELS: Record<Kind, string[]> = {
  bug: ['bug', 'from-site'],
  feature: ['enhancement', 'from-site'],
};

/** `@name` in a public issue notifies that GitHub user; a zero-width space keeps it plain text. */
const quietMentions = (text: string) => text.replace(/@(?=[A-Za-z0-9])/g, '@​');

/** A file name safe inside link text: no brackets or markup, and short. */
const linkText = (name: string) => name.replace(/[[\]()<>`*_\\]/g, '').slice(0, 80) || 'file';

export function issueBody(input: {
  description: string;
  page: string | null;
  files: StoredFile[];
}): string {
  const parts = [quietMentions(input.description)];
  if (input.page) parts.push(`**Page:** \`${input.page}\``);
  if (input.files.length > 0) {
    const lines = input.files.map((f) =>
      f.image ? `![${linkText(f.name)}](${f.url})` : `[${linkText(f.name)}](${f.url})`,
    );
    parts.push(['**Attachments**', '', ...lines].join('\n'));
  }
  parts.push("---\n<sub>Submitted through the site's feedback form.</sub>");
  return parts.join('\n\n');
}

export const issueTitle = (title: string) => quietMentions(title);
