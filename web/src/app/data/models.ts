/**
 * The JSON contract written by `pipeline/` (see `vnhlfl_pipeline/build.py`).
 * Change both sides together.
 */

export type SeasonId = string; // `2023-24`
export type DivisionId = string; // `2023-24-div-1-gretzky`
export type ManagerId = string; // slug of the first team name the GM played under
export type TeamId = string; // `2023-24:<managerId>`, one GM in one season

export interface LeagueFile {
  nameMode: 'team' | 'full';
  dataVersion: string;
  seasons: Season[];
  managers: Manager[];
  teams: TeamSeason[];
  coverage: Coverage;
}

export interface Coverage {
  finalStandings: SeasonId[];
  weeklyStandings: SeasonId[];
  draft: SeasonId[];
  trades: SeasonId[];
  matchups: SeasonId[];
}

export interface Season {
  id: SeasonId;
  label: string;
  divisions: Division[];
}

export interface Division {
  id: DivisionId;
  name: string;
  /** 1 is the top division. Null in 2021/22, when the three divisions were parallel. */
  tier: number | null;
  draftFormat: 'snake' | 'auction' | null;
  /** Ordered by final rank; teams that left mid-season come last. */
  teamIds: TeamId[];
}

export interface Manager {
  id: ManagerId;
  /** Latest team name: the public face of a GM while real names stay unpublished. */
  name: string;
  /** Present only when the founder has publishing consent (pipeline `--names full`). */
  realName?: string;
  teamNames: string[];
  /** The team has no GM in the founder's mapping yet; its career may be split. */
  unmapped?: boolean;
}

export interface StandingRecord {
  rank: number;
  /** Yahoo's `*`: the team made the playoffs. */
  clinched: boolean;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number | null;
}

export interface FinalStanding extends StandingRecord {
  fab: number | null;
  waiver: number | null;
  moves: number | null;
}

export interface TeamLink {
  teamId: TeamId;
  date: string | null;
}

export interface TeamSeason {
  id: TeamId;
  seasonId: SeasonId;
  divisionId: DivisionId;
  managerId: ManagerId;
  name: string;
  otherNames: string[];
  /** Null when the GM left before the season ended. */
  final: FinalStanding | null;
  replaces?: TeamLink;
  replacedBy?: TeamLink;
}

export interface StandingsFile {
  snapshots: Snapshot[];
}

export interface Snapshot {
  divisionId: DivisionId;
  round: number;
  rows: (StandingRecord & { teamId: TeamId })[];
}

export interface DraftFile {
  drafts: Draft[];
}

export interface Draft {
  divisionId: DivisionId;
  format: 'snake' | 'auction';
  picks: Pick[];
}

export interface Pick {
  teamId: TeamId;
  round: number;
  overall: number | null;
  player: string;
  adpYahoo: number | null;
  /** Average pick across all VNHLFL divisions that season. */
  adpLeague: number | null;
  /** Auction price; null in snake drafts. */
  bid: number | null;
}

export interface TradesFile {
  trades: Trade[];
}

export type TradeStatus = 'completed' | 'vetoed' | 'countered' | 'cancelled';

export interface Trade {
  id: string;
  seasonId: SeasonId;
  divisionId: DivisionId;
  week: number | null;
  date: string | null;
  status: TradeStatus;
  sides: [TradeSide, TradeSide];
}

export interface TradeSide {
  teamId: TeamId;
  receives: string[];
}

export interface MatchupsFile {
  matchups: Matchup[];
}

export type Stage =
  | 'regular'
  | 'quarterfinal'
  | 'semifinal'
  | 'final'
  | 'third-place'
  | 'fifth-place'
  | 'consolation-quarterfinal'
  | 'consolation-semifinal'
  | 'consolation-final'
  | 'ninth-place'
  | 'eleventh-place'
  /** Consolation-bracket game from the screenshot era, where the exact place isn't shown. */
  | 'placement';

export interface MatchSide {
  teamId: TeamId;
  points: number;
}

export interface Matchup {
  seasonId: SeasonId;
  divisionId: DivisionId;
  week: number;
  stage: Stage;
  home: MatchSide;
  away: MatchSide;
}
