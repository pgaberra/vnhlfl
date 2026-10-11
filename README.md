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

- Match results, so no head-to-head records yet.
- Trades from 2024/25 (only screenshots exist) and the whole 2025/26 season.

Both can be fetched from Yahoo, where the league has a shared login for all divisions.
