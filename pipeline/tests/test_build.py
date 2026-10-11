import json
from pathlib import Path
from typing import Any

import pytest

from vnhlfl_pipeline.__main__ import main
from vnhlfl_pipeline.build import LeagueBuilder, load

from .workbooks import write_league

REAL_NAMES = ["Anna", "Alfa", "Bertil", "Cecilia", "Doris", "Erik Epsilon"]


@pytest.fixture
def built(tmp_path: Path) -> tuple[dict[str, dict[str, Any]], LeagueBuilder]:
    write_league(tmp_path)
    builder = LeagueBuilder(load(tmp_path, tmp_path / "no-curation"))
    return builder.build(), builder


def teams_by_name(files: dict[str, dict[str, Any]], season: str) -> dict[str, dict[str, Any]]:
    return {t["name"]: t for t in files["league"]["teams"] if t["seasonId"] == season}


def test_a_manager_is_followed_across_team_names(built: Any) -> None:
    files, _ = built
    managers = {m["id"]: m for m in files["league"]["managers"]}
    anna = managers["alpha-wolves"]  # id = first team name, stable across renames
    assert anna["name"] == "Alpha Dogs"  # shown under the latest name
    assert anna["teamNames"] == ["Alpha Wolves", "Alpha Dogs"]
    assert teams_by_name(files, "2022-23")["Alpha Dogs"]["managerId"] == "alpha-wolves"


def test_final_standings_are_parsed(built: Any) -> None:
    files, _ = built
    wolves = teams_by_name(files, "2021-22")["Alpha Wolves"]["final"]
    assert wolves == {
        "rank": 1,
        "clinched": True,
        "wins": 15,
        "losses": 6,
        "ties": 0,
        "pointsFor": 4000.25,
        "fab": 10,
        "waiver": 2,
        "moves": 30,
    }
    eagles = teams_by_name(files, "2021-22")["Epsilon Eagles"]
    assert eagles["final"]["clinched"] is False


def test_divisions_carry_tier_and_draft_format(built: Any) -> None:
    files, _ = built
    seasons = {s["id"]: s for s in files["league"]["seasons"]}
    first = seasons["2021-22"]["divisions"][0]
    gretzky = seasons["2022-23"]["divisions"][0]
    assert (first["tier"], first["draftFormat"]) == (None, "snake")
    assert (gretzky["tier"], gretzky["draftFormat"]) == (1, "auction")
    assert [t.split(":")[1] for t in first["teamIds"]] == [
        "alpha-wolves",
        "beta-bears",
        "epsilon-eagles",
    ]


def test_mid_season_replacement_links_both_teams(built: Any) -> None:
    files, builder = built
    teams = teams_by_name(files, "2022-23")
    goats, force = teams["Gamma Goats"], teams["Delta Force"]
    assert goats["final"] is None
    assert goats["replacedBy"] == {"teamId": force["id"], "date": "2022-12-01"}
    assert force["replaces"] == {"teamId": goats["id"], "date": "2022-12-01"}
    assert builder.report.warnings == []


def test_trades_resolve_aliases_and_canonicalise_players(built: Any) -> None:
    files, _ = built
    trades = files["trades"]["trades"]
    assert [t["status"] for t in trades] == ["completed", "vetoed", "completed"]
    first = trades[0]
    assert first["date"] == "2021-11-03"
    assert first["sides"][0]["teamId"] == "2021-22:alpha-wolves"
    assert first["sides"][1] == {"teamId": "2021-22:beta-bears", "receives": ["Connor McDavid"]}
    assert first["sides"][0]["receives"] == ["Leon Draisaitl", "Mark Stone"]
    third = trades[2]  # `Wolves` is last season's name; `Gamma` the team before the takeover
    assert third["sides"][0]["teamId"] == "2022-23:alpha-wolves"
    assert third["sides"][1]["teamId"] == "2022-23:gamma-goats"


def test_draft_skips_summary_rows_and_soft_fails_adp(built: Any) -> None:
    files, _ = built
    drafts = {d["divisionId"]: d for d in files["draft"]["drafts"]}
    gretzky = drafts["2022-23-div-1-gretzky"]
    assert gretzky["format"] == "auction"
    assert len(gretzky["picks"]) == 3
    matthews = drafts["2021-22-div-ett"]["picks"][2]
    assert (matthews["adpYahoo"], matthews["adpLeague"]) == (None, None)


def test_weekly_snapshots(built: Any) -> None:
    files, _ = built
    (snapshot,) = files["standings"]["snapshots"]
    assert snapshot["round"] == 5
    assert [r["rank"] for r in snapshot["rows"]] == [1, 2, 3]


def test_cli_writes_json_without_real_names(tmp_path: Path) -> None:
    write_league(tmp_path)
    out = tmp_path / "out"
    args = ["--source", str(tmp_path), "--out", str(out), "--curation", str(tmp_path)]
    assert main([*args, "--strict"]) == 0
    written = "".join(p.read_text(encoding="utf-8") for p in out.glob("*.json"))
    for name in REAL_NAMES:
        assert name not in written
    league = json.loads((out / "league.json").read_text(encoding="utf-8"))
    assert league["nameMode"] == "team"
    assert len(league["dataVersion"]) == 12


def test_full_name_mode_adds_real_names(tmp_path: Path) -> None:
    write_league(tmp_path)
    out = tmp_path / "out"
    main(
        [
            "--source",
            str(tmp_path),
            "--out",
            str(out),
            "--curation",
            str(tmp_path),
            "--names",
            "full",
        ]
    )
    league = json.loads((out / "league.json").read_text(encoding="utf-8"))
    names = {m["id"]: m.get("realName") for m in league["managers"]}
    assert names["alpha-wolves"] == "Anna Alfa"


def test_unique_names_merges_case_variants_and_drops_question_marks() -> None:
    from vnhlfl_pipeline.build import display_team, unique_names

    assert display_team("Njurunda Devils (?)") == "Njurunda Devils"
    assert unique_names(["Flippmacka HC", "FLIPPMACKA HC", "Other", "Flippmacka Hc"]) == [
        "Flippmacka Hc",
        "Other",
    ]
    assert unique_names(["Teamstoof", "Tea mstoof", "Teamstoof"]) == ["Teamstoof"]


def test_real_name_check_matches_whole_names_only() -> None:
    from vnhlfl_pipeline.__main__ import real_names_in

    texts = ['{"name": "Erik Epsilon United"}', '{"player": "Adam Foxworth"}']
    assert real_names_in(texts, ["Erik Epsilon", "Adam Fox", "Solo"]) == ["Erik Epsilon"]
