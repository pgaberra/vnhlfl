import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideSearch, LucideTrophy } from '@lucide/angular';
import { LeagueData } from '../../data/league-data';
import { displayName } from '../../data/league-index';
import { allTimeTable, champions } from '../../data/stats';
import { NumberPipe, PctPipe, PointsPipe } from '../../shared/format';
import { LoadState } from '../../shared/load-state';
import { ManagerLink } from '../../shared/manager-link';
import { StatTile } from '../../shared/stat-tile';

@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    LoadState,
    ManagerLink,
    StatTile,
    NumberPipe,
    PctPipe,
    PointsPipe,
    LucideTrophy,
    LucideSearch,
    LucideArrowRight,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {
  protected readonly data = inject(LeagueData);
  protected readonly index = this.data.index;
  protected readonly query = signal('');

  protected readonly facts = computed(() => {
    const idx = this.index();
    if (!idx) return null;
    const latest = idx.seasons.at(-1)!;
    return {
      seasons: idx.seasons.length,
      managers: idx.manager.size,
      teams: latest.divisions.reduce(
        (n, d) => n + d.teamIds.filter((id) => idx.team.get(id)?.final).length,
        0,
      ),
      divisions: latest.divisions.length,
      latest,
    };
  });

  protected readonly latestChampions = computed(() => {
    const idx = this.index();
    const facts = this.facts();
    if (!idx || !facts) return [];
    return champions(idx, facts.latest.id).map((team) => ({
      team,
      manager: idx.manager.get(team.managerId)!,
      division: idx.division.get(team.divisionId)!,
    }));
  });

  /** Top-tier champions per season (2021/22 had three parallel divisions, so three). */
  protected readonly topChampions = computed(() => {
    const idx = this.index();
    if (!idx) return [];
    return [...idx.seasons].reverse().map((season) => {
      const all = champions(idx, season.id);
      const top = all.filter((t) => idx.division.get(t.divisionId)?.tier === 1);
      return {
        season,
        teams: (top.length ? top : all).map((team) => ({
          team,
          manager: idx.manager.get(team.managerId)!,
          division: idx.division.get(team.divisionId)!,
        })),
      };
    });
  });

  protected readonly topTen = computed(() => {
    const idx = this.index();
    return idx ? allTimeTable(idx).slice(0, 10) : [];
  });

  protected readonly matches = computed(() => {
    const idx = this.index();
    const q = this.query().trim().toLowerCase();
    if (!idx || q.length < 2) return [];
    return [...idx.manager.values()]
      .filter((m) => [displayName(m), ...m.teamNames].some((n) => n.toLowerCase().includes(q)))
      .slice(0, 8);
  });

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
