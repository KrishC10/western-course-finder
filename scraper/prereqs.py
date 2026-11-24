"""Turn prerequisite text into a rule tree of AND / OR groups of course ids.

A rule is a course id ("COMPSCI-1027"), {"and": [rules]} or {"or": [rules]}.

The parser is strict on purpose. When a sentence could be read two ways
("A or B and C") it gives up and marks the course "unparsed", because telling
a student they are eligible when they are not is worse than saying
"check the calendar".

How it works, in four steps:
1. Pull out grade requirements ("with a mark of at least 65%") as notes.
2. Replace every course reference with a placeholder like #0#, so the
   remaining text is only connectors: "#0#, and one of #1# or #2#".
3. Split into sentences, then into AND parts. A part with no course in it
   ("registration in Honours Psychology") becomes a note.
4. Read each remaining part as one course or an OR list of courses.
"""

import re

from codes import collapse_spaces, find_course_refs

GRADE_NOTE = re.compile(
    r",?\s*(?:each\s+)?with\s+an?\s+(?:minimum\s+)?mark\s+of\s+(?:at\s+least\s+)?\d+\s*%"
    r"(?:\s+in\s+(?:each|both|all)(?:\s+of\s+(?:these|the)\s+courses)?)?",
    re.IGNORECASE,
)
# Words that add nothing to the rule; "the former X" still means course X.
FILLER = re.compile(r"\b(?:the former|both|completion of)\b", re.IGNORECASE)
TOKEN = re.compile(r"#(\d+)#")
SENTENCE_SEPARATOR = r";|\.(?:\s+|$)"
AND_SEPARATOR = r",?\s*\band\b\s*"
OR_SEPARATOR = r",?\s*\bor\b\s*|,\s*"
OR_LEADS = ("one of ", "either ", "any of ")


class Unclear(Exception):
    """The text cannot be read as one reliable rule."""


def parse_prereqs(text, lookup):
    """Return {"rule", "notes", "status"} for one prerequisite text.

    status is "none" (no prerequisites), "parsed" (rule is complete),
    "partial" (rule covers the courses, notes hold other requirements)
    or "unparsed" (rule is None; the student must read the calendar).
    """
    text = collapse_spaces(text)
    if not text or text.lower().rstrip(".") in ("none", "n/a"):
        return {"rule": None, "notes": [], "status": "none"}

    notes = [m.group(0).strip(" ,") for m in GRADE_NOTE.finditer(text)]
    tokens_text, ids = replace_course_refs(GRADE_NOTE.sub("", text), lookup)
    try:
        rules, requirement_notes = parse_sentences(tokens_text, ids)
    except Unclear:
        return {"rule": None, "notes": notes, "status": "unparsed"}

    return {
        "rule": {"and": flatten("and", rules)} if rules else None,
        "notes": notes + requirement_notes,
        "status": "partial" if requirement_notes else "parsed",
    }


def replace_course_refs(text, lookup):
    """Swap each course reference for a #n# placeholder; return text and ids."""
    pieces, ids, position = [], [], 0
    for start, end, course_id in find_course_refs(text, lookup):
        pieces.append(text[position:start])
        pieces.append(f"#{len(ids)}#")
        ids.append(course_id)
        position = end
    pieces.append(text[position:])
    return "".join(pieces), ids


def parse_sentences(text, ids):
    """Every sentence and every AND part must hold, so they all join with AND."""
    rules, notes = [], []
    for sentence in split_top_level(text, SENTENCE_SEPARATOR):
        sentence = FILLER.sub("", sentence).strip(" ,.")
        if not sentence:
            continue
        if not TOKEN.search(sentence):
            notes.append(sentence)
            continue
        parts = split_and_parts(sentence)
        for part in parts:
            if not TOKEN.search(part):
                notes.append(part)
            elif len(parts) > 1 and is_bare_or(part):
                # "A and B or C" could mean (A and B) or C, or A and (B or C).
                raise Unclear(sentence)
            else:
                rules.append(parse_part(part, ids))
    return rules, notes


def split_and_parts(text):
    """Split on "and"; a plain comma list inside an AND list is also AND."""
    parts = []
    for chunk in split_top_level(text, AND_SEPARATOR):
        if starts_with_or_lead(chunk) or re.search(r"\bor\b", chunk, re.IGNORECASE):
            parts.append(chunk)
        else:
            parts.extend(split_top_level(chunk, r","))
    return parts


def parse_group(text, ids):
    """A group inside brackets: either AND parts or a single part."""
    parts = split_and_parts(text)
    if len(parts) == 1:
        return parse_part(parts[0], ids)
    if any(is_bare_or(part) or not TOKEN.search(part) for part in parts):
        raise Unclear(text)
    return {"and": flatten("and", [parse_part(part, ids) for part in parts])}


def parse_part(text, ids):
    """One course, a bracketed group, or an OR list of those."""
    text = text.strip(" ,")
    inner = strip_outer_brackets(text)
    if inner != text:
        return parse_group(inner, ids)
    single = TOKEN.fullmatch(text)
    if single:
        return ids[int(single.group(1))]

    lead = starts_with_or_lead(text)
    body = text[len(lead):] if lead else text
    items = split_top_level(body, OR_SEPARATOR)
    if len(items) < 2 or not (lead or re.search(r"\bor\b", body, re.IGNORECASE)):
        raise Unclear(text)
    return {"or": flatten("or", [parse_option(item, ids) for item in items])}


def parse_option(text, ids):
    """One choice in an OR list must be a course or a bracketed group."""
    text = text.strip(" ,")
    inner = strip_outer_brackets(text)
    if inner != text:
        return parse_group(inner, ids)
    single = TOKEN.fullmatch(text)
    if single:
        return ids[int(single.group(1))]
    raise Unclear(text)


def starts_with_or_lead(text):
    lower = text.lower().lstrip()
    return next((lead for lead in OR_LEADS if lower.startswith(lead)), None)


def is_bare_or(text):
    """An OR list with no "one of" in front, outside any brackets."""
    if starts_with_or_lead(text):
        return False
    return len(split_top_level(text, r"\bor\b")) > 1


def split_top_level(text, separator):
    """Split on a regex, ignoring separators inside brackets."""
    depth_before = []
    depth = 0
    for char in text:
        depth_before.append(depth)
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1

    parts, start = [], 0
    for match in re.finditer(separator, text, re.IGNORECASE):
        if match.start() >= start and depth_before[match.start()] == 0:
            parts.append(text[start:match.start()])
            start = match.end()
    parts.append(text[start:])
    return [part.strip() for part in parts if part.strip(" ,.")]


def strip_outer_brackets(text):
    """Remove brackets only when one pair wraps the whole text."""
    while text.startswith("(") and closing_bracket(text) == len(text) - 1:
        text = text[1:-1].strip()
    return text


def closing_bracket(text):
    """Index of the bracket that closes the one at position 0, or -1."""
    depth = 0
    for index, char in enumerate(text):
        depth += {"(": 1, ")": -1}.get(char, 0)
        if depth == 0:
            return index
    return -1


def flatten(kind, rules):
    """{"and": [a, {"and": [b, c]}]} reads more simply as {"and": [a, b, c]}."""
    flat = []
    for rule in rules:
        if isinstance(rule, dict) and kind in rule:
            flat.extend(rule[kind])
        else:
            flat.append(rule)
    return flat


def rule_course_ids(rule):
    """Every course id mentioned anywhere in a rule tree."""
    if rule is None:
        return []
    if isinstance(rule, str):
        return [rule]
    children = rule.get("and") or rule.get("or") or []
    return [course_id for child in children for course_id in rule_course_ids(child)]
