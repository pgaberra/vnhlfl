import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { LeagueData } from '../../data/league-data';
import { displayName } from '../../data/league-index';
import { gamesOf, PLAYOFF_STAGES, STAGE_LABEL, totals } from '../../data/stats';
import { PctPipe, PointsPipe } from '../../shared/format';
import { LoadState } from '../../shared/load-state';
import { ManagerLink } from '../../shared/manager-link';

@Component({
  selector: 'app-h2h-page',
  imports: [LoadState, ManagerLink, PctPipe, PointsPipe],
  templateUrl: './h2h-page.html',
  styleUrl: './h2h-page.css',
})
export class H2hPage {
  /** Query params: the two GMs to compare. */
  readonly a = input<string>();
  readonly b = input<string>();

  protected readonly data = inject(LeagueData);
  protected readonly index = this.data.index;
  private readonly router = inject(Router);
  protected readonly stageLabel = STAGE_LABEL;

  constructor() {
    this.data.need('matchups');
  }

  protected readonly managers = computed(() =>
    [...(this.index()?.manager.values() ?? [])].sort((x, y) =>
      displayName(x).localeCompare(displayName(y), 'sv'),
    ),
  );

  protected readonly left = computed(() => this.index()?.manager.get(this.a() ?? ''));
  protected readonly right = computed(() => this.index()?.manager.get(this.b() ?? ''));

  protected readonly careers = computed(() => {
    const idx = this.index();
    const pair = [this.left(), this.right()];
    if (!idx || !pair[0] || !pair[1]) return null;
    return pair.map((m) => totals(idx.teamsOf.get(m!.id) ?? [], idx));
  });

  protected readonly meetings = computed(() => {
    const idx = this.index();
    const a = this.left();
    const b = this.right();
    if (!idx || !a || !b || !this.data.matchups.hasValue()) return null;
    const games = gamesOf(this.data.matchups.value().matchups, idx, a.id)
      .filter((g) => idx.team.get(g.theirs.teamId)?.managerId === b.id)
      .reverse()
      .map((g) => ({
        ...g,
        division: idx.division.get(g.matchup.divisionId)!,
        myTeam: idx.team.get(g.mine.teamId)!.name,
        theirTeam: idx.team.get(g.theirs.teamId)!.name,
        playoff: PLAYOFF_STAGES.has(g.matchup.stage),
      }));
    const count = (r: string) => games.filter((g) => g.result === r).length;
    return {
      games,
      wins: count('W'),
      losses: count('L'),
      ties: count('T'),
      pointsFor: games.reduce((n, g) => n + g.mine.points, 0),
      pointsAgainst: games.reduce((n, g) => n + g.theirs.points, 0),
    };
  });

  protected select(side: 'a' | 'b', event: Event): void {
    const value = (event.target as HTMLSelectElement).value || null;
    void this.router.navigate([], {
      queryParams: { [side]: value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected swap(): void {
    void this.router.navigate([], { queryParams: { a: this.b(), b: this.a() }, replaceUrl: true });
  }
}
