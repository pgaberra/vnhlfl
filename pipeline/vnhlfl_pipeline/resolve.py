"""Works out which team a hand-typed name means.

The trade log names teams the way managers talk about them: `flipp` for Flippmacka HC, `THTY`
for Too hot to Yandle, a first name, or last season's team name. The resolver scores every team
in the same season and division against the alias and only answers when one team clearly wins.
Anything it cannot settle goes in `curation/team-aliases.csv`.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

from .normalize import key, season_id


@dataclass
class Candidate:
    team_id: str
    season: str
    division: str
    names: set[str] = field(default_factory=set)  # matching keys of every name the team used
    person_words: set[str] = field(default_factory=set)  # manager first/last name, never output


# Words too common in team names to tell two teams apart.
STOPWORDS = {"team", "the", "hc", "if", "bk", "fc", "of", "on", "och", "boys", "veckans", "nhl"}


def _words(text: str) -> list[str]:
    return [w for w in text.split() if w not in STOPWORDS]


def _acronym(name: str) -> str:
    return "".join(word[0] for word in name.split() if word)


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def score(alias: str, candidate: Candidate) -> int:
    """0-100: how sure we are that `alias` (a matching key) names `candidate`."""
    if alias in candidate.names:
        return 100
    best = 0
    alias_words = _words(alias)
    for name in candidate.names:
        words = _words(name)
        if name.startswith(alias):
            best = max(best, 92)
        elif f" {alias} " in f" {name} ":
            best = max(best, 90)
        elif (
            f" {name} " in f" {alias} "
            or (alias_words and set(alias_words) <= set(words))
            or (len(alias) >= 3 and alias.replace(" ", "") == _acronym(name))
        ):
            best = max(best, 85)
        elif any(w.startswith(alias) for w in words) and len(alias) >= 4:
            best = max(best, 80)
        similarity = _similar(alias, name)
        if similarity >= 0.9:
            best = max(best, 88)  # the full name with a typo beats a shared first name
        elif similarity >= 0.8:
            best = max(best, 70)
        for a in alias_words:
            if len(a) >= 4 and any(len(w) >= 4 and _similar(a, w) >= 0.8 for w in words):
                best = max(best, 60)
    if alias in candidate.person_words or set(alias_words) & candidate.person_words:
        best = max(best, 75)
    elif len(alias) >= 4 and any(w.startswith(alias) for w in candidate.person_words):
        best = max(best, 70)  # `Nestor` for a manager called Nestorsson
    return best


class TeamResolver:
    def __init__(self, candidates: list[Candidate], overrides: dict[tuple[str, str], str]):
        self._candidates = candidates
        self._overrides = overrides  # (season, matching key) -> team_id

    def resolve(self, season: str, division: str, alias: str) -> str | None:
        """The one team `alias` means, or None when no team or more than one fits."""
        found = self.candidates(season, division, alias)
        return found[0] if len(found) == 1 else None

    def candidates(self, season: str, division: str, alias: str) -> list[str]:
        """Every team that fits `alias` equally best, looking in the division first."""
        alias_key = key(alias)
        if (season, alias_key) in self._overrides:
            return [self._overrides[(season, alias_key)]]
        in_division = [c for c in self._candidates if c.season == season and c.division == division]
        in_season = [c for c in self._candidates if c.season == season]
        for pool in (in_division, in_season):
            found = self._best(alias_key, pool)
            if found:
                return found
        return []

    @staticmethod
    def _best(alias: str, pool: list[Candidate]) -> list[str]:
        scored = sorted(((score(alias, c), c.team_id) for c in pool), reverse=True)
        if not scored or scored[0][0] < 60:
            return []
        return [team_id for points, team_id in scored if points == scored[0][0]]


def read_overrides(path: Path) -> list[tuple[str, str, str]]:
    """Rows of (season, alias, team name) from the curated CSV."""
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as handle:
        rows = [r for r in csv.DictReader(handle) if r.get("alias")]
    return [(season_id(r["season"]), r["alias"], r["team"]) for r in rows]
