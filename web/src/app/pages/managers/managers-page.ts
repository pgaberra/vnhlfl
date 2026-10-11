import { Component, computed, inject, signal } from '@angular/core';
import { LucideTrophy } from '@lucide/angular';
import { LeagueData } from '../../data/league-data';
import { displayName } from '../../data/league-index';
import { career, totals } from '../../data/stats';
import { OrdinalPipe } from '../../shared/format';
import { LoadState } from '../../shared/load-state';
import { ManagerLink } from '../../shared/manager-link';

@Component({
  selector: 'app-managers-page',
  imports: [LoadState, ManagerLink, OrdinalPipe, LucideTrophy],
  template: `
    <div class="page">
      <header class="page-head">
        <p class="eyebrow">Alla som spelat i ligan</p>
        <h1>GM:s</h1>
        <p class="lede">
          En GM visas med sitt senaste lagnamn. Sök på vilket lagnamn som helst, även gamla.
        </p>
      </header>

      @if (rows(); as list) {
        <section class="card">
          <div class="toolbar">
            <label class="field">
              <span>Sök lag</span>
              <input
                type="search"
                autocomplete="off"
                [value]="query()"
                (input)="onSearch($event)"
              />
            </label>
            <p class="hint" aria-live="polite">{{ filtered().length }} av {{ list.length }} GM:s</p>
          </div>
          <div class="table-scroll">
            <table class="data">
              <thead>
                <tr>
                  <th scope="col">GM</th>
                  <th scope="col">Tidigare lagnamn</th>
                  <th scope="col" class="num">Säsonger</th>
                  <th scope="col" class="num">Bästa</th>
                  <th scope="col" class="num">Titlar</th>
                  <th scope="col">Senast</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filtered(); track row.manager.id) {
                  <tr>
                    <td class="name"><app-manager-link [manager]="row.manager" /></td>
                    <td class="name muted">{{ row.formerNames }}</td>
                    <td class="num">{{ row.seasons }}</td>
                    <td class="num">{{ row.bestRank ? (row.bestRank | ordinal) : '–' }}</td>
                    <td class="num">
                      @if (row.titles) {
                        <svg lucideTrophy class="icon trophy" aria-hidden="true"></svg>
                        {{ row.titles }}
                      }
                    </td>
                    <td>
                      <span class="badge" [class.tier-1]="row.lastTier === 1">{{ row.last }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else {
        <app-load-state [refs]="[data.league]" />
      }
    </div>
  `,
})
export class ManagersPage {
  protected readonly data = inject(LeagueData);
  protected readonly query = signal('');

  protected readonly rows = computed(() => {
    const idx = this.data.index();
    if (!idx) return null;
    return [...idx.manager.values()]
      .map((manager) => {
        const seasons = career(idx, manager.id);
        const sum = totals(
          seasons.map((s) => s.team),
          idx,
        );
        const last = seasons.at(-1)!;
        return {
          manager,
          search: [displayName(manager), ...manager.teamNames].join(' ').toLowerCase(),
          formerNames: manager.teamNames
            .filter((n) => n.toLowerCase() !== manager.name.toLowerCase())
            .join(', '),
          seasons: new Set(seasons.map((s) => s.team.seasonId)).size,
          bestRank: sum.bestRank,
          titles: sum.titles,
          last: `${last.division.seasonLabel} ${last.division.name}`,
          lastTier: last.division.tier,
        };
      })
      .sort((a, b) => displayName(a.manager).localeCompare(displayName(b.manager), 'sv'));
  });

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.rows() ?? [];
    return q ? rows.filter((r) => r.search.includes(q)) : rows;
  });

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
