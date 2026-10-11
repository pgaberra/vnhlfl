import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ordinal } from './format';

export interface RankSeries {
  id: string;
  label: string;
  /** `round: null` is the final table, drawn after the last week. */
  points: { round: number | null; rank: number }[];
}

interface Plotted {
  id: string;
  label: string;
  d: string;
  dots: { x: number; y: number; round: number | null; rank: number }[];
}

const MARGIN = { top: 12, right: 16, bottom: 28, left: 32 };
const HIT_RADIUS = 28;

/**
 * Rank over the season (1 at the top). One highlighted series in the accent colour; any others
 * are grey context, since a division has more teams than a palette has safe colours. Hovering
 * a line highlights it.
 */
@Component({
  selector: 'app-rank-chart',
  template: `
    <div class="wrap" (pointerleave)="hovered.set(null)">
      <svg
        [attr.width]="width()"
        [attr.height]="height()"
        [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
        role="img"
        [attr.aria-label]="ariaLabel()"
        (pointermove)="onPointer($event)"
        (pointerdown)="onPointer($event)"
      >
        @for (t of yTicks(); track t) {
          <line
            class="grid"
            [attr.x1]="left"
            [attr.x2]="right()"
            [attr.y1]="y(t)"
            [attr.y2]="y(t)"
          />
          <text class="tick" [attr.x]="left - 8" [attr.y]="y(t)" dy="0.32em" text-anchor="end">
            {{ t }}
          </text>
        }
        @if (playoffY(); as py) {
          <line class="cut" [attr.x1]="left" [attr.x2]="right()" [attr.y1]="py" [attr.y2]="py" />
          <text class="cut-label" [attr.x]="right()" [attr.y]="py - 4" text-anchor="end">
            slutspelsstreck
          </text>
        }
        @for (t of xTicks(); track t.label) {
          <text class="tick" [attr.x]="t.x" [attr.y]="height() - 8" text-anchor="middle">
            {{ t.label }}
          </text>
        }
        @for (s of context(); track s.id) {
          <path class="line context" [attr.d]="s.d" />
        }
        @for (s of focus(); track s.id) {
          <path class="line focus" [attr.d]="s.d" />
          @for (p of s.dots; track $index) {
            <circle class="dot" [attr.cx]="p.x" [attr.cy]="p.y" r="4" />
          }
        }
      </svg>
      @if (tip(); as t) {
        <div class="tip" role="status" [style.left.px]="t.x" [style.top.px]="t.y">
          <strong>{{ t.label }}</strong>
          <span>{{ t.text }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .wrap {
      position: relative;
      touch-action: pan-y;
    }
    svg {
      display: block;
      overflow: visible;
      max-width: 100%;
      height: auto;
    }
    .grid {
      stroke: var(--chart-grid);
      stroke-width: 1;
    }
    .cut {
      stroke: var(--line-strong);
      stroke-width: 1;
    }
    .cut-label {
      fill: var(--muted);
      font-size: 10px;
    }
    .tick {
      fill: var(--muted);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
    .line {
      fill: none;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .context {
      stroke: var(--chart-context);
      stroke-width: 1.5;
    }
    .focus {
      stroke: var(--chart-series);
      stroke-width: 2.5;
    }
    .dot {
      fill: var(--chart-series);
      stroke: var(--chart-surface);
      stroke-width: 2;
    }
    .tip {
      position: absolute;
      z-index: var(--z-tooltip);
      transform: translate(-50%, calc(-100% - 12px));
      background: var(--ink);
      color: var(--bg);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      font-size: var(--text-xs);
      white-space: nowrap;
      pointer-events: none;
      display: grid;
    }
  `,
})
export class RankChart {
  readonly series = input.required<RankSeries[]>();
  /** Ids drawn in the accent colour when nothing is hovered. */
  readonly highlight = input<readonly string[]>([]);
  readonly teamCount = input.required<number>();
  /** Teams above the line made the playoffs; 0 hides the line. */
  readonly playoffSpots = input(0);
  readonly height = input(260);
  readonly label = input('Placering över säsongen');
  readonly hoveredChange = output<string | null>();

  protected readonly left = MARGIN.left;
  protected readonly width = signal(600);
  protected readonly hovered = signal<{ id: string; dot: Plotted['dots'][number] } | null>(null);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const observer = new ResizeObserver(([entry]) => this.width.set(entry.contentRect.width));
    afterNextRender(() => observer.observe(host));
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  protected readonly right = computed(() => this.width() - MARGIN.right);

  private readonly rounds = computed(() => {
    const weeks = new Set<number>();
    for (const s of this.series())
      for (const p of s.points) if (p.round !== null) weeks.add(p.round);
    return [...weeks].sort((a, b) => a - b);
  });

  /** Weeks sit at their true spacing; the final table gets one slot after the last week. */
  private readonly xDomain = computed(() => {
    const rounds = this.rounds();
    const first = rounds[0] ?? 0;
    const last = rounds.at(-1) ?? 0;
    return { first, finalAt: rounds.length ? last + Math.max(2, (last - first) / 8) : 1 };
  });

  protected x(round: number | null): number {
    const { first, finalAt } = this.xDomain();
    const value = round ?? finalAt;
    const span = finalAt - first || 1;
    return MARGIN.left + ((value - first) / span) * (this.right() - MARGIN.left);
  }

  protected y(rank: number): number {
    const n = Math.max(this.teamCount(), 2);
    return MARGIN.top + ((rank - 1) / (n - 1)) * (this.height() - MARGIN.top - MARGIN.bottom);
  }

  protected readonly yTicks = computed(() => {
    const n = this.teamCount();
    return [...new Set([1, Math.ceil(n / 2), n])];
  });

  protected readonly xTicks = computed(() => {
    const rounds = this.rounds();
    const room = Math.max(2, Math.floor((this.right() - MARGIN.left) / 44));
    const step = Math.ceil(rounds.length / room);
    const ticks = rounds
      .filter((_, i) => i % step === 0)
      .map((round) => ({ label: `v${round}`, x: this.x(round) }));
    if (this.series().some((s) => s.points.some((p) => p.round === null))) {
      ticks.push({ label: 'Slut', x: this.x(null) });
    }
    return ticks;
  });

  protected readonly playoffY = computed(() => {
    const spots = this.playoffSpots();
    return spots > 0 && spots < this.teamCount() ? (this.y(spots) + this.y(spots + 1)) / 2 : null;
  });

  private readonly plotted = computed<Plotted[]>(() =>
    this.series().map((s) => {
      const dots = s.points.map((p) => ({ x: this.x(p.round), y: this.y(p.rank), ...p }));
      const d = dots.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
      return { id: s.id, label: s.label, d, dots };
    }),
  );

  private readonly focusIds = computed(() => {
    const hovered = this.hovered();
    return new Set(hovered ? [hovered.id] : this.highlight());
  });

  protected readonly context = computed(() =>
    this.plotted().filter((s) => !this.focusIds().has(s.id)),
  );
  protected readonly focus = computed(() =>
    this.plotted().filter((s) => this.focusIds().has(s.id)),
  );

  protected readonly tip = computed(() => {
    const hovered = this.hovered();
    if (!hovered) return null;
    const series = this.plotted().find((s) => s.id === hovered.id);
    const { dot } = hovered;
    const when = dot.round === null ? 'Slutplacering' : `Efter vecka ${dot.round}`;
    return {
      x: dot.x,
      y: dot.y,
      label: series?.label ?? '',
      text: `${when}: ${ordinal(dot.rank)}`,
    };
  });

  protected readonly ariaLabel = computed(() => {
    const focus = this.focus()[0];
    if (!focus) return this.label();
    const path = focus.dots.map((d) => ordinal(d.rank)).join(', ');
    return `${this.label()}. ${focus.label}: ${path}.`;
  });

  protected onPointer(event: PointerEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    let best: { id: string; dot: Plotted['dots'][number]; dist: number } | null = null;
    for (const s of this.plotted()) {
      for (const dot of s.dots) {
        const dist = Math.hypot(dot.x - px, dot.y - py);
        if (dist < HIT_RADIUS && (!best || dist < best.dist)) best = { id: s.id, dot, dist };
      }
    }
    const next = best ? { id: best.id, dot: best.dot } : null;
    if (next?.id !== this.hovered()?.id || next?.dot !== this.hovered()?.dot) {
      this.hovered.set(next);
      this.hoveredChange.emit(next?.id ?? null);
    }
  }
}
