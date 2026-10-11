"""Readers for the founder's workbooks.

Each reader looks columns up by header text rather than position, returns plain records and
leaves every judgement (who owns a team, which alias means which team) to `build.py`.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import openpyxl

from .normalize import clean, key, season_id

FINAL_ROUND = "final"


@dataclass(frozen=True)
class StandingRow:
    season: str
    division: str
    round: int | str  # week number, or FINAL_ROUND for the end-of-season table
    rank: int
    clinched: bool  # the `*` Yahoo puts in front of a playoff team's rank
    team: str
    wins: int
    losses: int
    ties: int
    points_for: float | None
    fab: int | None
    waiver: int | None
    moves: int | None


@dataclass(frozen=True)
class PickRow:
    season: str
    division: str
    team: str
    round: int
    overall: int | None
    player: str
    adp_yahoo: float | None
    adp_league: float | None
    adp_kkupfl: float | None
    bid: int | None


@dataclass(frozen=True)
class TradeRow:
    row: int
    season: str
    division: str
    week: int | None
    day: date | None
    team_a: str
    team_b: str
    a_receives: list[str]
    b_receives: list[str]
    status: str  # completed | vetoed | countered | cancelled


@dataclass(frozen=True)
class Replacement:
    season: str
    day: date | None
    old_team: str
    new_team: str


@dataclass
class Owners:
    """Team name -> manager, from the `Namn och lag` workbook. Names never leave the pipeline."""

    by_team: dict[str, str] = field(default_factory=dict)  # key(team) -> manager full name
    team_names: dict[str, list[str]] = field(default_factory=dict)  # key(manager) -> names


def _rows(path: Path, sheet: str) -> Iterator[tuple[int, dict[str, Any]]]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        worksheet = workbook[sheet]
        rows = worksheet.iter_rows(values_only=True)
        # A column without a header is addressed by position, e.g. `#0`.
        header = [clean(h) if h is not None else "" for h in next(rows)]
        header = [h or f"#{i}" for i, h in enumerate(header)]
        for number, values in enumerate(rows, start=2):
            if all(v is None or clean(v) == "" for v in values):
                continue
            yield number, dict(zip(header, values, strict=False))
    finally:
        workbook.close()


def _missing(value: Any) -> bool:
    return value is None or clean(value) in {"", "#N/A", "#VALUE!", "#REF!", "-", "?"}


def _int(value: Any) -> int | None:
    if _missing(value):
        return None
    text = clean(value).lstrip("$*")
    return int(float(text))


def _float(value: Any) -> float | None:
    if _missing(value):
        return None
    return float(clean(value).replace(",", "."))


def _soft_float(value: Any) -> float | None:
    """For nice-to-have columns (ADP): a stray note in the cell means unknown, not an error."""
    try:
        return _float(value)
    except ValueError:
        return None


def _day(value: Any) -> date | None:
    if _missing(value):
        return None
    text = clean(value)
    if re.fullmatch(r"\d{8}(\.0)?", text):
        return date(int(text[:4]), int(text[4:6]), int(text[6:8]))
    raise ValueError(f"Unrecognised date: {value!r}")


def read_standings(path: Path) -> list[StandingRow]:
    out: list[StandingRow] = []
    for number, row in _rows(path, "Tabell"):
        try:
            round_value = clean(row["omgång"])
            record = clean(row["WLT"]).split("-")
            rank_text = clean(row["Placering"])
            out.append(
                StandingRow(
                    season=season_id(row["Säsong"]),
                    division=clean(row["Div"]),
                    round=FINAL_ROUND if round_value.lower() == "sluttabell" else int(round_value),
                    rank=int(rank_text.lstrip("*")),
                    clinched=rank_text.startswith("*"),
                    team=clean(row["Lag"]),
                    wins=int(record[0]),
                    losses=int(record[1]),
                    ties=int(record[2]) if len(record) > 2 else 0,
                    points_for=_float(row.get("FP")),
                    fab=_int(row.get("FAB")),
                    waiver=_int(row.get("Waiver")),
                    moves=_int(row.get("Moves")),
                )
            )
        except (KeyError, ValueError, IndexError) as error:
            raise ValueError(f"Tabell row {number}: {error}") from error
    return out


def read_picks(path: Path) -> list[PickRow]:
    out: list[PickRow] = []
    for number, row in _rows(path, "Draft"):
        # `Unused` and the auction drafts' `Budget kvar` (money left) are summary rows, not picks.
        if not clean(row.get("Runda")).isdigit():
            continue
        try:
            out.append(
                PickRow(
                    season=season_id(row["Säsong"]),
                    division=clean(row["Division"]),
                    team=clean(row["Lag"]),
                    round=int(clean(row["Runda"])),
                    overall=_int(row.get("Ov all")),
                    player=clean(row["Spelare"]),
                    adp_yahoo=_soft_float(row.get("ADP Yahoo")),
                    adp_league=_soft_float(row.get("ADP VNHLFL")),
                    adp_kkupfl=_soft_float(row.get("ADP KKUPFL")),
                    bid=_int(row.get("Budvärde")),
                )
            )
        except (KeyError, ValueError) as error:
            raise ValueError(f"Draft row {number}: {error}") from error
    return out


def split_players(value: Any) -> list[str]:
    if _missing(value):
        return []
    return [clean(p) for p in re.split(r"[\n,]", str(value)) if clean(p)]


def _trade_status(done: Any, veto: Any) -> str:
    verdict = key(veto) if not _missing(veto) else ""
    if verdict == "ja":
        return "vetoed"
    if verdict == "counter":
        return "countered"
    return "completed" if _int(done) == 1 else "cancelled"


def read_trades(path: Path) -> list[TradeRow]:
    out: list[TradeRow] = []
    for number, row in _rows(path, "Trades"):
        if _missing(row.get("Säsong")) or _missing(row.get("Lag 1")):
            continue
        # The first column has no header; it is 1 for a trade that went through.
        done = row.get("#0")
        try:
            out.append(
                TradeRow(
                    row=number,
                    season=season_id(row["Säsong"]),
                    division=clean(row["Division"]),
                    week=_int(row.get("Week")),
                    day=_day(row.get("Datum")),
                    team_a=clean(row["Lag 1"]),
                    team_b=clean(row["Lag 2"]),
                    a_receives=split_players(row.get("Lag 1 får")),
                    b_receives=split_players(row.get("Lag 2 får")),
                    status=_trade_status(done, row.get("Veto")),
                )
            )
        except (KeyError, ValueError) as error:
            raise ValueError(f"Trades row {number}: {error}") from error
    return out


def read_owners(path: Path) -> Owners:
    owners = Owners()

    def add(team: Any, manager: Any) -> None:
        if _missing(team) or _missing(manager):
            return
        team_key, manager_name = key(team), clean(manager)
        owners.by_team.setdefault(team_key, manager_name)
        names = owners.team_names.setdefault(key(manager_name), [])
        if clean(team) not in names:
            names.append(clean(team))

    for _, row in _rows(path, "lagnamn"):
        add(row.get("Lagnamn"), row.get("Namn"))
    for _, row in _rows(path, "GMs"):
        add(row.get("Lagnamn"), row.get("Namn"))
    return owners


def read_replacements(path: Path) -> list[Replacement]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        # The sheet is called `Ersättare`; looked up by prefix since the name has an ä.
        sheet = next(ws for ws in workbook.worksheets if ws.title.lower().startswith("ers"))
        rows = list(sheet.iter_rows(values_only=True))[1:]
    finally:
        workbook.close()
    return [
        Replacement(season_id(r[0]), _day(r[1]), clean(r[2]), clean(r[3]))
        for r in rows
        if r and not _missing(r[0]) and not _missing(r[2])
    ]
