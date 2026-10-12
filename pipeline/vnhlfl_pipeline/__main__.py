"""CLI: `python -m vnhlfl_pipeline --source ../source-data --out ../web/public/data`."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

from .build import LeagueBuilder, load

HERE = Path(__file__).resolve().parent.parent


def real_names_in(texts: list[str], names: list[str]) -> list[str]:
    """Real names (two words or more) that appear as whole words in the output.

    A team named after its manager would publish the name, so team mode refuses it.
    """
    found = []
    for name in names:
        if len(name.split()) < 2:
            continue
        pattern = re.compile(rf"(?<!\w){re.escape(name)}(?!\w)", re.IGNORECASE)
        if any(pattern.search(text) for text in texts):
            found.append(name)
    return found


def dump(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="vnhlfl_pipeline", description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="folder with the .xlsx files")
    parser.add_argument("--out", type=Path, required=True, help="folder the JSON is written to")
    parser.add_argument("--curation", type=Path, default=HERE / "curation")
    parser.add_argument("--transcribed", type=Path, default=HERE / "transcribed")
    parser.add_argument(
        "--names",
        choices=["team", "full"],
        default="team",
        help="'team' publishes team names only; 'full' adds managers' real names (needs consent)",
    )
    parser.add_argument("--strict", action="store_true", help="exit 1 on any warning")
    args = parser.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]

    builder = LeagueBuilder(
        load(args.source, args.curation, args.transcribed), name_mode=args.names
    )
    files = builder.build()
    texts = {name: dump(payload) for name, payload in files.items()}
    version = hashlib.sha256("".join(texts.values()).encode()).hexdigest()[:12]
    files["league"]["dataVersion"] = version
    texts["league"] = dump(files["league"])

    if args.names == "team":
        for name in real_names_in(list(texts.values()), list(builder.manager_names.values())):
            builder.report.warn(f"A real name would be published: '{name}' (rename it in curation)")

    args.out.mkdir(parents=True, exist_ok=True)
    for name, text in texts.items():
        (args.out / f"{name}.json").write_text(text, encoding="utf-8")

    league = files["league"]
    print(
        f"Wrote {len(texts)} files to {args.out} (data {version}): "
        f"{len(league['seasons'])} seasons, {len(league['managers'])} GMs, "
        f"{len(league['teams'])} team-seasons, {len(files['trades']['trades'])} trades"
    )
    for note in builder.report.notes:
        print(f"note: {note}")
    for warning in builder.report.warnings:
        print(f"WARNING: {warning}")
    return 1 if args.strict and builder.report.warnings else 0


if __name__ == "__main__":
    raise SystemExit(main())
