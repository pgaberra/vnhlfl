"""Resolver cases. Every team and person here is invented; the shapes mirror the real trade log."""

from vnhlfl_pipeline.normalize import key
from vnhlfl_pipeline.resolve import Candidate, TeamResolver, score


def team(team_id: str, *names: str, person: str = "", division: str = "D1") -> Candidate:
    return Candidate(
        team_id, "2023-24", division, {key(n) for n in names}, set(key(person).split())
    )


BLIXT = team("blixt", "Blixtmacka HC", person="Fredrik Fiktiv")
COLD = team("cold", "Too cold to Hold", person="Gustav Påhitt")
SJOBY = team("sjoby", "Sjöby Boys", person="Holger Påhitt")
TESTA = team("testa", "Chuck Testa Sjöby boys", person="Ivar Påhitt")
OLD_NAME = team("kanon", "Norrby Kanoner", "Söderby Kanoner", person="Jarl Påhitt")


def resolver(
    *candidates: Candidate, overrides: dict[tuple[str, str], str] | None = None
) -> TeamResolver:
    return TeamResolver(list(candidates), overrides or {})


def test_prefix_beats_a_word_inside_another_name() -> None:
    r = resolver(BLIXT, COLD, SJOBY, TESTA, OLD_NAME)
    assert r.resolve("2023-24", "D1", "blixt") == "blixt"
    assert r.resolve("2023-24", "D1", "Sjöby") == "sjoby"
    assert r.resolve("2023-24", "D1", "Chuck Testa") == "testa"


def test_acronym() -> None:
    assert score("tcth", COLD) >= 85
    assert resolver(BLIXT, COLD).resolve("2023-24", "D1", "TCTH") == "cold"


def test_a_name_from_another_season_counts() -> None:
    assert resolver(BLIXT, OLD_NAME).resolve("2023-24", "D1", "Söderby") == "kanon"


def test_the_managers_first_name_counts() -> None:
    assert resolver(BLIXT, COLD).resolve("2023-24", "D1", "Fredrik") == "blixt"


def test_generic_words_do_not_match_everything() -> None:
    assert score(key("Klaras team"), BLIXT) < 60


def test_ambiguous_alias_resolves_to_nothing() -> None:
    twin = team("twin", "Blixtmacka Juniors")
    r = resolver(BLIXT, twin)
    assert r.resolve("2023-24", "D1", "blixtmacka") is None
    assert sorted(r.candidates("2023-24", "D1", "blixtmacka")) == ["blixt", "twin"]


def test_falls_back_to_the_whole_season_when_the_division_has_no_match() -> None:
    elsewhere = team("other", "Kalmar Bagpipes", division="D2")
    assert resolver(BLIXT, elsewhere).resolve("2023-24", "D1", "Kalmar") == "other"


def test_override_wins() -> None:
    r = resolver(BLIXT, COLD, overrides={("2023-24", "umea"): "cold"})
    assert r.resolve("2023-24", "D1", "Umeå") == "cold"


def test_unknown_alias_resolves_to_nothing() -> None:
    assert resolver(BLIXT, COLD).resolve("2023-24", "D1", "Zebras") is None


def test_a_typo_in_the_full_team_name_beats_a_shared_first_name() -> None:
    swell = team("swell", "Jonas's Swell Team", person="Jonas Fiktiv")
    attack = team("attack", "Mac-attack", person="Jonaz Annan")
    assert resolver(swell, attack).resolve("2023-24", "D1", "Jonaz Swell Team") == "swell"
