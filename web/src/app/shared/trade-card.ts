import { Component, computed, input } from '@angular/core';
import { LucideArrowLeftRight } from '@lucide/angular';
import { LeagueIndex } from '../data/league-index';
import { ManagerId, Trade, TradeStatus } from '../data/models';
import { DayPipe } from './format';
import { ManagerLink } from './manager-link';

const STATUS: Record<TradeStatus, string | null> = {
  completed: null,
  vetoed: 'Vetoad',
  countered: 'Motbud',
  cancelled: 'Gick inte igenom',
};

/** One trade: who got what. With `perspective`, that GM's side comes first. */
@Component({
  selector: 'app-trade-card',
  imports: [ManagerLink, DayPipe, LucideArrowLeftRight],
  template: `
    <article class="trade" [class.void]="status()">
      <header>
        <span>{{ meta() }}</span>
        @if (trade().date) {
          <span>{{ trade().date | day }}</span>
        }
        @if (status(); as s) {
          <span class="badge">{{ s }}</span>
        }
      </header>
      <div class="sides">
        @for (side of sides(); track side.teamId; let first = $first) {
          @if (!first) {
            <svg lucideArrowLeftRight class="icon swap" aria-hidden="true"></svg>
          }
          <div class="side">
            @if (side.manager) {
              <app-manager-link [manager]="side.manager" [asTeam]="side.team" />
            } @else {
              <span>{{ side.team }}</span>
            }
            <span class="label">fick</span>
            <ul>
              @for (p of side.receives; track $index) {
                <li>{{ p }}</li>
              } @empty {
                <li class="muted">inga spelare</li>
              }
            </ul>
          </div>
        }
      </div>
    </article>
  `,
  styles: `
    .trade {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: var(--space-3) var(--space-4);
      display: grid;
      gap: var(--space-2);
      background: var(--surface);
    }
    .trade.void {
      background: var(--surface-2);
    }
    .trade.void ul {
      text-decoration: line-through;
      text-decoration-color: var(--muted);
    }
    header {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-3);
      align-items: center;
      font-size: var(--text-xs);
      color: var(--muted);
    }
    .sides {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: var(--space-3);
      align-items: start;
    }
    .side {
      display: grid;
      gap: 2px;
      min-width: 0;
      font-size: var(--text-sm);
    }
    .label {
      font-size: var(--text-xs);
      color: var(--muted);
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .swap {
      color: var(--muted);
      margin-top: 2px;
    }
    @media (max-width: 480px) {
      .sides {
        grid-template-columns: 1fr;
      }
      .swap {
        transform: rotate(90deg);
      }
    }
  `,
})
export class TradeCard {
  readonly trade = input.required<Trade>();
  readonly index = input.required<LeagueIndex>();
  readonly perspective = input<ManagerId>();
  /** Show the season and division in the header (off where the page already says it). */
  readonly showDivision = input(true);

  protected readonly status = computed(() => STATUS[this.trade().status]);

  protected readonly meta = computed(() => {
    const t = this.trade();
    const division = this.index().division.get(t.divisionId);
    const parts = [];
    if (this.showDivision() && division) parts.push(`${division.seasonLabel} ${division.name}`);
    if (t.week !== null) parts.push(`vecka ${t.week}`);
    return parts.join(' · ');
  });

  protected readonly sides = computed(() => {
    const idx = this.index();
    const sides = this.trade().sides.map((side) => {
      const team = idx.team.get(side.teamId);
      return {
        teamId: side.teamId,
        team: team?.name ?? side.teamId,
        manager: team ? idx.manager.get(team.managerId) : undefined,
        receives: side.receives,
      };
    });
    const me = this.perspective();
    return me && sides[1].manager?.id === me ? [sides[1], sides[0]] : sides;
  });
}
