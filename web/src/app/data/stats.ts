/**
 * Every derived number on the site, as pure functions over the loaded JSON.
 * Components only format what these return.
 */
import { DivisionInfo, LeagueIndex } from './league-index';
import {
  Draft,
  Manager,
  ManagerId,
  Pick,
  Snapshot,
  TeamId,
  TeamSeason,
  Trade,
  TradeSide,
} from './models';

export interface Totals {
  /** Seasons the GM finished (a final standing exists). */
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  /** (W + T/2) / games, as Yahoo shows it; null before any game. */
  winPct: number | null;
  pointsFor: number;
  pointsPerSeason: number | null;
  titles: number;
  playoffs: number;
  bestRank: number | null;
  avgRank: number | null;
  topTierSeasons: number;
}

export function totals(teams: readonly TeamSeason[], index: LeagueIndex): Totals {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let pointsFor = 0;
  let titles = 0;
  let playoffs = 0;
  let rankSum = 0;
  let topTier = 0;
  let bestRank: number | null = null;
  const finished = teams.filter((t) => t.final);
  for (const team of finished) {
    const f = team.final!;
    wins += f.wins;
    losses += f.losses;
    ties += f.ties;
    pointsFor += f.pointsFor ?? 0;
    rankSum += f.rank;
    bestRank = bestRank === null ? f.rank : Math.min(bestRank, f.rank);
    if (f.rank === 1) titles++;
    if (f.clinched) playoffs++;
    if (index.division.get(team.divisionId)?.tier === 1) topTier++;
  }
  const games = wins + losses + ties;
  return {
    seasons: finished.length,
    wins,
    losses,
    ties,
    winPct: games ? (wins + ties / 2) / games : null,
    pointsFor,
    pointsPerSeason: finished.length ? pointsFor / finished.length : null,
    titles,
    playoffs,
    bestRank,
    avgRank: finished.length ? rankSum / finished.length : null,
    topTierSeasons: topTier,
  };
}

// ---- Maratontabell ------------------------------------------------------------------------

export interface AllTimeRow {
  manager: Manager;
  totals: Totals;
}

export type AllTimeSort =
  'wins' | 'winPct' | 'pointsFor' | 'pointsPerSeason' | 'titles' | 'seasons';

/** One row per GM over their finished seasons; `tier` limits it to one division level. */
export function allTimeTable(
  index: LeagueIndex,
  options: { tier?: number; sort?: AllTimeSort } = {},
): AllTimeRow[] {
  const sort = options.sort ?? 'wins';
  const rows: AllTimeRow[] = [];
  for (const manager of index.manager.values()) {
    const teams = (index.teamsOf.get(manager.id) ?? []).filter(
      (t) => options.tier === undefined || index.division.get(t.divisionId)?.tier === options.tier,
    );
    const sum = totals(teams, index);
    if (sum.seasons > 0) rows.push({ manager, totals: sum });
  }
  const value = (row: AllTimeRow): number => row.totals[sort] ?? -1;
  return rows.sort(
    (a, b) =>
      value(b) - value(a) ||
      b.totals.wins - a.totals.wins ||
      b.totals.pointsFor - a.totals.pointsFor ||
      a.manager.name.localeCompare(b.manager.name, 'sv'),
  );
}

// ---- Career ---------------------------------------------------------------------------------

export type Move = 'up' | 'down' | 'same';

export interface CareerSeason {
  team: TeamSeason;
  division: DivisionInfo;
  /** Where the GM played the following season, if they did. */
  next: DivisionInfo | null;
  /** Promotion/relegation into `next`; null when either season has no tiers. */
  move: Move | null;
}

export function career(index: LeagueIndex, managerId: ManagerId): CareerSeason[] {
  const teams = index.teamsOf.get(managerId) ?? [];
  return teams.map((team) => {
    const division = index.division.get(team.divisionId)!;
    const nextSeason = index.seasons[index.seasons.findIndex((s) => s.id === team.seasonId) + 1];
    const following = teams.filter((t) => t.seasonId === nextSeason?.id);
    const nextTeam = following.find((t) => t.final) ?? following[0];
    const next = nextTeam ? index.division.get(nextTeam.divisionId)! : null;
    let move: Move | null = null;
    if (next && division.tier !== null && next.tier !== null) {
      move = next.tier < division.tier ? 'up' : next.tier > division.tier ? 'down' : 'same';
    }
    return { team, division, next, move };
  });
}

/** How many teams in a division made the playoffs (Yahoo's `*`). */
export function playoffSpots(index: LeagueIndex, divisionId: string): number {
  const division = index.division.get(divisionId);
  return (division?.teamIds ?? []).filter((id) => index.team.get(id)?.final?.clinched).length;
}

/** Champions per division, top tier first, for one season. */
export function champions(index: LeagueIndex, seasonId: string): TeamSeason[] {
  const season = index.season.get(seasonId);
  if (!season) return [];
  return season.divisions
    .map((d) => index.team.get(d.teamIds[0]))
    .filter((t): t is TeamSeason => t?.final?.rank === 1);
}

// ---- Standings over time ------------------------------------------------------------------------

export interface RankPoint {
  /** Week number, or null for the final table (drawn last). */
  round: number | null;
  rank: number;
}

export function snapshotsFor(snapshots: readonly Snapshot[], divisionId: string): Snapshot[] {
  return snapshots.filter((s) => s.divisionId === divisionId).sort((a, b) => a.round - b.round);
}

/** A team's rank after each recorded week, then its final rank. */
export function rankPath(snapshots: readonly Snapshot[], team: TeamSeason): RankPoint[] {
  const points: RankPoint[] = [];
  for (const snap of snapshotsFor(snapshots, team.divisionId)) {
    const row = snap.rows.find((r) => r.teamId === team.id);
    if (row) points.push({ round: snap.round, rank: row.rank });
  }
  if (team.final) points.push({ round: null, rank: team.final.rank });
  return points;
}

// ---- Trades ---------------------------------------------------------------------------------------

export function completed(trades: readonly Trade[]): Trade[] {
  return trades.filter((t) => t.status === 'completed');
}

export function managerOf(index: LeagueIndex, side: TradeSide): ManagerId | undefined {
  return index.team.get(side.teamId)?.managerId;
}

export function tradesOf(trades: readonly Trade[], index: LeagueIndex, id: ManagerId): Trade[] {
  return trades.filter((t) => t.sides.some((s) => managerOf(index, s) === id));
}

export interface Count<T> {
  item: T;
  count: number;
}

function ranked<T>(counts: Map<T, number>, limit: number): Count<T>[] {
  return [...counts.entries()]
    .map(([item, count]) => ({ item, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function mostActiveTraders(
  trades: readonly Trade[],
  index: LeagueIndex,
  limit = 10,
): Count<Manager>[] {
  const counts = new Map<Manager, number>();
  for (const trade of completed(trades)) {
    for (const side of trade.sides) {
      const manager = index.manager.get(managerOf(index, side) ?? '');
      if (manager) counts.set(manager, (counts.get(manager) ?? 0) + 1);
    }
  }
  return ranked(counts, limit);
}

/** Most frequent trading partners, league-wide or for one GM. */
export function tradePartners(
  trades: readonly Trade[],
  index: LeagueIndex,
  options: { managerId?: ManagerId; limit?: number } = {},
): Count<[Manager, Manager]>[] {
  const counts = new Map<string, number>();
  for (const trade of completed(trades)) {
    const [a, b] = trade.sides.map((s) => managerOf(index, s) ?? '');
    if (options.managerId && a !== options.managerId && b !== options.managerId) continue;
    // A GM's own pairs are keyed with them first, so the partner is always [1].
    const pair = options.managerId
      ? [options.managerId, a === options.managerId ? b : a]
      : [a, b].sort();
    counts.set(pair.join('|'), (counts.get(pair.join('|')) ?? 0) + 1);
  }
  return ranked(counts, options.limit ?? 10).map(({ item, count }) => {
    const [a, b] = item.split('|').map((id) => index.manager.get(id)!);
    return { item: [a, b] as [Manager, Manager], count };
  });
}

export function mostTradedPlayers(trades: readonly Trade[], limit = 10): Count<string>[] {
  const counts = new Map<string, number>();
  for (const trade of completed(trades)) {
    for (const side of trade.sides) {
      for (const player of side.receives) counts.set(player, (counts.get(player) ?? 0) + 1);
    }
  }
  return ranked(counts, limit);
}

export function biggestTrades(trades: readonly Trade[], limit = 5): Trade[] {
  const size = (t: Trade): number => t.sides[0].receives.length + t.sides[1].receives.length;
  return [...completed(trades)].sort((a, b) => size(b) - size(a)).slice(0, limit);
}

// ---- Draft ----------------------------------------------------------------------------------------

export interface DraftedPick extends Pick {
  divisionId: string;
  format: Draft['format'];
}

export function picksOf(drafts: readonly Draft[], teamIds: ReadonlySet<TeamId>): DraftedPick[] {
  return drafts.flatMap((d) =>
    d.picks
      .filter((p) => teamIds.has(p.teamId))
      .map((p) => ({ ...p, divisionId: d.divisionId, format: d.format })),
  );
}

/**
 * Picks after (+, value) or before (-, a reach) the player's average slot across all VNHLFL
 * divisions that season. Auction picks have no slot to compare, so they get null.
 */
export function adpDelta(pick: Pick, format: Draft['format']): number | null {
  if (format !== 'snake' || pick.overall === null || pick.adpLeague === null) return null;
  return pick.overall - pick.adpLeague;
}

export function mostDraftedFirstRounders(drafts: readonly Draft[], limit = 10): Count<string>[] {
  const counts = new Map<string, number>();
  for (const draft of drafts) {
    for (const pick of draft.picks) {
      if (draft.format === 'snake' && pick.round === 1) {
        counts.set(pick.player, (counts.get(pick.player) ?? 0) + 1);
      }
    }
  }
  return ranked(counts, limit);
}
