import { Component, computed, inject, signal } from '@angular/core';
import { LeagueData } from '../../data/league-data';
import {
  biggestTrades,
  completed,
  mostActiveTraders,
  mostTradedPlayers,
  tradePartners,
} from '../../data/stats';
import { LoadState } from '../../shared/load-state';
import { ManagerLink } from '../../shared/manager-link';
import { TradeCard } from '../../shared/trade-card';

const PAGE = 40;

@Component({
  selector: 'app-trades-page',
  imports: [LoadState, ManagerLink, TradeCard],
  templateUrl: './trades-page.html',
  styleUrl: './trades-page.css',
})
export class TradesPage {
  protected readonly data = inject(LeagueData);
  protected readonly index = this.data.index;
  protected readonly seasonId = signal<string | null>(null);
  protected readonly shown = signal(PAGE);

  constructor() {
    this.data.need('trades');
  }

  protected readonly seasons = computed(() => {
    const idx = this.index();
    return idx ? idx.seasons.filter((s) => idx.league.coverage.trades.includes(s.id)) : [];
  });

  protected readonly missing = computed(() => {
    const idx = this.index();
    if (!idx) return '';
    const labels = idx.seasons
      .filter((s) => !idx.league.coverage.trades.includes(s.id))
      .map((s) => s.label);
    return labels.join(', ');
  });

  private readonly selected = computed(() => {
    if (!this.data.trades.hasValue()) return null;
    const all = this.data.trades.value().trades;
    const season = this.seasonId();
    return season ? all.filter((t) => t.seasonId === season) : all;
  });

  protected readonly stats = computed(() => {
    const idx = this.index();
    const trades = this.selected();
    if (!idx || !trades) return null;
    const done = completed(trades);
    return {
      completed: done.length,
      stopped: trades.length - done.length,
      players: done.reduce(
        (n, t) => n + t.sides[0].receives.length + t.sides[1].receives.length,
        0,
      ),
      traders: mostActiveTraders(trades, idx, 10),
      partners: tradePartners(trades, idx, { limit: 10 }),
      players10: mostTradedPlayers(trades, 10),
      biggest: biggestTrades(trades, 3),
    };
  });

  protected readonly list = computed(() => {
    const trades = this.selected();
    return trades ? [...trades].reverse() : [];
  });

  protected pick(season: string | null): void {
    this.seasonId.set(season);
    this.shown.set(PAGE);
  }

  protected more(): void {
    this.shown.update((n) => n + PAGE);
  }
}
