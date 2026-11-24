**Live site:** https://krishc10.github.io/western-course-finder/ (not deployed yet)

# Western Course Finder

> **Unofficial student project. Not affiliated with Western University. Always confirm with the official Academic Calendar and an academic counsellor.**

| Search | What can I take next? |
| --- | --- |
| ![Search view](docs/screenshots/search.png) | ![What can I take next view](docs/screenshots/next.png) |

## What it does

Western Course Finder lets Western University students search every undergraduate course by code, title, subject or description, and it forgives typos and loosely typed codes like "cs1026". Each course page shows what the course requires and what it unlocks, with links to the official calendar. Students add the courses they have finished, and the site lists everything they can take next, with antirequisite warnings.

It is a static site: all search and eligibility logic runs in the browser on JSON files shipped with the site. There is no server, no login and no tracking. Finished courses are saved only in the student's own browser (localStorage).

> **Current data is a sample.** Scraping has not been approved yet (see [DECISIONS.md](DECISIONS.md)), so the site ships with an 85-course sample. Its descriptions and prerequisite wording were written for this project and are not official. A banner on every page says so.

## Run it locally

Needs Node 20+ and Python 3.9+.

```bash
cd web
npm install
npm run dev        # http://localhost:5173/western-course-finder/
```

Production build and preview:

```bash
npm run build && npm run preview   # http://localhost:4173/western-course-finder/
```

## How the prerequisite parser works

`scraper/prereqs.py` turns text like *"Computer Science 1027A/B with a mark of at least 65%, and one of Mathematics 1600A/B or 1229A/B"* into a rule tree:

```json
{"and": ["COMPSCI-1027", {"or": ["MATH-1600", "MATH-1229"]}]}
```

1. **Grade notes** ("with a mark of at least 65%") are kept as text in `prereq_notes`. Eligibility treats the course as finished and shows the note.
2. **Course references** are swapped for placeholders (`#0#, and one of #1# or #2#`). A bare number like "or 1229A/B" borrows the subject before it.
3. The text is split into **sentences**, then **AND parts**. A part with no course in it ("registration in Honours Psychology") becomes a note, and the course is marked `partial`.
4. Each remaining part must be **one course or an OR list** ("one of A, B or C").

The parser **never guesses**. Ambiguous text ("A or B and C"), an OR with a non-course option ("… or permission of the Department") or any leftover words mark the course `unparsed`, and the site tells the student to check the calendar. Statuses: `none`, `parsed`, `partial`, `unparsed`.

## How to rebuild the data

```bash
python3 -m venv .venv && .venv/bin/pip install -r scraper/requirements.txt
cd scraper

# Sample data (what ships today):
../.venv/bin/python build_data.py --sample

# Real data, only once scraping is confirmed as allowed:
#   1. set CONTACT_EMAIL in fetch.py
#   2. ../.venv/bin/python fetch.py --i-have-permission   # polite: 2-3 s between requests, resumable
#   3. check parse.py's selectors against a few saved pages in scraper/raw/
#   4. ../.venv/bin/python build_data.py
```

This writes `web/public/data/{courses,subjects,unlocks}.json` and `scraper/parse_report.json`. The report lists parse failures, prerequisite status counts, unparsed texts and prerequisite ids that do not exist. Raw pages stay in `scraper/raw/` (git-ignored) and are never committed.

## Project layout

```
scraper/   fetch.py (polite download) · parse.py (HTML → records) · prereqs.py (text → rule tree)
           codes.py · subjects.py · build_data.py (writes the JSON) · tests/
web/       index.html · src/main.ts (start + routing) · src/search.ts (code detection, MiniSearch)
           src/filters.ts · src/eligibility.ts (pure prerequisite logic) · src/views/ · tests/
.github/workflows/deploy.yml   test, build and publish to GitHub Pages on every push to main
```

## Tests

```bash
cd scraper && ../.venv/bin/python -m pytest -q tests
cd web && npm test
```

| Suite | Covers | Result |
| --- | --- | --- |
| pytest (52) | 32 prerequisite texts (AND, OR, nested, grade notes, non-course, unparseable), code normalisation, HTML parsing, data sanity | all pass |
| Vitest | code detection (all F2 forms and odd ones), 24 student queries in the top 5, typo tolerance, filters and counts, URL round-trip, 5 hand-checked transcripts with antirequisite warnings, search under 50 ms | see below |

TESTS_SUMMARY_PLACEHOLDER

## Deployment

`.github/workflows/deploy.yml` runs every test, builds with Vite (`base: /western-course-finder/`) and publishes `web/dist` to GitHub Pages. A failing test stops the deploy. To turn it on, push to a GitHub repo named `western-course-finder` and set **Settings → Pages → Source** to **GitHub Actions**.
