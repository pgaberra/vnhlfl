"""Text clean-up shared by every reader.

The spreadsheets were filled in by hand and pasted from Yahoo, so the same team or player shows
up with non-breaking spaces, trailing blanks, emoji, odd apostrophes and different casing.
"""

import re
import unicodedata

# Acute accent, right/left single quotes and backtick all stand in for an apostrophe.
_APOSTROPHES = str.maketrans({"\u00b4": "'", "\u2019": "'", "\u2018": "'", "`": "'"})
_NOT_WORDISH = re.compile(r"[^\w\s'&\-]")
_SPACES = re.compile(r"\s+")


def clean(value: object) -> str:
    """Display form: trimmed, single-spaced, straight apostrophes. Emoji are kept."""
    # Straighten apostrophes first: NFKC turns U+00B4 into a space plus a combining accent.
    text = unicodedata.normalize("NFKC", str(value).translate(_APOSTROPHES))
    return _SPACES.sub(" ", text.replace("\xa0", " ")).strip()


def key(value: object) -> str:
    """Matching form for comparing names: lower case, no accents, emoji or apostrophes.

    A name made only of emoji (there are a few) keeps its emoji, or every such team would
    share the empty key.
    """
    cleaned = clean(value).lower().replace("\ufe0f", "")
    # Punctuation splits words (`Rats/CC Cowboys`); apostrophes join them (`Victor's`).
    text = _SPACES.sub(" ", _NOT_WORDISH.sub(" ", cleaned.replace("'", ""))).strip()
    return ascii_fold(text) if text else cleaned


def ascii_fold(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def slug(value: object) -> str:
    """URL-safe id: `Gåxsjö Hockeyheads` -> `gaxsjo-hockeyheads`."""
    return re.sub(r"[^a-z0-9]+", "-", ascii_fold(key(value))).strip("-")


def season_id(value: object) -> str:
    """Accepts `2021/2022`, `21/22` or `2021-22` and returns `2021-22`."""
    text = clean(value)
    match = re.fullmatch(r"(\d{2}|\d{4})\s*[/-]\s*(\d{2}|\d{4})", text)
    if not match:
        raise ValueError(f"Unrecognised season: {value!r}")
    start = int(match.group(1))
    if start < 100:
        start += 2000
    return f"{start}-{(start + 1) % 100:02d}"


def season_label(sid: str) -> str:
    return sid.replace("-", "/")
