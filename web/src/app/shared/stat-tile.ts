import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-tile',
  template: `
    <span class="label">{{ label() }}</span>
    <span class="value">{{ value() }}</span>
    @if (sub(); as s) {
      <span class="sub">{{ s }}</span>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 2px;
      align-content: start;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: var(--space-3) var(--space-4);
      min-width: 0;
    }
    .label {
      font-size: var(--text-xs);
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .value {
      font-size: var(--text-xl);
      font-weight: 700;
      line-height: 1.2;
    }
    .sub {
      font-size: var(--text-sm);
      color: var(--ink-2);
    }
  `,
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly sub = input<string | null>();
}
