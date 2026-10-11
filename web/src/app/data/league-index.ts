import {
  Division,
  DivisionId,
  LeagueFile,
  Manager,
  ManagerId,
  Season,
  SeasonId,
  TeamId,
  TeamSeason,
} from './models';

export interface DivisionInfo extends Division {
  seasonId: SeasonId;
  seasonLabel: string;
}

/** Lookup tables over `league.json`, built once per load. */
export interface LeagueIndex {
  league: LeagueFile;
  /** Oldest first. */
  seasons: Season[];
  season: Map<SeasonId, Season>;
  division: Map<DivisionId, DivisionInfo>;
  team: Map<TeamId, TeamSeason>;
  manager: Map<ManagerId, Manager>;
  /** Each GM's team-seasons, oldest first. */
  teamsOf: Map<ManagerId, TeamSeason[]>;
}

export function indexLeague(league: LeagueFile): LeagueIndex {
  const seasons = [...league.seasons].sort((a, b) => a.id.localeCompare(b.id));
  const division = new Map<DivisionId, DivisionInfo>();
  for (const season of seasons) {
    for (const d of season.divisions) {
      division.set(d.id, { ...d, seasonId: season.id, seasonLabel: season.label });
    }
  }
  const teamsOf = new Map<ManagerId, TeamSeason[]>();
  for (const team of league.teams) {
    const list = teamsOf.get(team.managerId) ?? [];
    list.push(team);
    teamsOf.set(team.managerId, list);
  }
  for (const list of teamsOf.values()) {
    list.sort((a, b) => a.seasonId.localeCompare(b.seasonId));
  }
  return {
    league,
    seasons,
    season: new Map(seasons.map((s) => [s.id, s])),
    division,
    team: new Map(league.teams.map((t) => [t.id, t])),
    manager: new Map(league.managers.map((m) => [m.id, m])),
    teamsOf,
  };
}

/** The name a GM is shown under: their real name once published, otherwise the team name. */
export function displayName(manager: Manager): string {
  return manager.realName ?? manager.name;
}
