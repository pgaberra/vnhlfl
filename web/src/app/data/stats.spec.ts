import { describe, expect, it } from 'vitest';
import { formatPct, formatRecord, ordinal } from '../shared/format';
import { indexLeague } from './league-index';
import { FinalStanding, LeagueFile, Matchup, TeamSeason, Trade } from './models';
import {
  adpDelta,
  allTimeTable,
  career,
  champions,
  gamesOf,
  headToHead,
  mostActiveTraders,
  mostTradedPlayers,
  playoffSpots,
  rankPath,
  totals,
  tradePartners,
  weekRecords,
} from './stats';

function final(rank: number, wins: number, losses: number, pointsFor: number): FinalStanding {
  return {
    rank,
    clinched: rank <= 2,
    wins,
    losses,
    ties: 0,
    pointsFor,
    fab: 0,
    waiver: 0,
    moves: 0,
  };
}

function team(
  seasonId: string,
  divisionId: string,
  managerId: string,
  f: FinalStanding | null,
): TeamSeason {
  return {
    id: `${seasonId}:${managerId}`,
    seasonId,
    divisionId,
    managerId,
    name: managerId,
    otherNames: [],
    final: f,
  };
}

// Two seasons. `wolves` wins Div 1 then drops to Div 2; `bears` goes the other way.
const league: LeagueFile = {
  nameMode: 'team',
  dataVersion: 'test',
  coverage: { finalStandings: [], weeklyStandings: [], draft: [], trades: [], matchups: [] },
  managers: [
    { id: 'wolves', name: 'Wolves', teamNames: ['Wolves'] },
    { id: 'bears', name: 'Bears', teamNames: ['Bears'] },
    { id: 'eagles', name: 'Eagles', teamNames: ['Eagles'] },
  ],
  seasons: [
    {
      id: '2022-23',
      label: '2022/23',
      divisions: [
        {
          id: 'a1',
          name: 'Div 1',
          tier: 1,
          draftFormat: 'snake',
          teamIds: ['2022-23:wolves', '2022-23:eagles'],
        },
        { id: 'a2', name: 'Div 2', tier: 2, draftFormat: 'snake', teamIds: ['2022-23:bears'] },
      ],
    },
    {
      id: '2023-24',
      label: '2023/24',
      divisions: [
        {
          id: 'b1',
          name: 'Div 1',
          tier: 1,
          draftFormat: 'snake',
          teamIds: ['2023-24:bears', '2023-24:eagles'],
        },
        { id: 'b2', name: 'Div 2', tier: 2, draftFormat: 'snake', teamIds: ['2023-24:wolves'] },
      ],
    },
  ],
  teams: [
    team('2022-23', 'a1', 'wolves', final(1, 15, 6, 5000)),
    team('2022-23', 'a1', 'eagles', final(2, 6, 15, 4000)),
    team('2022-23', 'a2', 'bears', final(1, 12, 9, 4500)),
    team('2023-24', 'b1', 'bears', final(1, 10, 11, 4800)),
    team('2023-24', 'b1', 'eagles', final(2, 11, 10, 4700)),
    team('2023-24', 'b2', 'wolves', final(1, 20, 1, 5500)),
  ],
};
const index = indexLeague(league);

function trade(
  id: string,
  a: string,
  b: string,
  aGets: string[],
  bGets: string[],
  status: Trade['status'] = 'completed',
): Trade {
  return {
    id,
    seasonId: '2023-24',
    divisionId: 'b1',
    week: 3,
    date: '2023-10-24',
    status,
    sides: [
      { teamId: `2023-24:${a}`, receives: aGets },
      { teamId: `2023-24:${b}`, receives: bGets },
    ],
  };
}

describe('totals', () => {
  it('sums finished seasons and counts titles and top-tier seasons', () => {
    const t = totals(index.teamsOf.get('wolves')!, index);
    expect(t).toMatchObject({
      seasons: 2,
      wins: 35,
      losses: 7,
      titles: 2,
      topTierSeasons: 1,
      bestRank: 1,
    });
    expect(t.winPct).toBeCloseTo(35 / 42);
    expect(t.pointsPerSeason).toBe(5250);
  });

  it('ignores a season the GM left early', () => {
    const left = { ...league.teams[0], final: null };
    expect(totals([left], index).seasons).toBe(0);
    expect(totals([left], index).winPct).toBeNull();
  });
});

describe('allTimeTable', () => {
  it('sorts by wins by default and by any column on request', () => {
    expect(allTimeTable(index).map((r) => r.manager.id)).toEqual(['wolves', 'bears', 'eagles']);
    expect(allTimeTable(index, { sort: 'pointsFor' }).map((r) => r.manager.id)).toEqual([
      'wolves',
      'bears',
      'eagles',
    ]);
  });

  it('can be limited to one division level', () => {
    const top = allTimeTable(index, { tier: 1 });
    expect(top.map((r) => [r.manager.id, r.totals.seasons])).toEqual([
      ['eagles', 2],
      ['wolves', 1],
      ['bears', 1],
    ]);
  });
});

describe('career', () => {
  it('marks promotion and relegation into the next season', () => {
    expect(career(index, 'wolves').map((s) => s.move)).toEqual(['down', null]);
    expect(career(index, 'bears').map((s) => s.move)).toEqual(['up', null]);
    expect(career(index, 'eagles')[0].next?.id).toBe('b1');
  });
});

describe('champions and playoffs', () => {
  it('lists each division winner of a season', () => {
    expect(champions(index, '2023-24').map((t) => t.managerId)).toEqual(['bears', 'wolves']);
    expect(playoffSpots(index, 'a1')).toBe(2);
  });
});

describe('rankPath', () => {
  it('follows the weekly tables and ends on the final rank', () => {
    const snapshots = [
      {
        divisionId: 'b1',
        round: 5,
        rows: [
          {
            teamId: '2023-24:bears',
            rank: 2,
            clinched: false,
            wins: 2,
            losses: 3,
            ties: 0,
            pointsFor: 1,
          },
        ],
      },
      {
        divisionId: 'b1',
        round: 2,
        rows: [
          {
            teamId: '2023-24:bears',
            rank: 1,
            clinched: false,
            wins: 2,
            losses: 0,
            ties: 0,
            pointsFor: 1,
          },
        ],
      },
    ];
    expect(rankPath(snapshots, index.team.get('2023-24:bears')!)).toEqual([
      { round: 2, rank: 1 },
      { round: 5, rank: 2 },
      { round: null, rank: 1 },
    ]);
  });
});

describe('trades', () => {
  const trades = [
    trade('1', 'bears', 'eagles', ['A'], ['B']),
    trade('2', 'eagles', 'bears', ['A'], ['C', 'D']),
    trade('3', 'bears', 'wolves', ['E'], ['A']),
    trade('4', 'bears', 'eagles', ['F'], ['G'], 'vetoed'),
  ];

  it('counts completed trades per GM', () => {
    expect(mostActiveTraders(trades, index).map((c) => [c.item.id, c.count])).toEqual([
      ['bears', 3],
      ['eagles', 2],
      ['wolves', 1],
    ]);
  });

  it('finds the most frequent partners, league-wide and for one GM', () => {
    const pairs = tradePartners(trades, index);
    expect(pairs[0].count).toBe(2);
    expect(pairs[0].item.map((m) => m.id).sort()).toEqual(['bears', 'eagles']);
    const wolves = tradePartners(trades, index, { managerId: 'wolves' });
    expect(wolves.map((p) => [p.item[0].id, p.item[1].id, p.count])).toEqual([
      ['wolves', 'bears', 1],
    ]);
  });

  it('counts how often a player moved in completed trades', () => {
    expect(mostTradedPlayers(trades)[0]).toEqual({ item: 'A', count: 3 });
  });
});

describe('adpDelta', () => {
  const pick = {
    teamId: 't',
    round: 1,
    overall: 10,
    player: 'P',
    adpYahoo: null,
    adpLeague: 4,
    bid: null,
  };

  it('is positive when the player went later than the league average', () => {
    expect(adpDelta({ ...pick, overall: 10, adpLeague: 4 }, 'snake')).toBe(6);
    expect(adpDelta({ ...pick, overall: 4, adpLeague: 10 }, 'snake')).toBe(-6);
  });

  it('is null for auctions and missing data', () => {
    expect(adpDelta(pick, 'auction')).toBeNull();
    expect(adpDelta({ ...pick, adpLeague: null }, 'snake')).toBeNull();
  });
});

describe('format', () => {
  it('writes Swedish ordinals', () => {
    expect([1, 2, 3, 11, 12, 21, 22, 101].map(ordinal)).toEqual([
      '1:a',
      '2:a',
      '3:e',
      '11:e',
      '12:e',
      '21:a',
      '22:a',
      '101:a',
    ]);
  });

  it('prints win percentage like Yahoo', () => {
    expect(formatPct(0.5238)).toBe('.524');
    expect(formatPct(1)).toBe('1.000');
    expect(formatPct(null)).toBe('–');
  });

  it('prints a record', () => {
    expect(formatRecord({ wins: 11, losses: 10, ties: 0 })).toBe('11-10-0');
  });
});

describe('matchups', () => {
  function game(
    home: string,
    away: string,
    hp: number,
    ap: number,
    stage: Matchup['stage'] = 'regular',
  ): Matchup {
    return {
      seasonId: '2023-24',
      divisionId: 'b1',
      week: 1,
      stage,
      home: { teamId: `2023-24:${home}`, points: hp },
      away: { teamId: `2023-24:${away}`, points: ap },
    };
  }
  const games = [
    game('bears', 'eagles', 300, 200),
    game('eagles', 'bears', 250, 250),
    game('eagles', 'bears', 280, 270, 'final'),
    game('bears', 'wolves', 100, 400, 'consolation-final'),
  ];

  it("reads games from the GM's side", () => {
    expect(gamesOf(games, index, 'eagles').map((g) => [g.mine.points, g.result])).toEqual([
      [200, 'L'],
      [250, 'T'],
      [280, 'W'],
    ]);
  });

  it('builds a record per opponent with playoffs counted separately', () => {
    const [eagles, wolves] = headToHead(games, index, 'bears');
    expect(eagles).toMatchObject({
      games: 3,
      wins: 1,
      losses: 1,
      ties: 1,
      playoffGames: 1,
      playoffWins: 0,
    });
    expect(eagles.pointsFor).toBe(820);
    expect(wolves).toMatchObject({ games: 1, losses: 1, playoffGames: 0 });
  });

  it('ranks single-week scores and margins', () => {
    expect(weekRecords(games, { limit: 1 })[0].side.points).toBe(400);
    const margin = weekRecords(games, { by: 'margin', limit: 1 })[0];
    expect(margin.side.points - margin.opponent.points).toBe(300);
  });
});
