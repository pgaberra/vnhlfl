import { Component, computed, inject, signal } from '@angular/core';
import { LucideTrophy } from '@lucide/angular';
import { LeagueData } from '../../data/league-data';
import { allTimeTable, AllTimeSort } from '../../data/stats';
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
      } @else {
        <app-load-state [refs]="[data.league]" />
      }
    </div>
  `,
})
export class AllTimePage {
  protected readonly data = inject(LeagueData);
  protected readonly index = this.data.index;
  protected readonly sort = signal<AllTimeSort>('wins');
  protected readonly tier = signal<number | undefined>(undefined);

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
