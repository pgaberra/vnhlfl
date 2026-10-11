import pytest

from vnhlfl_pipeline.normalize import clean, key, season_id, season_label, slug


def test_clean_trims_nbsp_and_straightens_apostrophes() -> None:
    assert clean("\xa0Jesper\u00b4s  Impressive Team ") == "Jesper's Impressive Team"


def test_key_ignores_case_accents_apostrophes_and_emoji() -> None:
    assert key("Gåxsjö HockeyHeads 🏒") == key("gaxsjo hockeyheads")
    assert key("Victor's Team") == "victors team"
    assert key("Bamsingarna!") == key("Bamsingarna")
    assert key("Boomtown Rats/CC Cowboys") == "boomtown rats cc cowboys"


def test_key_keeps_an_emoji_only_name_distinct() -> None:
    assert key("🌳") != key("🪨🌊")
    assert key("🌳") != ""


def test_slug() -> None:
    assert slug("Gåxsjö Hockey Heads") == "gaxsjo-hockey-heads"
    assert slug("Pac-man's dreamteam") == "pac-mans-dreamteam"


@pytest.mark.parametrize("raw", ["2021/2022", "21/22", "2021-22", " 2021 / 2022 "])
def test_season_id_accepts_every_spelling(raw: str) -> None:
    assert season_id(raw) == "2021-22"


def test_season_id_rejects_garbage() -> None:
    with pytest.raises(ValueError):
        season_id("last year")


def test_season_label() -> None:
    assert season_label("2024-25") == "2024/25"
