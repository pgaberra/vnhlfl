"""Builds small fake versions of the founder's workbooks, so tests never need the real ones.

Every person and team here is invented. The shapes (sheet names, headers, odd cells such as
`*1`, `$8`, `Budget kvar` and non-breaking spaces) copy the real files.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import openpyxl

TABELL_HEADER = [
    "omgång",
    "Div",
    "Placering",
    "Lag",
    "WLT",
    "W%",
    "FP",
    "FAB",
    "Waiver",
    "Moves",
    "Säsong",
]


def _save(path: Path, sheets: dict[str, list[list[Any]]]) -> None:
    workbook = openpyxl.Workbook()
    workbook.remove(workbook.active)
    for title, rows in sheets.items():
        sheet = workbook.create_sheet(title)
        for row in rows:
            sheet.append(row)
    workbook.save(path)


def write_league(folder: Path) -> Path:
    """Two seasons, one division of three teams.

    - Anna Alfa plays as `Alpha Wolves`, renamed `Alpha Dogs` in season two.
    - Bertil Beta plays as `Beta Bears` both seasons.
    - Cecilia Gamma drafts `Gamma Goats` in season two, then hands the team to Doris Delta
      (`Delta Force`) mid-season.
    - Erik Epsilon plays only season one, as `\xa0Epsilon Eagles` (note the nbsp).
    """
    _save(
        folder / "Tabell.xlsx",
        {
            "Tabell": [
                TABELL_HEADER,
                [5, "Div Ett", 1, "Alpha Wolves", "4-1-0", ".800", 900.5, 72, 2, 5, "2021/2022"],
                [5, "Div Ett", 2, "Beta Bears", "3-2-0", ".600", 850.0, 80, 3, 4, "2021/2022"],
                [
                    5,
                    "Div Ett",
                    3,
                    "\xa0Epsilon Eagles",
                    "1-4-0",
                    ".200",
                    700.0,
                    90,
                    1,
                    1,
                    "2021/2022",
                ],
                [
                    "Sluttabell",
                    "Div Ett",
                    "*1",
                    "Alpha Wolves",
                    "15-6-0",
                    ".714",
                    4000.25,
                    "$10",
                    2,
                    30,
                    "2021/2022",
                ],
                [
                    "Sluttabell",
                    "Div Ett",
                    "*2",
                    "Beta Bears",
                    "12-9-0",
                    ".571",
                    "3900.10",
                    "$0",
                    3,
                    40,
                    "2021/2022",
                ],
                [
                    "Sluttabell",
                    "Div Ett",
                    3,
                    "\xa0Epsilon Eagles",
                    "5-16-0",
                    ".238",
                    3500.0,
                    "$100",
                    1,
                    10,
                    "2021/2022",
                ],
                [
                    "Sluttabell",
                    "Div 1 Gretzky",
                    "*1",
                    "Beta Bears",
                    "14-7-0",
                    ".667",
                    4100.0,
                    "$5",
                    1,
                    50,
                    "2022/2023",
                ],
                [
                    "Sluttabell",
                    "Div 1 Gretzky",
                    "*2",
                    "Alpha Dogs",
                    "13-8-0",
                    ".619",
                    4050.0,
                    "$0",
                    2,
                    60,
                    "2022/2023",
                ],
                [
                    "Sluttabell",
                    "Div 1 Gretzky",
                    3,
                    "Delta Force",
                    "4-17-0",
                    ".190",
                    3000.0,
                    "$90",
                    3,
                    12,
                    "2022/2023",
                ],
            ]
        },
    )
    _save(
        folder / "Draft.xlsx",
        {
            "Draft": [
                [
                    "Runda",
                    "Lag",
                    "Ov all",
                    "Spelare",
                    "Division",
                    "Säsong",
                    "ADP Yahoo",
                    "ADP VNHLFL",
                    "ADP KKUPFL",
                    "Budvärde",
                ],
                [1, "Alpha Wolves", 1, "Connor McDavid", "Div Ett", "21/22", 1.1, 1, None],
                [1, "Beta Bears", 2, "Leon Draisaitl ", "Div Ett", "21/22", 2.4, 2.5, None],
                [
                    1,
                    "\xa0Epsilon Eagles",
                    3,
                    "Auston Matthews",
                    "Div Ett",
                    "21/22",
                    "#N/A",
                    "?",
                    None,
                ],
                [
                    1,
                    "Beta Bears",
                    1,
                    "Nathan MacKinnon\xa0",
                    "Div 1 Gretzky",
                    "22/23",
                    3,
                    2,
                    None,
                    70,
                ],
                [1, "Alpha Dogs", 2, "Cale Makar", "Div 1 Gretzky", "22/23", 5, 4, None, 60],
                [1, "Gamma Goats", 3, "Connor McDavid", "Div 1 Gretzky", "22/23", 1, 1, None, 90],
                [
                    "Budget kvar",
                    "Gamma Goats",
                    "Unused",
                    "Unused",
                    "Div 1 Gretzky",
                    "22/23",
                    "#N/A",
                    "#N/A",
                    None,
                    0,
                ],
            ]
        },
    )
    _save(
        folder / "Namn och lag.xlsx",
        {
            "lagnamn": [
                ["Lagnamn", "Namn", "Poäng"],
                ["Alpha Wolves", "Anna Alfa", "#VALUE!"],
                ["Alpha Dogs", "Anna Alfa", "#VALUE!"],
                ["Beta Bears", "Bertil Beta", "#VALUE!"],
                ["Gamma Goats", "Cecilia Gamma", "#VALUE!"],
                ["Delta Force", "Doris Delta", "#VALUE!"],
                ["\xa0Epsilon Eagles", "Erik Epsilon", "#VALUE!"],
            ],
            "GMs": [
                ["Namn", "Lagnamn", "Poäng", "Poäng"],
                ["Anna Alfa", "Alpha Dogs", "#VALUE!", 8050.25],
            ],
            "Ersättare": [
                ["Säsong", "Datum", "Gamla laget", "Nya laget"],
                ["2022/2023", 20221201, "Gamma Goats", "Delta Force"],
            ],
        },
    )
    _save(
        folder / "Trades.xlsx",
        {
            "Trades": [
                [
                    None,
                    "Säsong",
                    "Division",
                    "Week",
                    "Datum",
                    "Lag 1",
                    "Lag 2",
                    "Lag 1 får",
                    "Lag 2 får",
                    "Veto",
                ],
                [
                    1,
                    "2021/2022",
                    "Div Ett",
                    4,
                    20211103,
                    "alpha",
                    "beta",
                    "Leon Draisaitl, Mark Stone",
                    "Connor Mcdavid",
                ],
                [
                    0,
                    "2021/2022",
                    "Div Ett",
                    5,
                    20211110,
                    "Epsilon",
                    "Bertil",
                    "Auston Matthews",
                    "Leon Draisaitl",
                    "Ja",
                ],
                [
                    1,
                    "2022/2023",
                    "Div 1 Gretzky",
                    3,
                    20221020,
                    "Wolves",
                    "Gamma",
                    "Connor McDavid\nSome Prospect",
                    "Cale Makar",
                ],
            ]
        },
    )
    return folder
