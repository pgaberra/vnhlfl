# VNHLFL · league history

Statistics for **VNHLFL** (Veckans NHL Fantasy League), one of Europe's largest fantasy hockey
leagues: every GM's career, standings week by week, promotions and relegations, an all-time
table, trades and drafts since the first season in 2021/22.

The site shows **team names only**. A GM appears under their latest team name, with earlier
names listed on their page.

## How it works

```
founder's .xlsx files ──▶ pipeline/ (Python) ──▶ web/public/data/*.json ──▶ web/ (Angular) ──▶ GitHub Pages
                            resolves teams                committed                computes stats
                            to GMs across seasons
```

- `pipeline/` reads `Tabell`, `Draft`, `Trades` and `Namn och lag`, follows each GM across team
  renames and mid-season takeovers, resolves the trade log's nicknames (`flipp`, `THTY`, a first
  name, last season's team name) to teams, and writes four JSON files. Real names never leave it.
- `web/` loads that JSON and computes everything else in the browser.

## Updating the data

1. Put the latest spreadsheets in `source-data/` (gitignored).
2. From `pipeline/`: `.venv/Scripts/python -m vnhlfl_pipeline --source ../source-data --out ../web/public/data --strict`
3. Fix any warning (usually a new nickname: add it to `pipeline/curation/team-aliases.csv`).
4. Commit `web/public/data` and push; the site redeploys.

## What's missing

- Nothing from the screenshots: 2024/25 and 2025/26 games and trades were transcribed from the
  founder's Yahoo screenshots into `pipeline/transcribed/` (every team's record and points match
  the final tables), and those seasons' weekly tables are computed from the games.
- GMs for the 64 team names that appeared from 2025/26 on: published as their own GMs until
  the founder's team-to-GM list is updated (issue #1).

Both can be fetched from Yahoo, where the league has a shared login for all divisions.
