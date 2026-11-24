"""Turn saved calendar pages (scraper/raw/) into plain course records.

This step only reads the page; it does not interpret prerequisites or codes.
build_data.py does that, so the same logic also runs on the sample data.

NOTE: the page layout assumed here (a heading "Subject 1234A/B: Title"
followed by paragraphs with labels such as "Prerequisite(s):") has not yet
been checked against real saved pages, because scraping has not been
approved. Check the selectors against a few saved pages before trusting
the output.
"""

import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

from codes import collapse_spaces

RAW_DIR = Path(__file__).parent / "raw"
HEADING = re.compile(r"^(?P<code>.+?\d{4}[A-Z/]*)\s*[:\-–]\s*(?P<title>.+)$")
LABELS = {
    "antirequisite": "antireq_text",
    "prerequisite": "prereq_text",
    "corequisite": "coreq_text",
    "pre-or corequisite": "coreq_text",
    "extra information": "extra_info",
    "course weight": "credit_weight_text",
    "breadth": "breadth_text",
}
LABEL = re.compile(
    r"^(?P<label>" + "|".join(re.escape(label) for label in LABELS) + r")(?:\(s\))?\s*:\s*(?P<value>.*)$",
    re.IGNORECASE,
)


class ParseError(Exception):
    """The page does not look like a course page."""


def parse_course_html(html, url):
    """Read one course page into a record with the calendar's own wording."""
    soup = BeautifulSoup(html, "html.parser")
    heading = find_heading(soup)
    if heading is None:
        raise ParseError("no course heading found")

    match = HEADING.match(collapse_spaces(heading.get_text(" ")))
    record = {
        "code_text": match.group("code"),
        "title": tidy_title(match.group("title")),
        "description": "",
        "prereq_text": "",
        "coreq_text": "",
        "antireq_text": "",
        "extra_info": "",
        "credit_weight_text": "",
        "breadth_text": "",
        "url": url,
    }

    description = []
    for paragraph in heading.find_all_next("p"):
        text = collapse_spaces(paragraph.get_text(" "))
        labelled = LABEL.match(text)
        if labelled:
            field = LABELS[labelled.group("label").lower()]
            record[field] = labelled.group("value").strip()
        elif text and not any(record[field] for field in LABELS.values()):
            # Paragraphs before the first label are the description.
            description.append(text)
    record["description"] = "\n\n".join(description)
    if not record["description"]:
        raise ParseError("no description found")
    return record


def find_heading(soup):
    for tag in soup.find_all(["h1", "h2", "h3"]):
        if HEADING.match(collapse_spaces(tag.get_text(" "))):
            return tag
    return None


def tidy_title(title):
    """The calendar writes many titles in capitals; show them in title case."""
    title = collapse_spaces(title)
    if title.isupper():
        small = {"and", "of", "the", "in", "for", "to", "a", "an", "on", "with"}
        words = title.lower().split(" ")
        title = " ".join(
            word if index and word in small else word[:1].upper() + word[1:]
            for index, word in enumerate(words)
        )
    return title


def parse_raw_pages(raw_dir=RAW_DIR):
    """Parse every saved course page. Returns (records, failures)."""
    urls = json.loads((raw_dir / "urls.json").read_text())
    records, failures = [], []
    for path in sorted((raw_dir / "courses").glob("*.html")):
        url = urls.get(path.name, "")
        try:
            records.append(parse_course_html(path.read_text(encoding="utf-8"), url))
        except ParseError as error:
            failures.append({"file": path.name, "url": url, "reason": str(error)})
    return records, failures
