import { Component, computed, inject, linkedSignal } from '@angular/core';
import { LeagueData } from '../../data/league-data';
import { adpDelta, mostDraftedFirstRounders } from '../../data/stats';
import { NumberPipe } from '../../shared/format';
import { LoadState } from '../../shared/load-state';
import { ManagerLink } from '../../shared/manager-link';

@Component({
  selector: 'app-draft-page',
  imports: [LoadState, ManagerLink, NumberPipe],
  templateUrl: './draft-page.html',
  styles: `
    .ranking {
      margin: 0;
      padding-left: var(--space-5);
      columns: 2 14rem;
      font-size: var(--text-sm);
    }
    .ranking li {
      break-inside: avoid;
      padding: 2px 0;
    }
  `,
})
export class DraftPage {
  protected readonly data = inject(LeagueData);
  protected readonly index = this.data.index;

  constructor() {
    this.data.need('draft');
  }

  protected readonly seasons = computed(() => [...(this.index()?.seasons ?? [])].reverse());
  protected readonly seasonId = linkedSignal(() => this.seasons()[0]?.id ?? '');
  protected readonly divisions = computed(
    () => this.index()?.season.get(this.seasonId())?.divisions ?? [],
  );
  protected readonly divisionId = linkedSignal(() => this.divisions()[0]?.id ?? '');

  protected readonly board = computed(() => {
    const idx = this.index();
    if (!idx || !this.data.draft.hasValue()) return null;
    const draft = this.data.draft.value().drafts.find((d) => d.divisionId === this.divisionId());
    if (!draft) return { format: null, picks: [] };
    const picks = draft.picks.map((p) => {
      const team = idx.team.get(p.teamId)!;
      return {
        ...p,
        team,
        manager: idx.manager.get(team.managerId)!,
        delta: adpDelta(p, draft.format),
      };
    });
    if (draft.format === 'auction') picks.sort((a, b) => (b.bid ?? 0) - (a.bid ?? 0));
    return { format: draft.format, picks };
  });

  protected readonly firstRounders = computed(() => {
    if (!this.data.draft.hasValue()) return [];
    const seasonDrafts = this.data.draft
      .value()
      .drafts.filter((d) => this.divisions().some((div) => div.id === d.divisionId));
    return mostDraftedFirstRounders(seasonDrafts, 12);
  });

  protected selectSeason(event: Event): void {
    this.seasonId.set((event.target as HTMLSelectElement).value);
  }

  protected selectDivision(event: Event): void {
    this.divisionId.set((event.target as HTMLSelectElement).value);
  }
}
