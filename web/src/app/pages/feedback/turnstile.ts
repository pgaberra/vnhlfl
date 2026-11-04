import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

interface Turnstile {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | undefined;

/** Loads Cloudflare's script once, and only on the page that needs it. */
function loadTurnstile(): Promise<Turnstile> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve(window.turnstile!);
    script.onerror = () => {
      loading = undefined;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.append(script);
  });
  return loading;
}

/** Cloudflare Turnstile: the check that a person, not a bot, is sending the form. */
@Component({
  selector: 'app-turnstile',
  template: `
    <div #box></div>
    @if (failed()) {
      <p class="hint" role="alert">
        Säkerhetskontrollen kunde inte laddas. Stäng av eventuell annonsblockerare och ladda om
        sidan.
      </p>
    }
  `,
})
export class TurnstileWidget {
  readonly siteKey = input.required<string>();
  /** The one-time token the Worker verifies; null until the check passes or after it expires. */
  readonly token = model<string | null>(null);

  protected readonly failed = signal(false);
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  private widgetId?: string;

  constructor() {
    afterNextRender(async () => {
      try {
        const turnstile = await loadTurnstile();
        this.widgetId = turnstile.render(this.box().nativeElement, {
          sitekey: this.siteKey(),
          language: 'sv',
          theme: 'auto',
          size: 'flexible',
          callback: (token: string) => this.token.set(token),
          'expired-callback': () => this.token.set(null),
          'error-callback': () => this.token.set(null),
        });
      } catch {
        this.failed.set(true);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.widgetId) window.turnstile?.remove(this.widgetId);
    });
  }

  /** A token works once, so a failed send needs a fresh check. */
  reset(): void {
    this.token.set(null);
    if (this.widgetId) window.turnstile?.reset(this.widgetId);
  }
}
