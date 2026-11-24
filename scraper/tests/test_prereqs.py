"""Prerequisite texts and the rule trees they must produce.

These are written in the calendar's style. Once scraping is approved,
replace them with real texts copied from saved pages (spec: at least 25).
"""

import pytest

from prereqs import parse_prereqs, rule_course_ids
from subjects import calendar_lookup

LOOKUP = calendar_lookup()

CASES = [
    # --- single courses and simple AND ---
    ("Computer Science 1027A/B.", {"and": ["COMPSCI-1027"]}, "parsed"),
    ("COMPSCI 1027A/B", {"and": ["COMPSCI-1027"]}, "parsed"),
    ("Computer Science 2210A/B and 2211A/B.", {"and": ["COMPSCI-2210", "COMPSCI-2211"]}, "parsed"),
    ("Computer Science 2208A/B and Computer Science 2211A/B.", {"and": ["COMPSCI-2208", "COMPSCI-2211"]}, "parsed"),
    ("Computer Science 2210A/B, Computer Science 2211A/B, and Computer Science 2214A/B.",
     {"and": ["COMPSCI-2210", "COMPSCI-2211", "COMPSCI-2214"]}, "parsed"),
    ("Psychology 2810 and Psychology 2220A/B.", {"and": ["PSYCHOL-2810", "PSYCHOL-2220"]}, "parsed"),
    ("Media, Information and Technoculture 1020E.", {"and": ["MIT-1020"]}, "parsed"),
    # --- OR ---
    ("Calculus 1000A/B or Calculus 1500A/B.", {"and": [{"or": ["CALCULUS-1000", "CALCULUS-1500"]}]}, "parsed"),
    ("Statistical Sciences 1024A/B or Calculus 1000A/B or Mathematics 1229A/B.",
     {"and": [{"or": ["STATS-1024", "CALCULUS-1000", "MATH-1229"]}]}, "parsed"),
    ("One of Mathematics 1600A/B, Mathematics 1120A/B or Calculus 1000A/B.",
     {"and": [{"or": ["MATH-1600", "MATH-1120", "CALCULUS-1000"]}]}, "parsed"),
    ("Either Biology 1001A or Biology 1002B.", {"and": [{"or": ["BIOLOGY-1001", "BIOLOGY-1002"]}]}, "parsed"),
    # --- nested groups ---
    ("COMPSCI 1027A/B and one of MATH 1600A/B or MATH 1229A/B",
     {"and": ["COMPSCI-1027", {"or": ["MATH-1600", "MATH-1229"]}]}, "parsed"),
    ("Economics 1021A/B and Economics 1022A/B, and one of Mathematics 1229A/B, Calculus 1000A/B or Calculus 1500A/B.",
     {"and": ["ECON-1021", "ECON-1022", {"or": ["MATH-1229", "CALCULUS-1000", "CALCULUS-1500"]}]}, "parsed"),
    ("(Computer Science 2210A/B and 2211A/B) or Software Engineering 2205A/B.",
     {"and": [{"or": [{"and": ["COMPSCI-2210", "COMPSCI-2211"]}, "SE-2205"]}]}, "parsed"),
    ("Biology 1001A and Biology 1002B, and Chemistry 1301A/B and 1302A/B.",
     {"and": ["BIOLOGY-1001", "BIOLOGY-1002", "CHEM-1301", "CHEM-1302"]}, "parsed"),
    ("Computer Science 2210A/B. Computer Science 2214A/B.", {"and": ["COMPSCI-2210", "COMPSCI-2214"]}, "parsed"),
    ("Mathematics 1600A/B; the former Mathematics 1120A/B.", {"and": ["MATH-1600", "MATH-1120"]}, "parsed"),
    # --- grade notes (rule unchanged, note kept) ---
    ("Computer Science 1026A/B with a mark of at least 65%, or Engineering Science 1036A/B.",
     {"and": [{"or": ["COMPSCI-1026", "ENGSCI-1036"]}]}, "parsed"),
    ("Chemistry 1301A/B and Chemistry 1302A/B, each with a mark of at least 60%.",
     {"and": ["CHEM-1301", "CHEM-1302"]}, "parsed"),
    ("Economics 1021A/B and 1022A/B, with a mark of at least 60% in each.",
     {"and": ["ECON-1021", "ECON-1022"]}, "parsed"),
    # --- non-course requirements (partial) ---
    ("Psychology 1002A/B, and registration in an Honours Specialization or Major in Psychology.",
     {"and": ["PSYCHOL-1002"]}, "partial"),
    ("Computer Science 3350A/B or Computer Science 3307A/B. Registration in third or fourth year.",
     {"and": [{"or": ["COMPSCI-3350", "COMPSCI-3307"]}]}, "partial"),
    ("Ontario Secondary School MCV4U.", None, "partial"),
    ("1.0 History course at the 1000 level.", None, "partial"),
    # --- unparseable: must not guess ---
    ("Business Administration 1220E, or Economics 1021A/B and Economics 1022A/B.", None, "unparsed"),
    ("Computer Science 2210A/B and Computer Science 2214A/B, or registration in the Honours Specialization in Computer Science.",
     None, "unparsed"),
    ("Geography 1500F/G or registration in a Geography module.", None, "unparsed"),
    ("At least 60% in English 1020 or 1022E, or permission of the Department.", None, "unparsed"),
    ("Computer Science 2210A/B and Mathematics 1600A/B or Calculus 1000A/B.", None, "unparsed"),
    ("Computer Science 2211A/B taken concurrently.", None, "unparsed"),
    # --- no prerequisites ---
    ("", None, "none"),
    ("None.", None, "none"),
]


@pytest.mark.parametrize("text, rule, status", CASES)
def test_rule_tree(text, rule, status):
    result = parse_prereqs(text, LOOKUP)
    assert result["status"] == status
    assert result["rule"] == rule


def test_grade_note_is_kept_as_text():
    result = parse_prereqs("Computer Science 1027A/B with a mark of at least 65%.", LOOKUP)
    assert result["notes"] == ["with a mark of at least 65%"]


def test_non_course_requirement_becomes_note():
    result = parse_prereqs("Psychology 1002A/B, and registration in an Honours Specialization in Psychology.", LOOKUP)
    assert result["notes"] == ["registration in an Honours Specialization in Psychology"]


def test_rule_course_ids_walks_nested_groups():
    rule = {"and": ["A-1000", {"or": ["B-2000", {"and": ["C-3000"]}]}]}
    assert rule_course_ids(rule) == ["A-1000", "B-2000", "C-3000"]
