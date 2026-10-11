import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowDown, LucideArrowUp, LucideTrophy } from '@lucide/angular';
import { LeagueData } from '../../data/league-data';
import { career, playoffSpots, rankPath, snapshotsFor } from '../../data/stats';
import { NumberPipe, PctPipe, PointsPipe, RecordPipe } from '../../shared/format';
import { LoadState } from '../../shared/load-state';
import { ManagerLink } from '../../shared/manager-link';
import { RankChart, RankSeries } from '../../shared/rank-chart';

@Component({
  selector: 'app-season-page',
  imports: [
    RouterLink,
    LoadState,
    ManagerLink,
    RankChart,
    NumberPipe,
    PctPipe,
    PointsPipe,
    RecordPipe,
    LucideTrophy,
    LucideArrowUp,
    LucideArrowDown,
  ],
  templateUrl: './season-page.html',
  styleUrl: './season-page.css',
})
export class SeasonPage {
  /** Route param; the latest season when absent. */
  readonly seasonId = input<string>();
  /** Query param `div`; the top division when absent. */
  readonly div = input<string>();

  protected readonly data = inject(LeagueData);
  protected readonly index = this.data.index;
  protected readonly hovered = signal<string | null>(null);

  constructor() {
    this.data.need('standings');
  }

  protected readonly season = computed(() => {
    const idx = this.index();
    if (!idx) return undefined;
    return idx.season.get(this.seasonId() ?? '') ?? idx.seasons.at(-1);
  });

  protected readonly division = computed(() => {
    const idx = this.index();
    const season = this.season();
    if (!idx || !season) return undefined;
    const id = season.divisions.some((d) => d.id === this.div())
      ? this.div()!
      : season.divisions[0].id;
    return idx.division.get(id);
  });

  protected readonly rows = computed(() => {
    const idx = this.index();
    const division = this.division();
    if (!idx || !division) return [];
    return division.teamIds.map((teamId) => {
      const team = idx.team.get(teamId)!;
      const seasonLine = career(idx, team.managerId).find((s) => s.team.id === team.id);
      return {
        team,
        manager: idx.manager.get(team.managerId)!,
        next: seasonLine?.next ?? null,
        move: seasonLine?.move ?? null,
        replacedBy: team.replacedBy ? idx.team.get(team.replacedBy.teamId) : undefined,
      };
    });
  });

  protected readonly finished = computed(() => this.rows().filter((r) => r.team.final));
  protected readonly left = computed(() => this.rows().filter((r) => !r.team.final));

  protected readonly chart = computed(() => {
    const idx = this.index();
    const division = this.division();
    if (!idx || !division || !this.data.standings.hasValue()) return null;
    const snapshots = this.data.standings.value().snapshots;
    const weeks = snapshotsFor(snapshots, division.id).length;
    const series: RankSeries[] = this.finished().map(({ team }) => ({
      id: team.id,
      label: team.name,
      points: rankPath(snapshots, team),
    }));
    return {
      weeks,
      series,
      teamCount: this.finished().length,
      playoffSpots: playoffSpots(idx, division.id),
    };
  });

  protected readonly highlight = computed(() => {
    const id = this.hovered() ?? this.finished()[0]?.team.id;
    return id ? [id] : [];
  });
}
