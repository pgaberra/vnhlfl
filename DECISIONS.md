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
