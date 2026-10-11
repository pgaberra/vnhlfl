import { Component, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { LucideArrowDown, LucideArrowUp, LucideSwords, LucideTrophy } from '@lucide/angular';
import { LeagueData } from '../../data/league-data';
import { displayName, LeagueIndex } from '../../data/league-index';
import { Trade } from '../../data/models';
import {
  adpDelta,
  career,
  completed,
  managerOf,
  picksOf,
  playoffSpots,
  rankPath,
  snapshotsFor,
  totals,
  tradePartners,
  tradesOf,
} from '../../data/stats';
import {
  formatNumber,
  formatPct,
  formatPoints,
  formatRecord,
  NumberPipe,
  OrdinalPipe,
  PctPipe,
  PointsPipe,
  RecordPipe,
} from '../../shared/format';
import { LoadState } from '../../shared/load-state';
import { ManagerLink } from '../../shared/manager-link';
import { RankChart, RankSeries } from '../../shared/rank-chart';
import { StatTile } from '../../shared/stat-tile';
import { TradeCard } from '../../shared/trade-card';

@Component({
  selector: 'app-manager-page',
  imports: [
    RouterLink,
    LoadState,
    ManagerLink,
    RankChart,
    StatTile,
    TradeCard,
    NumberPipe,
    OrdinalPipe,
    PctPipe,
    PointsPipe,
    RecordPipe,
    LucideTrophy,
    LucideArrowUp,
    LucideArrowDown,
    LucideSwords,
  ],
  templateUrl: './manager-page.html',
  styleUrl: './manager-page.css',
})
export class ManagerPage {
  readonly id = input.required<string>();

  protected readonly data = inject(LeagueData);
  protected readonly index = this.data.index;

  constructor() {
    this.data.need('standings', 'trades', 'draft');
    const title = inject(Title);
    effect(() => {
      const m = this.manager();
      if (m) title.setTitle(`${displayName(m)} · VNHLFL`);
    });
  }

  protected readonly manager = computed(() => this.index()?.manager.get(this.id()));
  protected readonly name = computed(() => {
    const m = this.manager();
    return m ? displayName(m) : '';
  });
  protected readonly formerNames = computed(() =>
    (this.manager()?.teamNames ?? []).filter(
      (n) => n.toLowerCase() !== this.manager()?.name.toLowerCase(),
    ),
  );

  protected readonly seasons = computed(() => {
    const idx = this.index();
    return idx ? career(idx, this.id()) : [];
  });

  protected readonly tiles = computed(() => {
    const idx = this.index();
    if (!idx) return [];
    const t = totals(
      this.seasons().map((s) => s.team),
      idx,
    );
    return [
      { label: 'Säsonger', value: t.seasons, sub: `${t.topTierSeasons} i högsta divisionen` },
      { label: 'Matcher V-F-O', value: formatRecord(t), sub: `vinst% ${formatPct(t.winPct)}` },
      {
        label: 'Poäng totalt',
        value: formatPoints(t.pointsFor),
        sub: `${formatPoints(t.pointsPerSeason)} per säsong`,
      },
      { label: 'Titlar', value: t.titles, sub: `${t.playoffs} slutspel` },
      {
        label: 'Snittplacering',
        value: formatNumber(t.avgRank, 1),
        sub: t.bestRank ? `bästa: ${t.bestRank}:a` : null,
      },
    ];
  });

  protected readonly rankCharts = computed(() => {
    const idx = this.index();
    if (!idx || !this.data.standings.hasValue()) return null;
    const snapshots = this.data.standings.value().snapshots;
    return this.seasons()
      .filter((s) => snapshotsFor(snapshots, s.team.divisionId).length > 0)
      .map((s) => {
        const series: RankSeries[] = s.division.teamIds.map((teamId) => {
          const team = idx.team.get(teamId)!;
          return { id: team.id, label: team.name, points: rankPath(snapshots, team) };
        });
        return {
          season: s,
          series,
          teamCount: s.division.teamIds.filter((id) => idx.team.get(id)?.final).length,
          playoffSpots: playoffSpots(idx, s.team.divisionId),
        };
      });
  });

  protected readonly trades = computed(() => {
    const idx = this.index();
    if (!idx || !this.data.trades.hasValue()) return null;
    const all = this.data.trades.value().trades;
    const mine = tradesOf(all, idx, this.id());
    const done = completed(mine);
    return {
      list: [...mine].reverse(),
      completed: done.length,
      notCompleted: mine.length - done.length,
      players: done.reduce((n, t) => n + this.mySide(t, idx).receives.length, 0),
      partners: tradePartners(all, idx, { managerId: this.id(), limit: 5 }),
      seasonsCovered: idx.league.coverage.trades.length,
    };
  });

  protected readonly drafts = computed(() => {
    const idx = this.index();
    if (!idx || !this.data.draft.hasValue()) return null;
    const teamIds = new Set(this.seasons().map((s) => s.team.id));
    const picks = picksOf(this.data.draft.value().drafts, teamIds);
    return [...this.seasons()]
      .reverse()
      .map((s) => ({
        season: s,
        picks: picks
          .filter((p) => p.teamId === s.team.id)
          .sort((a, b) => a.round - b.round)
          .map((p) => ({ ...p, delta: adpDelta(p, p.format) })),
      }))
      .filter((d) => d.picks.length > 0);
  });

  protected mySide(trade: Trade, idx: LeagueIndex) {
    return trade.sides.find((s) => managerOf(idx, s) === this.id()) ?? trade.sides[0];
  }

  protected readonly hasTiers = computed(() =>
    this.seasons().some((s) => s.division.tier !== null),
  );
}
