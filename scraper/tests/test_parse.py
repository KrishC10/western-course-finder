from pathlib import Path

import pytest

from build_data import build_course, parse_breadth
from parse import ParseError, parse_course_html
from subjects import SUBJECTS, calendar_lookup

FIXTURE = Path(__file__).parent / "fixtures" / "course_page.html"
URL = "https://www.westerncalendar.uwo.ca/Courses.cfm?CourseAcadCalendarID=TEST"


def parsed_fixture():
    return parse_course_html(FIXTURE.read_text(), URL)


def test_heading_and_title_case():
    record = parsed_fixture()
    assert record["code_text"] == "Computer Science 2210A/B"
    assert record["title"] == "Data Structures and Algorithms"


def test_description_keeps_paragraphs_and_collapses_spaces():
    assert parsed_fixture()["description"] == (
        "Design and analysis of fundamental data structures.\n\nSecond paragraph of the description."
    )


def test_labelled_fields_are_kept_as_written():
    record = parsed_fixture()
    assert record["prereq_text"] == "Computer Science 1027A/B with a mark of at least 65%."
    assert record["antireq_text"] == "Software Engineering 2205A/B."
    assert record["credit_weight_text"] == "0.50"
    assert record["breadth_text"] == "CATEGORY C"


def test_page_without_heading_is_reported():
    with pytest.raises(ParseError):
        parse_course_html("<html><body><p>Not found</p></body></html>", URL)


def test_record_becomes_course():
    course = build_course(parsed_fixture(), calendar_lookup(), {s["code"]: s for s in SUBJECTS})
    assert course["id"] == "COMPSCI-2210"
    assert course["credit_weight"] == 0.5
    assert course["level"] == 2000
    assert course["breadth"] == ["C"]
    assert course["antireq_ids"] == ["SE-2205"]
    assert course["prereq_rule"] == {"and": ["COMPSCI-1027"]}
    assert course["url"] == URL


def test_breadth_with_two_categories():
    assert parse_breadth("CATEGORY A or C") == ["A", "C"]
