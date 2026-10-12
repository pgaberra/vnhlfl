"""Readers for `transcribed/`: games and trades read off the founder's Yahoo screenshots.

From 2024/25 the founder saved matchups and trades as screenshots pasted into the workbooks.
They were transcribed to CSV (one file per season and division for games, one per season for
trades) and are committed, since they hold team and player names only.

Yahoo's screenshots label playoff games only by bracket. Championship-bracket games get their
round from the week order (the last week is the final). In the consolation bracket, a game
between two semifinal losers is for 3rd place and one between two quarterfinal losers for 5th;
the rest are placement games.
"""

from __future__ import annotations

import csv
from collections import defaultdict
from datetime import date
from pathlib import Path

from .normalize import clean, season_id
from .sources import MatchRow, TradeRow

# Row numbers above this mark transcribed rows in warnings, apart from spreadsheet rows.
ROW_BASE = 100_000
CHAMPIONSHIP_ROUNDS = ["A-Final", "A-Semi", "A-Kvart"]


def _csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _is_bye(row: dict[str, str]) -> bool:
    """A playoff bye: a team with a score but no opponent. Not a game."""
    teams = {clean(row["home_team"]).lower(), clean(row["away_team"]).lower()}
    return bool(teams & {"bye", ""}) or not row["home_points"] or not row["away_points"]


def read_transcribed_matchups(folder: Path) -> list[MatchRow]:
    rows = [
        r for path in sorted(folder.glob("matches_*.csv")) for r in _csv(path) if not _is_bye(r)
    ]
    champ_weeks: dict[tuple[str, str], set[int]] = defaultdict(set)
    for r in rows:
        if clean(r["bracket"]).lower() == "championship":
            champ_weeks[(season_id(r["season"]), clean(r["division"]))].add(int(r["week"]))

    def champ_round(season: str, division: str, week: int) -> str:
        latest_first = sorted(champ_weeks[(season, division)], reverse=True)
        return CHAMPIONSHIP_ROUNDS[min(latest_first.index(week), 2)]

    # Yahoo lists the games for 3rd and 5th place under "Consolation"; they are the games
    # between two semifinal losers and between two quarterfinal losers.
    lost_in: dict[tuple[str, str, str], str] = {}
    for r in rows:
        if clean(r["bracket"]).lower() != "championship":
            continue
        season, division = season_id(r["season"]), clean(r["division"])
        loser = (
            r["home_team"] if float(r["home_points"]) < float(r["away_points"]) else r["away_team"]
        )
        lost_in[(season, division, clean(loser))] = champ_round(season, division, int(r["week"]))

    out = []
    for i, r in enumerate(rows, start=ROW_BASE):
        season, division, week = season_id(r["season"]), clean(r["division"]), int(r["week"])
        bracket = clean(r["bracket"]).lower()
        if bracket == "regular":
            stage = "Grund"
        elif bracket == "championship":
            stage = champ_round(season, division, week)
        elif bracket == "consolation":
            rounds = {
                lost_in.get((season, division, clean(r[t])), "") for t in ("home_team", "away_team")
            }
            same_round = rounds.pop() if len(rounds) == 1 else ""
            stage = {"A-Semi": "3-4", "A-Kvart": "5-6"}.get(same_round, "Placering")
        else:
            raise ValueError(f"{r['file']}: unknown bracket {r['bracket']!r}")
        out.append(
            MatchRow(
                row=i,
                season=season,
                division=division,
                week=week,
                stage=stage,
                home=clean(r["home_team"]),
                away=clean(r["away_team"]),
                home_points=float(r["home_points"]),
                away_points=float(r["away_points"]),
            )
        )
    return out


def read_transcribed_trades(folder: Path) -> list[TradeRow]:
    rows = [r for path in sorted(folder.glob("trades_*.csv")) for r in _csv(path)]

    def players(text: str) -> list[str]:
        return [clean(p) for p in text.split(";") if clean(p)]

    return [
        TradeRow(
            row=i,
            season=season_id(r["season"]),
            division=clean(r["division"]),
            week=None,
            day=date.fromisoformat(r["date"]) if r["date"] else None,
            team_a=clean(r["team_a"]),
            team_b=clean(r["team_b"]),
            a_receives=players(r["a_receives"]),
            b_receives=players(r["b_receives"]),
            status=clean(r["status"]).lower(),
        )
        for i, r in enumerate(rows, start=ROW_BASE)
    ]
