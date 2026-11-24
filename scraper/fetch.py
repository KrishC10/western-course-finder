"""Politely download undergraduate course pages to scraper/raw/ (git-ignored).

Run this only after confirming the calendar's robots.txt and terms of use
allow it (see DECISIONS.md). It refuses to start until a contact email is
set and --i-have-permission is passed.

    python fetch.py --i-have-permission

Rules it follows:
- one request at a time, 2-3 seconds apart, with a User-Agent naming a contact;
- pages already saved are skipped, so an interrupted run resumes;
- failed pages are retried at the end, at most twice, then logged.
"""

import argparse
import json
import random
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

CONTACT_EMAIL = "<email>"  # fill in before running
USER_AGENT = f"WesternCourseFinder/1.0 (student project; contact: {CONTACT_EMAIL})"
BASE_URL = "https://www.westerncalendar.uwo.ca/"
# "Live" is the current (2026-27) calendar.
INDEX_URL = BASE_URL + "Courses.cfm?SelectedCalendar=Live&ArchiveID="
RAW_DIR = Path(__file__).parent / "raw"
MAX_RETRIES = 2


def polite_get(session, url):
    time.sleep(random.uniform(2.0, 3.0))
    response = session.get(url, timeout=30)
    response.raise_for_status()
    return response.text


def save_page(session, url, path, urls):
    """Download url to path unless it is already saved."""
    urls[path.name] = url
    if path.exists():
        return path.read_text(encoding="utf-8")
    html = polite_get(session, url)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")
    print(f"saved {path.relative_to(RAW_DIR)}")
    return html


def links_with_param(html, page_url, param):
    """Absolute links on a page whose query string contains param."""
    soup = BeautifulSoup(html, "html.parser")
    found = {}
    for link in soup.find_all("a", href=True):
        url = urljoin(page_url, link["href"])
        values = parse_qs(urlparse(url).query).get(param)
        if values:
            found[values[0]] = url
    return found


def fetch_all():
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    urls_path = RAW_DIR / "urls.json"
    urls = json.loads(urls_path.read_text()) if urls_path.exists() else {}

    index_html = save_page(session, INDEX_URL, RAW_DIR / "index.html", urls)
    jobs = []
    for subject, subject_url in sorted(links_with_param(index_html, INDEX_URL, "Subject").items()):
        try:
            subject_html = save_page(session, subject_url, RAW_DIR / "subjects" / f"{subject}.html", urls)
        except requests.RequestException as error:
            print(f"subject {subject} failed: {error}", file=sys.stderr)
            continue
        for course_key, course_url in links_with_param(subject_html, subject_url, "CourseAcadCalendarID").items():
            jobs.append((course_url, RAW_DIR / "courses" / f"{course_key}.html"))

    failures = jobs
    for attempt in range(1 + MAX_RETRIES):
        still_failing = []
        for url, path in failures:
            try:
                save_page(session, url, path, urls)
            except requests.RequestException as error:
                still_failing.append((url, path))
                print(f"attempt {attempt + 1} failed for {url}: {error}", file=sys.stderr)
        failures = still_failing
        urls_path.write_text(json.dumps(urls, indent=1))
        if not failures:
            break

    (RAW_DIR / "failures.json").write_text(json.dumps([url for url, _ in failures], indent=1))
    print(f"{len(jobs)} course pages, {len(failures)} failed")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--i-have-permission", action="store_true",
                        help="confirm robots.txt and the terms of use allow this")
    args = parser.parse_args()
    if not args.i_have_permission or "<" in CONTACT_EMAIL:
        sys.exit("Set CONTACT_EMAIL and pass --i-have-permission once scraping is confirmed as allowed.")
    fetch_all()


if __name__ == "__main__":
    main()
