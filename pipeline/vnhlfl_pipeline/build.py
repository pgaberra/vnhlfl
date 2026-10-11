"""Assembles the league model from the raw rows.

The central decision is identity. A row names a *team*, but the site follows a *manager*, whose
team name changes between (and sometimes within) seasons. `Namn och lag` maps every team name to
a manager; a team-season is then one manager in one season. A manager's public id is the slug of
the first team name they played under, so it never changes and never contains a real name.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from difflib import get_close_matches
from pathlib import Path
from typing import Any, Literal

from .normalize import key, season_label, slug
from .resolve import Candidate, TeamResolver, read_overrides
from .sources import (
    FINAL_ROUND,
    Owners,
    PickRow,
    Replacement,
    StandingRow,
    TradeRow,
    read_owners,
    read_picks,
    read_replacements,
    read_standings,
    read_trades,
)

NameMode = Literal["team", "full"]
DRAFT_ORDER = -1
FINAL_ORDER = 10_000


@dataclass
class Report:
    warnings: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def warn(self, message: str) -> None:
        self.warnings.append(message)


@dataclass
class Sources:
    standings: list[StandingRow]
    picks: list[PickRow]
    trades: list[TradeRow]
    owners: Owners
    replacements: list[Replacement]
    overrides: list[tuple[str, str, str]]


def load(source_dir: Path, curation_dir: Path) -> Sources:
    owners_file = source_dir / "Namn och lag.xlsx"
    return Sources(
        standings=read_standings(source_dir / "Tabell.xlsx"),
        picks=read_picks(source_dir / "Draft.xlsx"),
        trades=read_trades(source_dir / "Trades.xlsx"),
        owners=read_owners(owners_file),
        replacements=read_replacements(owners_file),
        overrides=read_overrides(curation_dir / "team-aliases.csv"),
    )


def display_team(name: str) -> str:
    """Published team name: drops the `(?)` the founder put after uncertain names."""
    return re.sub(r"\s*\(\?\)$", "", name)


def unique_names(names: list[str]) -> list[str]:
    """First-seen order, one entry per name ignoring case, accents and stray spaces (the sheets
    have `Tea mstoof`); the latest spelling wins."""

    def same(name: str) -> str:
        return key(display_team(name)).replace(" ", "")

    latest = {same(n): display_team(n) for n in names}
    return list(dict.fromkeys(latest[same(n)] for n in names))


def tier_of(division: str) -> int | None:
    match = re.match(r"div\s*(\d)", key(division))
    return int(match.group(1)) if match else None


def division_id(season: str, division: str) -> str:
    return f"{season}-{slug(division)}"


@dataclass
class _TeamSeason:
    """One manager running one team in one division for (part of) a season.

    Keyed by division as well as manager because a GM can move mid-season: in 2024/25 one GM
    left their Div 3 team to take over an abandoned Div 2 team.
    """

    season: str
    division: str
    manager: str  # manager key; a real name, so it never reaches the output
    names: list[tuple[int, str]] = field(default_factory=list)  # (order, name)
    id: str = ""

    def name_now(self) -> str:
        return max(self.names)[1]


class LeagueBuilder:
    def __init__(self, sources: Sources, name_mode: NameMode = "team"):
        self.src = sources
        self.name_mode = name_mode
        self.report = Report()
        self.team_seasons: dict[tuple[str, str, str], _TeamSeason] = {}
        self.manager_ids: dict[str, str] = {}  # manager key -> public id
        self.manager_names: dict[str, str] = {}  # manager key -> real name (full mode only)
        self._unknown: set[str] = set()
        self._resolver: TeamResolver | None = None

    # ---- identity -------------------------------------------------------------------------

    def manager_of(self, team: str) -> str:
        owner = self.src.owners.by_team.get(key(team))
        if owner:
            self.manager_names.setdefault(key(owner), owner)
            return key(owner)
        if key(team) not in self._unknown:
            self._unknown.add(key(team))
            self.report.warn(f"No manager listed for team '{team}'; treating it as its own GM")
        return f"team:{key(team)}"

    def _collect(self) -> None:
        appearances: list[tuple[str, str, str, int]] = []
        for row in self.src.standings:
            order = FINAL_ORDER if row.round == FINAL_ROUND else int(row.round)
            appearances.append((row.season, row.division, row.team, order))
        appearances += [(p.season, p.division, p.team, DRAFT_ORDER) for p in self.src.picks]

        for season, division, team, order in appearances:
            manager = self.manager_of(team)
            ts = self.team_seasons.setdefault(
                (season, division, manager), _TeamSeason(season, division, manager)
            )
            if (order, team) not in ts.names:
                ts.names.append((order, team))

        firsts: dict[str, tuple[str, int, str]] = {}
        for ts in self.team_seasons.values():
            first_order, first_name = min(ts.names)
            current = firsts.get(ts.manager)
            if current is None or (ts.season, first_order) < current[:2]:
                firsts[ts.manager] = (ts.season, first_order, first_name)
        taken: set[str] = set()
        for manager, (_, _, first_name) in sorted(firsts.items(), key=lambda kv: kv[1]):
            base = slug(first_name) or "gm"
            candidate, n = base, 2
            while candidate in taken:
                candidate, n = f"{base}-{n}", n + 1
            taken.add(candidate)
            self.manager_ids[manager] = candidate
        per_season = Counter((ts.season, ts.manager) for ts in self.team_seasons.values())
        for ts in self.team_seasons.values():
            ts.id = f"{ts.season}:{self.manager_ids[ts.manager]}"
            if per_season[(ts.season, ts.manager)] > 1:
                ts.id += f"@{slug(ts.division)}"

    def team_id(self, season: str, division: str, team: str) -> str | None:
        ts = self.team_seasons.get((season, division, self.manager_of(team)))
        return ts.id if ts else None

    def resolver(self) -> TeamResolver:
        if self._resolver is None:
            self._resolver = self._make_resolver()
        return self._resolver

    def _make_resolver(self) -> TeamResolver:
        all_names: dict[str, set[str]] = defaultdict(set)
        for ts in self.team_seasons.values():
            all_names[ts.manager] |= {key(n) for _, n in ts.names}
        for manager, names in self.src.owners.team_names.items():
            all_names[manager] |= {key(n) for n in names}
        candidates = []
        for ts in self.team_seasons.values():
            real = self.manager_names.get(ts.manager, "")
            person_words = {w for w in key(real).split() if len(w) >= 3}
            candidates.append(
                Candidate(ts.id, ts.season, ts.division, set(all_names[ts.manager]), person_words)
            )
        overrides: dict[tuple[str, str], str] = {}
        for season, alias, team in self.src.overrides:
            match = [c.team_id for c in candidates if c.season == season and key(team) in c.names]
            if len(match) == 1:
                overrides[(season, key(alias))] = match[0]
            else:
                self.report.warn(
                    f"Override {season} '{alias}' -> '{team}' matches {len(match)} teams"
                )
        return TeamResolver(candidates, overrides)

    # ---- output ---------------------------------------------------------------------------

    def build(self) -> dict[str, dict[str, Any]]:
        self._collect()
        teams = self._teams()
        league: dict[str, Any] = {
            "nameMode": self.name_mode,
            "seasons": self._seasons(teams),
            "managers": self._managers(),
            "teams": teams,
        }
        standings = {"snapshots": self._snapshots()}
        draft = {"drafts": self._drafts()}
        trades = self._trades()
        league["coverage"] = {
            "finalStandings": sorted(
                {r.season for r in self.src.standings if r.round == FINAL_ROUND}
            ),
            "weeklyStandings": sorted(
                {r.season for r in self.src.standings if r.round != FINAL_ROUND}
            ),
            "draft": sorted({p.season for p in self.src.picks}),
            "trades": sorted({t["seasonId"] for t in trades["trades"]}),
            "matchups": [],
        }
        return {"league": league, "standings": standings, "draft": draft, "trades": trades}

    def _final_rows(self) -> dict[str, StandingRow]:
        out: dict[str, StandingRow] = {}
        for row in self.src.standings:
            if row.round != FINAL_ROUND:
                continue
            tid = self.team_id(row.season, row.division, row.team)
            if tid is None:
                continue
            if tid in out:
                self.report.warn(f"{row.season}: two final rows for '{row.team}'")
            out[tid] = row
        return out

    def _teams(self) -> list[dict[str, Any]]:
        finals = self._final_rows()
        links = self._replacement_links()
        out = []
        for ts in sorted(self.team_seasons.values(), key=lambda t: t.id):
            final = finals.get(ts.id)
            names_in_order = unique_names([n for _, n in sorted(ts.names)])
            name = display_team(final.team if final else ts.name_now())
            team: dict[str, Any] = {
                "id": ts.id,
                "seasonId": ts.season,
                "divisionId": division_id(ts.season, ts.division),
                "managerId": self.manager_ids[ts.manager],
                "name": name,
                "otherNames": [n for n in names_in_order if key(n) != key(name)],
                "final": _standing(final) if final else None,
            }
            team.update(links.get(ts.id, {}))
            orders = {order for order, _ in ts.names}
            if not ({DRAFT_ORDER, FINAL_ORDER} & orders or links.get(ts.id)):
                self.report.warn(
                    f"{ts.season} {ts.division}: '{name}' is only in weekly tables and no"
                    " replacement explains it; wrong division in a row?"
                )
            out.append(team)
        return out

    def _seasons(self, teams: list[dict[str, Any]]) -> list[dict[str, Any]]:
        bids = {division_id(p.season, p.division) for p in self.src.picks if p.bid is not None}
        drafted = {division_id(p.season, p.division) for p in self.src.picks}
        by_division: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for team in teams:
            by_division[team["divisionId"]].append(team)
        divisions: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
        for ts in self.team_seasons.values():
            name = ts.division
            did = division_id(ts.season, name)
            members = sorted(by_division[did], key=lambda t: (t["final"] or {}).get("rank", 99))
            divisions[ts.season][did] = {
                "id": did,
                "name": name,
                "tier": tier_of(name),
                "draftFormat": "auction" if did in bids else "snake" if did in drafted else None,
                "teamIds": [t["id"] for t in members],
            }
        return [
            {
                "id": season,
                "label": season_label(season),
                "divisions": sorted(
                    divisions[season].values(), key=lambda d: (d["tier"] or 0, d["name"])
                ),
            }
            for season in sorted(divisions)
        ]

    def _managers(self) -> list[dict[str, Any]]:
        by_manager: dict[str, list[_TeamSeason]] = defaultdict(list)
        for ts in self.team_seasons.values():
            by_manager[ts.manager].append(ts)
        out = []
        for manager, seasons in by_manager.items():
            # Oldest first; within a season the team the GM finished with comes last.
            seasons.sort(key=lambda t: (t.season, max(order for order, _ in t.names)))
            names = unique_names([n for ts in seasons for _, n in sorted(ts.names)])
            current = key(seasons[-1].name_now())
            entry: dict[str, Any] = {
                "id": self.manager_ids[manager],
                "name": next(n for n in names if key(n) == current),
                "teamNames": names,
            }
            if self.name_mode == "full" and manager in self.manager_names:
                entry["realName"] = self.manager_names[manager]
            out.append(entry)
        return sorted(out, key=lambda m: m["id"])

    def _snapshots(self) -> list[dict[str, Any]]:
        groups: dict[tuple[str, str, int], list[StandingRow]] = defaultdict(list)
        for row in self.src.standings:
            if row.round != FINAL_ROUND:
                groups[(row.season, row.division, int(row.round))].append(row)
        out = []
        for (season, division, week), rows in sorted(groups.items()):
            seen: set[str] = set()
            table = []
            for row in sorted(rows, key=lambda r: r.rank):
                tid = self.team_id(season, division, row.team)
                if tid is None or tid in seen:
                    self.report.warn(f"{season} {division} week {week}: duplicate '{row.team}'")
                    continue
                seen.add(tid)
                table.append({"teamId": tid, **_record(row)})
            if len(table) < 10:
                self.report.notes.append(
                    f"{season} {division} week {week}: only {len(table)} teams in snapshot"
                )
            out.append({"divisionId": division_id(season, division), "round": week, "rows": table})
        return out

    def _drafts(self) -> list[dict[str, Any]]:
        groups: dict[tuple[str, str], list[PickRow]] = defaultdict(list)
        for pick in self.src.picks:
            groups[(pick.season, pick.division)].append(pick)
        out = []
        for (season, division), picks in sorted(groups.items()):
            auction = any(p.bid is not None for p in picks)
            rows = []
            for p in sorted(picks, key=lambda p: (p.overall or 10_000, p.round)):
                tid = self.team_id(season, division, p.team)
                if tid is None:
                    continue
                rows.append(
                    {
                        "teamId": tid,
                        "round": p.round,
                        "overall": p.overall,
                        "player": p.player,
                        "adpYahoo": _round(p.adp_yahoo),
                        "adpLeague": _round(p.adp_league),
                        "bid": p.bid,
                    }
                )
            out.append(
                {
                    "divisionId": division_id(season, division),
                    "format": "auction" if auction else "snake",
                    "picks": rows,
                }
            )
        return out

    def _trades(self) -> dict[str, Any]:
        resolver = self.resolver()
        canonical = {key(p.player): p.player for p in self.src.picks}
        canonical_keys = list(canonical)

        def player(name: str) -> str:
            k = key(name)
            if k in canonical:
                return canonical[k]
            close = get_close_matches(k, canonical_keys, n=1, cutoff=0.88)
            return canonical[close[0]] if close else name

        out = []
        per_season: Counter[str] = Counter()
        for row in sorted(self.src.trades, key=lambda r: (r.season, r.day or r.row, r.row)):
            a = resolver.resolve(row.season, row.division, row.team_a)
            b = resolver.resolve(row.season, row.division, row.team_b)
            if a is None or b is None or a == b:
                missing = [t for t, tid in ((row.team_a, a), (row.team_b, b)) if tid is None]
                why = f"can't place {missing}" if missing else "both sides are the same team"
                self.report.warn(
                    f"Trades row {row.row} ({row.season} {row.division}): {why}; skipped"
                )
                continue
            per_season[row.season] += 1
            out.append(
                {
                    "id": f"{row.season}-{per_season[row.season]:03d}",
                    "seasonId": row.season,
                    "divisionId": division_id(row.season, row.division),
                    "week": row.week,
                    "date": row.day.isoformat() if row.day else None,
                    "status": row.status,
                    "sides": [
                        {"teamId": a, "receives": [player(p) for p in row.a_receives]},
                        {"teamId": b, "receives": [player(p) for p in row.b_receives]},
                    ],
                }
            )
        return {"trades": out}

    def _replacement_links(self) -> dict[str, dict[str, Any]]:
        resolver = self.resolver()
        division_of = {ts.id: ts.division for ts in self.team_seasons.values()}
        links: dict[str, dict[str, Any]] = defaultdict(dict)
        for rep in self.src.replacements:
            # The sheet gives no division, and a GM who moved mid-season matches two teams, so
            # pair the old and new team inside one division.
            pairs = [
                (old, new)
                for old in resolver.candidates(rep.season, "", rep.old_team)
                for new in resolver.candidates(rep.season, "", rep.new_team)
                if old != new and division_of[old] == division_of[new]
            ]
            if len(pairs) != 1:
                self.report.warn(
                    f"Replacement {rep.season} '{rep.old_team}' -> '{rep.new_team}' not linked"
                    f" ({len(pairs)} possible pairs)"
                )
                continue
            old, new = pairs[0]
            day = rep.day.isoformat() if rep.day else None
            links[old]["replacedBy"] = {"teamId": new, "date": day}
            links[new]["replaces"] = {"teamId": old, "date": day}
        return links


def _record(row: StandingRow) -> dict[str, Any]:
    return {
        "rank": row.rank,
        "clinched": row.clinched,
        "wins": row.wins,
        "losses": row.losses,
        "ties": row.ties,
        "pointsFor": row.points_for,
    }


def _standing(row: StandingRow) -> dict[str, Any]:
    return {**_record(row), "fab": row.fab, "waiver": row.waiver, "moves": row.moves}


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, 1)
