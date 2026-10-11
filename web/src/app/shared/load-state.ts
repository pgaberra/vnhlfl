import { Component, computed, input } from '@angular/core';
import { HttpResourceRef } from '@angular/common/http';
import { LucideCircleAlert } from '@lucide/angular';

/**
 * Loading and error UI for pages waiting on one or more data files.
 * Render it in the `@else` branch of the page's `@if (data)`.
 */
@Component({
  selector: 'app-load-state',
  imports: [LucideCircleAlert],
  template: `
    @if (failed()) {
      <div class="state error" role="alert">
        <svg lucideCircleAlert class="icon" aria-hidden="true"></svg>
        <div>
          <p><strong>Datan kunde inte laddas.</strong></p>
          <p class="hint">
            {{ offline() ? 'Du verkar vara offline.' : 'Något gick fel hos oss eller på vägen.' }}
          </p>
        </div>
        <button type="button" class="btn" (click)="retry()">Försök igen</button>
      </div>
    } @else {
      <div class="state" aria-busy="true">
        <span class="spinner" aria-hidden="true"></span>
        <span>Laddar statistiken</span>
      </div>
    }
  `,
  styles: `
    .state {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-5);
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      color: var(--ink-2);
    }
    .error .icon {
      color: var(--down);
      width: 1.5rem;
      height: 1.5rem;
    }
    .error div {
      flex: 1;
      min-width: 12rem;
    }
    .spinner {
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 50%;
      border: 2px solid var(--line-strong);
      border-top-color: var(--accent);
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 2.4s;
      }
    }
  `,
})
export class LoadState {
  readonly refs = input.required<readonly HttpResourceRef<unknown>[]>();

  protected readonly failed = computed(() => this.refs().some((r) => r.status() === 'error'));
  protected readonly offline = computed(() => this.failed() && !navigator.onLine);

  protected retry(): void {
    for (const ref of this.refs()) {
      if (ref.status() === 'error') ref.reload();
    }
  }
}
