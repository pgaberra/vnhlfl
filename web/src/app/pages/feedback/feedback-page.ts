import {
  Component,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { ACCEPTED_TYPES, addFiles, errorMessage, formatBytes, Kind, LIMITS } from './feedback';
import { FEEDBACK_CONFIG } from './feedback-config';
import { shrinkImage } from './shrink-image';
import { TurnstileWidget } from './turnstile';

interface Draft {
  kind: Kind;
  title: string;
  description: string;
  page: string;
}

interface Attachment {
  file: File;
  /** An object URL for the thumbnail; null for PDFs. */
  preview: string | null;
}

@Component({
  selector: 'app-feedback-page',
  imports: [FormField, RouterLink, TurnstileWidget],
  templateUrl: './feedback-page.html',
  styleUrl: './feedback-page.css',
})
export class FeedbackPage {
  /** Query params: `typ=forslag` opens on a suggestion; `sida` is the page the member came from. */
  readonly typ = input<string>();
  readonly sida = input<string>();

  protected readonly config = FEEDBACK_CONFIG;
  protected readonly limits = LIMITS;
  protected readonly accept = ACCEPTED_TYPES.join(',');
  protected readonly formatBytes = formatBytes;

  protected readonly draft = linkedSignal<Draft>(() => ({
    kind: this.typ() === 'forslag' ? 'feature' : 'bug',
    title: '',
    description: '',
    page: this.sida()?.startsWith('/') ? this.sida()! : '',
  }));

  protected readonly f = form(this.draft, (p) => {
    required(p.title, { message: 'Skriv en rubrik.' });
    minLength(p.title, LIMITS.titleMin, {
      message: `Rubriken behöver minst ${LIMITS.titleMin} tecken.`,
    });
    maxLength(p.title, LIMITS.titleMax, {
      message: `Rubriken får vara högst ${LIMITS.titleMax} tecken.`,
    });
    required(p.description, { message: 'Beskriv vad det gäller.' });
    minLength(p.description, LIMITS.descriptionMin, {
      message: `Beskrivningen behöver minst ${LIMITS.descriptionMin} tecken.`,
    });
    maxLength(p.description, LIMITS.descriptionMax, {
      message: `Beskrivningen får vara högst ${LIMITS.descriptionMax} tecken.`,
    });
  });

  protected readonly attachments = signal<Attachment[]>([]);
  protected readonly fileProblems = signal<string[]>([]);
  protected readonly token = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sent = signal<{ number: number; url: string } | null>(null);
  private readonly turnstile = viewChild(TurnstileWidget);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.attachments().forEach(revoke));
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.add([...(input.files ?? [])]);
    input.value = '';
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    void this.add([...(event.dataTransfer?.files ?? [])]);
  }

  /** A screenshot pasted into the form becomes an attachment; pasted text is left alone. */
  protected paste(event: ClipboardEvent): void {
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length === 0) return;
    event.preventDefault();
    void this.add(files);
  }

  private async add(incoming: File[]): Promise<void> {
    if (incoming.length === 0) return;
    const prepared = await Promise.all(incoming.map(shrinkImage));
    const current = this.attachments();
    const { files, problems } = addFiles(
      current.map((a) => a.file),
      prepared,
    );
    const added = files.slice(current.length).map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
    this.attachments.set([...current, ...added]);
    this.fileProblems.set(problems);
  }

  protected remove(attachment: Attachment): void {
    revoke(attachment);
    this.attachments.update((list) => list.filter((a) => a !== attachment));
    this.fileProblems.set([]);
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.f, async () => {
      const token = this.token();
      if (!token) {
        this.error.set(errorMessage('missing-captcha'));
        return;
      }
      const draft = this.draft();
      const body = new FormData();
      body.set('kind', draft.kind);
      body.set('title', draft.title);
      body.set('description', draft.description);
      body.set('page', draft.page.trim());
      body.set('cf-turnstile-response', token);
      for (const { file } of this.attachments()) body.append('files', file, file.name);

      this.sending.set(true);
      this.error.set(null);
      try {
        const response = await fetch(this.config.endpoint, { method: 'POST', body });
        const result = await response.json().catch(() => ({}));
        if (response.ok) {
          this.sent.set(result);
        } else {
          this.error.set(errorMessage(result.error));
          this.turnstile()?.reset();
        }
      } catch {
        this.error.set(errorMessage('network'));
        this.turnstile()?.reset();
      } finally {
        this.sending.set(false);
      }
    });
  }

  /** Clears the form for a new report, keeping the kind and the page. */
  protected again(): void {
    this.attachments().forEach(revoke);
    this.attachments.set([]);
    this.fileProblems.set([]);
    this.draft.update((d) => ({ ...d, title: '', description: '' }));
    this.f().reset();
    this.token.set(null);
    this.error.set(null);
    this.sent.set(null);
  }
}

function revoke(attachment: Attachment): void {
  if (attachment.preview) URL.revokeObjectURL(attachment.preview);
}
