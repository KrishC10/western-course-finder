"""Recognise course codes like "Computer Science 2210A/B" or "COMPSCI 2210A/B"."""

import re

CREDIT_BY_SUFFIX = {
    # Half courses run for one term; everything else is a full (1.0) course.
    "A": 0.5, "B": 0.5, "F": 0.5, "G": 0.5, "Q": 0.5, "R": 0.5, "S": 0.5, "T": 0.5,
}


def course_pattern(lookup):
    """Regex for a course reference; the subject part is optional.

    Subjects are tried longest first so "Media, Information and Technoculture"
    wins over any shorter name that happens to start the same way.
    """
    names = sorted(lookup, key=len, reverse=True)
    subject = "|".join(re.escape(name) for name in names)
    return re.compile(
        rf"(?:\b(?P<subject>{subject})\s+)?\b(?P<number>\d{{4}})(?P<suffix>[A-Z](?:/[A-Z])*)?\b",
        re.IGNORECASE,
    )


def collapse_spaces(text):
    return re.sub(r"\s+", " ", text or "").strip()


def normalize_code(text, lookup):
    """Split "Computer Science 2210A/B" into subject, number, suffixes and id.

    Returns None when the text is not exactly one course code.
    """
    match = course_pattern(lookup).fullmatch(collapse_spaces(text))
    if not match or not match.group("subject"):
        return None
    subject = lookup[match.group("subject").lower()]
    number = int(match.group("number"))
    suffix = (match.group("suffix") or "").upper()
    return {
        "subject": subject,
        "number": number,
        "suffixes": suffix.split("/") if suffix else [],
        "id": f"{subject}-{number:04d}",
        "code": f"{subject} {number:04d}{suffix}",
    }


def credit_from_suffixes(suffixes):
    if suffixes and all(s in CREDIT_BY_SUFFIX for s in suffixes):
        return 0.5
    return 1.0


def find_course_refs(text, lookup):
    """Find every course reference in free text, in order.

    Calendar text often writes "Mathematics 1600A/B or 1229A/B", where the
    second course borrows the subject of the first, so a bare number takes
    the most recent subject. A bare number with no subject before it is not
    treated as a course.

    Returns a list of (start, end, course_id).
    """
    refs = []
    last_subject = None
    for match in course_pattern(lookup).finditer(text):
        if match.group("subject"):
            last_subject = lookup[match.group("subject").lower()]
        if last_subject is None:
            continue
        refs.append((match.start(), match.end(), f"{last_subject}-{match.group('number')}"))
    return refs


def extract_course_ids(text, lookup):
    """All distinct course ids mentioned in the text (used for antirequisites)."""
    ids = []
    for _, _, course_id in find_course_refs(collapse_spaces(text), lookup):
        if course_id not in ids:
            ids.append(course_id)
    return ids
