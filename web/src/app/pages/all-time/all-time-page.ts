import { Component, computed, inject, signal } from '@angular/core';
import { LucideTrophy } from '@lucide/angular';
import { LeagueData } from '../../data/league-data';
import { allTimeTable, AllTimeSort, STAGE_LABEL, weekRecords } from '../../data/stats';
import { NumberPipe, PctPipe, PointsPipe } from '../../shared/format';
import { LoadState } from '../../shared/load-state';
import { ManagerLink } from '../../shared/manager-link';

interface Column {
  key: AllTimeSort;
  label: string;
}

@Component({
  selector: 'app-all-time-page',
  imports: [LoadState, ManagerLink, NumberPipe, PctPipe, PointsPipe, LucideTrophy],
  template: `
    <div class="page">
      <header class="page-head">
        <p class="eyebrow">Alla säsonger sammanlagt</p>
        <h1>Maratontabell</h1>
        <p class="lede">
          Grundserien summerad över alla säsonger som spelats klart. Sortera på vinster, poäng eller
          titlar, eller titta bara på en divisionsnivå.
        </p>
      </header>

      @if (index(); as idx) {
        <section class="card">
          <div class="toolbar">
            <div class="chips" role="group" aria-label="Divisionsnivå">
              @for (t of tiers(); track t.label) {
                <button
                  type="button"
                  class="chip"
                  [attr.aria-pressed]="tier() === t.value"
                  (click)="tier.set(t.value)"
                >
                  {{ t.label }}
                </button>
              }
            </div>
          </div>
          <div class="table-scroll">
            <table class="data">
              <thead>
                <tr>
                  <th scope="col" class="num">#</th>
                  <th scope="col">GM</th>
                  @for (c of columns; track c.key) {
                    <th
                      scope="col"
                      class="num"
                      [attr.aria-sort]="sort() === c.key ? 'descending' : null"
                    >
                      <button type="button" class="sort" (click)="sort.set(c.key)">
                        {{ c.label }}{{ sort() === c.key ? ' ▾' : '' }}
                      </button>
                    </th>
                  }
                  <th scope="col" class="num">V-F-O</th>
                  <th scope="col" class="num">Slutspel</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.manager.id; let i = $index) {
                  <tr>
                    <td class="num">{{ i + 1 }}</td>
                    <td class="name"><app-manager-link [manager]="row.manager" /></td>
                    <td class="num">{{ row.totals.seasons }}</td>
                    <td class="num">{{ row.totals.wins | num }}</td>
                    <td class="num">{{ row.totals.winPct | pct }}</td>
                    <td class="num">{{ row.totals.pointsFor | points }}</td>
                    <td class="num">{{ row.totals.pointsPerSeason | points }}</td>
                    <td class="num">
                      @if (row.totals.titles) {
                        <svg lucideTrophy class="icon trophy" aria-hidden="true"></svg>
                        {{ row.totals.titles }}
                      }
                    </td>
                    <td class="num">
                      {{ row.totals.wins }}-{{ row.totals.losses }}-{{ row.totals.ties }}
                    </td>
                    <td class="num">{{ row.totals.playoffs }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="10" class="muted">Ingen har spelat på den nivån än.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="hint">
            Vinst% räknar oavgjort som en halv vinst. Poäng är fantasypoäng i grundserien. Säsonger
            där en GM lämnade innan slutet räknas inte.
          </p>
        </section>

        <section class="card" aria-labelledby="records">
          <div class="card-head">
            <h2 id="records">Veckorekord</h2>
            <p class="hint">Alla matcher som finns registrerade, slutspel inräknat.</p>
          </div>
          @if (records(); as r) {
            <div class="grid-2">
              @for (list of r; track list.title) {
                <div>
                  <h3>{{ list.title }}</h3>
                  <ol class="records">
                    @for (w of list.rows; track $index) {
                      <li>
                        <span class="value">{{ w.value | points }}</span>
                        <span>
                          <app-manager-link [manager]="w.manager" [asTeam]="w.team" />
                          <span class="muted"> {{ w.when }}</span>
                        </span>
                      </li>
                    }
                  </ol>
                </div>
              }
            </div>
          } @else {
            <app-load-state [refs]="[data.matchups]" />
          }
        </section>
      } @else {
        <app-load-state [refs]="[data.league]" />
      }
    </div>
  `,
  styles: `
    .records {
      margin: var(--space-2) 0 0;
      padding-left: var(--space-5);
      display: grid;
      gap: var(--space-1);
      font-size: var(--text-sm);
    }
    .records li {
      display: flex;
      gap: var(--space-3);
      align-items: baseline;
    }
    .value {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      min-width: 4rem;
    }
  `,
})
export class AllTimePage {
  protected readonly data = inject(LeagueData);
  protected readonly index = this.data.index;
  protected readonly sort = signal<AllTimeSort>('wins');
  protected readonly tier = signal<number | undefined>(undefined);

  constructor() {
    this.data.need('matchups');
  }

  protected readonly records = computed(() => {
    const idx = this.index();
    if (!idx || !this.data.matchups.hasValue()) return null;
    const matchups = this.data.matchups.value().matchups;
    const describe = (by: 'score' | 'margin') =>
      weekRecords(matchups, { by, limit: 10 }).map((w) => {
        const team = idx.team.get(w.side.teamId)!;
        const division = idx.division.get(w.matchup.divisionId)!;
        const stage =
          w.matchup.stage === 'regular' ? `v${w.matchup.week}` : STAGE_LABEL[w.matchup.stage];
        return {
          value: by === 'margin' ? w.side.points - w.opponent.points : w.side.points,
          manager: idx.manager.get(team.managerId)!,
          team: team.name,
          when: `${division.seasonLabel} ${division.name}, ${stage}`,
        };
      });
    return [
      { title: 'Flest poäng en vecka', rows: describe('score') },
      { title: 'Största vinstmarginal', rows: describe('margin') },
    ];
  });

  protected readonly columns: Column[] = [
    { key: 'seasons', label: 'Säsonger' },
    { key: 'wins', label: 'Vinster' },
    { key: 'winPct', label: 'Vinst%' },
    { key: 'pointsFor', label: 'Poäng' },
    { key: 'pointsPerSeason', label: 'Poäng/säsong' },
    { key: 'titles', label: 'Titlar' },
  ];

  protected readonly tiers = computed(() => {
    const idx = this.index();
    const levels = new Set<number>();
    for (const d of idx?.division.values() ?? []) if (d.tier !== null) levels.add(d.tier);
    return [
      { label: 'Alla divisioner', value: undefined },
      ...[...levels].sort().map((t) => ({ label: `Div ${t}`, value: t as number | undefined })),
    ];
  });

  protected readonly rows = computed(() => {
    const idx = this.index();
    return idx ? allTimeTable(idx, { tier: this.tier(), sort: this.sort() }) : [];
  });
}
