# Decisions

One entry per design choice: what was chosen, the alternatives, and why.

## Data collection

### Did not scrape yet; built on sample data
- **Chosen:** Build and test the whole pipeline and site against a small sample dataset (`scraper/sample/sample_courses.json`, 85 courses). The fetcher exists but refuses to run until a contact email is set and `--i-have-permission` is passed.
- **Alternatives:** Scrape now; wait to build anything.
- **Why:** The calendar's `robots.txt` (checked 2026-11-24) blocks `/` for ClaudeBot, GPTBot, Googlebot, bingbot and other named crawlers. It has no rule for other user agents, but blocking even search engines is a clear signal. Permission should come from Western (e.g. the Office of the Registrar) before any collection. The sample uses real-style course codes and calendar-style prerequisite wording, but its descriptions were written for this project and are not official. The site shows a "Sample data" banner while `courses.json` has `"sample": true`.

### Sample data runs through the same build as real data
- **Chosen:** `build_data.py` takes raw records from either `parse.py` (saved pages) or the sample file. Both have the same shape.
- **Alternatives:** Hand-write the final `courses.json`.
- **Why:** The prerequisite parser, code normaliser and sanity checks get exercised on every build. Swapping in real data later changes only the input.

### HTML parser layout is an assumption
- **Chosen:** `parse.py` looks for a heading like `Subject 1234A/B: Title` and paragraphs labelled `Prerequisite(s):` and so on. It is tested on a synthetic fixture.
- **Alternatives:** None without seeing real pages.
- **Why:** No real pages could be saved yet. Once a few are saved, check the selectors against them and replace the fixture with a real page.

### "Live" calendar = 2026–27
- **Chosen:** The fetcher uses `SelectedCalendar=Live`, the calendar currently published.
- **Why:** The spec defaults to 2026–27, which is the live calendar right now. Pin an archive ID if the site switches years mid-project.

## Prerequisite parsing

### Placeholder tokens, then a strict reader
- **Chosen:** Replace each course reference with `#n#`, split into sentences, then AND parts, then read each part as a course or an OR list.
- **Alternatives:** A full grammar or parser library; machine learning.
- **Why:** It is short and easy to explain, and every step is visible in a test. Once course names are tokens, the leftover text is only connectors, so anything unexpected is easy to detect.

### Give up instead of guessing
- **Chosen:** `A or B and C`, OR lists with a non-course option (`… or permission of the Department`) and parts with leftover words all become `unparsed` with `prereq_rule: null`.
- **Alternatives:** Pick the most likely reading.
- **Why:** A wrong "you are eligible" is worse than "check the calendar". In the sample, 10 of 85 rules are unparsed.

### Non-course requirements in an AND list become notes
- **Chosen:** In `Psychology 1002A/B, and registration in an Honours Specialization`, the second part has no course, so it becomes a note and the status is `partial`. A sentence with no courses at all (`Ontario Secondary School MCV4U.`) gives `partial` with no rule.
- **Alternatives:** Mark these unparsed.
- **Why:** The course part is still exact, and the spec's "eligible with conditions" exists for exactly this case.

### Bare numbers borrow the previous subject
- **Chosen:** `Mathematics 1600A/B or 1229A/B` reads as MATH-1600 or MATH-1229. A bare number with no subject before it is ignored.
- **Why:** The calendar writes lists this way all the time, and with no subject in front, a bare number such as "the 1000 level" is not a course.

### Prerequisite text uses codes and full names only, not aliases
- **Chosen:** When reading calendar text, the parser matches only subject codes and full names. Aliases like "CS" are for search only.
- **Why:** "es 1036" appearing in calendar text would be a coincidence, not a course.

## Search

### Course-code detection before text search
- **Chosen:** Squash the query (lowercase, letters and digits only) and match `<letters><4 digits>`, mapping letters through subject codes, names and aliases. An exact hit is result #1 with an "Exact match" label.
- **Why:** As the spec says. Squashing makes "CS 1026", "compsci-1026" and "Computer Science 1026A/B" the same string.

### Typo distance 2 for long words (deviates from spec)
- **Chosen:** Words of 5–7 letters allow 1 edit; words of 8+ letters allow 2.
- **Alternatives:** Edit distance 1 for every word of 5+ letters, as written in the spec.
- **Why:** MiniSearch uses Levenshtein distance, which counts a swap of two letters as 2 edits. "pyschology" is 2 edits from "psychology", so distance 1 cannot meet the spec's own F3 "done when". Allowing 2 only on long words keeps short words strict.

### Level tie-breaker as a tiny document boost
- **Chosen:** `boostDocument` multiplies scores by up to 1.04 for 1000-level courses, then ties sort by level.
- **Why:** MiniSearch scores are rarely exactly equal, so a pure tie-break would almost never apply. A boost this small only changes near-ties.

### Plain-English hints in the query
- **Chosen:** "no prerequisites" and "first year" to "fourth year" are taken out of the query and applied as filters, with a note saying so.
- **Why:** The spec's welcome example "no prerequisites first year" would otherwise find nothing useful.

### Filter counts
- **Chosen:** Facet counts are computed from the current results with that facet's own selection ignored. Within a facet, ticking several options means any of them; across facets it means all.
- **Why:** As the spec says. It lets students see alternatives before switching.

### Filters panel on phones is an inline collapsible
- **Chosen:** Below 900 px, a "Filters" button expands the panel in place.
- **Alternatives:** An overlay drawer.
- **Why:** An overlay needs a focus trap and scroll locking to be accessible. An inline panel is simpler and works the same with a keyboard and a screen reader.

## What can I take next?

### "Check the calendar" shows only relevant courses
- **Chosen:** Unparsed courses are listed only if their prerequisite text mentions a course the student finished.
- **Alternatives:** List every unparsed course.
- **Why:** With real data that could be hundreds of courses, most of them irrelevant. The mention check uses the same course-reference matcher as the course page links.

### Subjects open where something new was unlocked
- **Chosen:** Results are grouped by subject in `<details>` sections. A section starts open when one of its courses has a rule naming a finished course.
- **Why:** With real data, courses with no prerequisites alone fill dozens of subjects. Opening only the "newly unlocked" groups keeps the useful part visible. There is also a "Hide courses with no prerequisites" checkbox.

### Antirequisites checked in both directions
- **Why:** The calendar sometimes lists an antirequisite on only one of the two courses.

### Saved in localStorage, guarded
- **Chosen:** Finished courses are saved under one key, and every read and write is wrapped in try/catch.
- **Why:** The spec says the data stays in the student's browser. Private windows can block storage, and the page must still work there.

## Frontend

### No framework, small DOM helper
- **Chosen:** Plain TypeScript with an `el(tag, attributes, ...children)` helper. Course text is always added as text nodes, never `innerHTML`.
- **Why:** Easy to explain, nothing to learn, and data can never inject markup.

### Hash routing with replaceState while typing
- **Chosen:** Views live after `#`. Typing updates the URL with `history.replaceState`, while links between views create history entries.
- **Why:** GitHub Pages serves only files, and the back button should not hold one entry per letter typed.

### Filter checkboxes are built once
- **Chosen:** Every option is created once, and only the counts change as results update.
- **Why:** Rebuilding the panel on every change would move keyboard focus away from the checkbox just ticked.

## Tooling

### Python 3.9-compatible code
- **Chosen:** The scraper avoids syntax newer than Python 3.9. CI uses 3.12.
- **Why:** The development machine has Python 3.9 and the spec asks for 3.11+. Writing for 3.9 runs on both.
