# Decisions

One line each: `[date] area: chose X over Y — why`. Read before reopening a settled question.

- [2026-10-11] architecture: chose a static site (Python pipeline → JSON → Angular SPA) over the blueprint's web + Spring BFF + db-service — read-only historical data that changes weekly at most needs no server, database or auth.
- [2026-10-11] repos: chose one public repo (pipeline + web) over one repo per deployable — there is only one deployable, and the owner wants every repo of this project public.
- [2026-10-11] hosting: chose GitHub Pages over Coolify/Hetzner — free for public repos, nothing to operate; the 404.html copy of the shell stands in for an SPA rewrite.
- [2026-10-11] privacy: chose to publish team names only over real names — ~155 private individuals on a public site need consent (GDPR); `--names full` switches it on later.
- [2026-10-11] identity: chose the slug of a GM's first team name as their id over a hash of their real name — stable, readable in URLs, and a name hash is guessable from a list of names.
- [2026-10-11] identity: keyed team-seasons by (season, division, GM) over (season, GM) — in 2024/25 a GM left their Div 3 team mid-season to take over a Div 2 team.
- [2026-10-11] frontend: kept Angular over React — same stack and conventions as SlapStat, so the owner's tooling and skills carry over.
- [2026-10-11] stats: computed in the browser from normalised JSON over precomputed tables — the data is small (~2 MB) and filters (division level, sort, per-GM views) stay cheap to add.
- [2026-10-11] standings: the final rank is Yahoo's end-of-season table, playoffs included, and a title is rank 1 in it — that is how the founder's sheet records it.
- [2026-10-11] data: dropped the founder's `Poäng` career totals in `GMs` as a cross-check — they don't reconcile with the season tables (4 of 126 match) and the column is partly `#VALUE!`.
- [2026-10-11] quality: deferred ESLint for the web (Prettier + Vitest + build run in CI) — small codebase; add angular-eslint when a second contributor appears.
- [2026-10-12] data: published 2025/26–2026/27 with 64 unmapped team names as provisional GMs over waiting for an updated `Namn och lag` — the owner's call; tracked in issue #1, and `curation/unmapped-teams.txt` keeps `--strict` failing on new unknown names.
- [2026-10-12] matchups: head-to-head "slutspel" counts the A bracket incl. its 3rd/5th-place games, not the B bracket — the B bracket decides nothing about the title.
- [2026-10-12] data: kept the founder's `Matcher` scores as given over correcting them — ~10 games differ from the final tables by exactly 100 points, which looks like typos only the founder can confirm.
- [2026-10-13] data: transcribed the 2024/25–2025/26 Yahoo screenshots (games, trades) to committed CSVs over waiting for a Yahoo API import — the owner asked for it; every team's regular-season record and points equal the final tables (224/224), every final and 3rd-place result matches the final ranks.
- [2026-10-13] data: filled the one score hidden by the mouse cursor (2024/25 Div 4 Lemieux week 1) as the team's season total minus its other weeks (262.30, matching the visible digits).
- [2026-10-13] playoffs: in screenshot seasons, a consolation game between two semifinal losers is the 3rd-place game and between two quarterfinal losers the 5th-place game — Yahoo files them under "Consolation"; other consolation games are "placement".
- [2026-10-13] standings: computed weekly tables from the games where the founder kept none (ranked by win%, then points; a mid-season takeover is one slot) — validated: top 6 equals Yahoo's playoff teams in 16/16 divisions.
