import { httpResource } from '@angular/common/http';
import { computed, Service, signal } from '@angular/core';
import { indexLeague } from './league-index';
import { DraftFile, LeagueFile, StandingsFile, TradesFile } from './models';

type LazyFile = 'standings' | 'draft' | 'trades';

/**
 * Loads the pipeline's JSON. `league.json` (small) loads at start; the larger files load the
 * first time a page asks for them, versioned by `dataVersion` so a data update busts caches.
 */
@Service()
export class LeagueData {
  readonly league = httpResource<LeagueFile>(() => 'data/league.json');
  readonly index = computed(() =>
    this.league.hasValue() ? indexLeague(this.league.value()) : undefined,
  );

  private readonly wanted = signal<Record<LazyFile, boolean>>({
    standings: false,
    draft: false,
    trades: false,
  });

  readonly standings = httpResource<StandingsFile>(() => this.url('standings'));
  readonly draft = httpResource<DraftFile>(() => this.url('draft'));
  readonly trades = httpResource<TradesFile>(() => this.url('trades'));

  /** Ask for a lazily loaded file; a no-op once it is loading or loaded. */
  need(...files: LazyFile[]): void {
    if (files.every((f) => this.wanted()[f])) return;
    this.wanted.update((w) => ({ ...w, ...Object.fromEntries(files.map((f) => [f, true])) }));
  }

  private url(file: LazyFile): string | undefined {
    const version = this.league.hasValue() ? this.league.value().dataVersion : undefined;
    return this.wanted()[file] && version ? `data/${file}.json?v=${version}` : undefined;
  }
}
