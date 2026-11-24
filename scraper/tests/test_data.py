"""Sanity checks on the JSON the website ships with."""

import json
from pathlib import Path

from build_data import sanity_problems
from prereqs import rule_course_ids

DATA = Path(__file__).resolve().parents[2] / "web" / "public" / "data"
COURSES = json.loads((DATA / "courses.json").read_text())["courses"]
REPORT = json.loads((Path(__file__).resolve().parents[1] / "parse_report.json").read_text())


def test_every_course_has_id_title_and_url_and_ids_are_unique():
    problems, _ = sanity_problems(COURSES)
    assert problems == []


def test_every_prerequisite_id_exists_or_is_reported():
    known = {course["id"] for course in COURSES}
    for course in COURSES:
        for required in rule_course_ids(course["prereq_rule"]):
            assert required in known or course["id"] in REPORT["unknown_prereq_ids"].get(required, [])


def test_unparsed_courses_have_no_rule():
    for course in COURSES:
        if course["prereq_parse_status"] in ("unparsed", "none"):
            assert course["prereq_rule"] is None


def test_unlocks_match_rules():
    unlocks = json.loads((DATA / "unlocks.json").read_text())
    for course in COURSES:
        for required in set(rule_course_ids(course["prereq_rule"])):
            assert course["id"] in unlocks[required]


def test_every_subject_is_described():
    subjects = {s["code"] for s in json.loads((DATA / "subjects.json").read_text())}
    assert {course["subject"] for course in COURSES} <= subjects
