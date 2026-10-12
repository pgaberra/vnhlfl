from pathlib import Path

from vnhlfl_pipeline.transcribed import read_transcribed_matchups, read_transcribed_trades

MATCHES = """season,division,week,bracket,home_team,home_points,away_team,away_points,file
2024-25,Div 9 Test,1,regular,Alpha,200.5,Beta,150,01.png
2024-25,Div 9 Test,22,championship,Alpha,100,Gamma,90,22.png
2024-25,Div 9 Test,22,championship,Beta,100,Eps,90,22.png
2024-25,Div 9 Test,23,championship,Alpha,100,Delta,90,23.png
2024-25,Div 9 Test,23,championship,Beta,100,Zeta,90,23.png
2024-25,Div 9 Test,23,consolation,Gamma,100,Eps,90,23.png
2024-25,Div 9 Test,24,championship,Alpha,100,Beta,90,24.png
2024-25,Div 9 Test,24,consolation,Delta,100,Zeta,90,24.png
2024-25,Div 9 Test,24,consolation,Gamma,100,Omega,90,24.png
2024-25,Div 9 Test,22,championship,Beta,190.5,Bye,,22.png
"""

TRADES = """season,division,date,status,team_a,a_receives,team_b,b_receives,file
2024-25,Div 9 Test,2025-02-28,completed,Alpha,"Player One; Player Two",Beta,Player Three,x/01.png
2024-25,Div 9 Test,2025-01-24,vetoed,Beta,Player Four,Alpha,,x/01.png
"""


def test_championship_rounds_come_from_the_week_order(tmp_path: Path) -> None:
    (tmp_path / "matches_2024-25_Div_9_Test.csv").write_text(MATCHES, encoding="utf-8")
    games = read_transcribed_matchups(tmp_path)
    assert [g.stage for g in games] == [
        "Grund",
        "A-Kvart",
        "A-Kvart",
        "A-Semi",
        "A-Semi",
        "5-6",
        "A-Final",
        "3-4",
        "Placering",
    ]
    assert games[0].home_points == 200.5
    assert games[0].season == "2024-25"


def test_trades_split_players_and_keep_status(tmp_path: Path) -> None:
    (tmp_path / "trades_2024-25.csv").write_text(TRADES, encoding="utf-8")
    first, vetoed = read_transcribed_trades(tmp_path)
    assert first.a_receives == ["Player One", "Player Two"]
    assert first.b_receives == ["Player Three"]
    assert first.day is not None and first.day.isoformat() == "2025-02-28"
    assert (vetoed.status, vetoed.b_receives) == ("vetoed", [])
