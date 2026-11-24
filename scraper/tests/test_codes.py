from codes import credit_from_suffixes, extract_course_ids, normalize_code
from subjects import calendar_lookup

LOOKUP = calendar_lookup()


def test_full_name_code_is_normalized():
    assert normalize_code("Computer Science 2210A/B", LOOKUP) == {
        "subject": "COMPSCI", "number": 2210, "suffixes": ["A", "B"],
        "id": "COMPSCI-2210", "code": "COMPSCI 2210A/B",
    }


def test_full_course_has_no_suffix():
    code = normalize_code("Psychology 2810", LOOKUP)
    assert code["id"] == "PSYCHOL-2810" and code["suffixes"] == []


def test_name_with_commas():
    assert normalize_code("Media, Information and Technoculture 1020E", LOOKUP)["id"] == "MIT-1020"


def test_unknown_text_is_not_a_code():
    assert normalize_code("Underwater Basketry 1000", LOOKUP) is None


def test_credit_weight_from_suffix():
    assert credit_from_suffixes(["A", "B"]) == 0.5
    assert credit_from_suffixes(["F", "G"]) == 0.5
    assert credit_from_suffixes(["E"]) == 1.0
    assert credit_from_suffixes([]) == 1.0


def test_antirequisite_ids_borrow_subject():
    text = "Statistical Sciences 2141A/B, 2244A/B, Psychology 2810"
    assert extract_course_ids(text, LOOKUP) == ["STATS-2141", "STATS-2244", "PSYCHOL-2810"]
