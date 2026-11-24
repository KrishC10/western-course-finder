"""Build the JSON the website ships with.

    python build_data.py            # from pages saved by fetch.py
    python build_data.py --sample   # from sample/sample_courses.json

Writes web/public/data/{courses,subjects,unlocks}.json and
scraper/parse_report.json. Raw records from either source have the same
shape, so the sample goes through exactly the same code as real data.
"""

import argparse
import datetime
import json
import re
from pathlib import Path

from codes import credit_from_suffixes, extract_course_ids, normalize_code
from prereqs import parse_prereqs, rule_course_ids
from subjects import SUBJECTS, calendar_lookup

HERE = Path(__file__).parent
SAMPLE_FILE = HERE / "sample" / "sample_courses.json"
OUT_DIR = HERE.parent / "web" / "public" / "data"
REPORT_FILE = HERE / "parse_report.json"
SOURCE = "https://www.westerncalendar.uwo.ca"


class BuildError(Exception):
    pass


def build_course(raw, lookup, subjects_by_code):
    """Turn one raw record into the course shape described in the spec."""
    code = normalize_code(raw["code_text"], lookup)
    if code is None:
        raise BuildError(f"unrecognised course code {raw['code_text']!r}")
    subject = subjects_by_code[code["subject"]]
    prereqs = parse_prereqs(raw.get("prereq_text", ""), lookup)
    return {
        "id": code["id"],
        "subject": code["subject"],
        "subject_name": subject["name"],
        "number": code["number"],
        "suffixes": code["suffixes"],
        "code": code["code"],
        "title": raw["title"],
        "description": raw.get("description", ""),
        "credit_weight": parse_credit(raw.get("credit_weight_text", ""), code["suffixes"]),
        "level": code["number"] // 1000 * 1000,
        "faculty": subject["faculty"],
        "breadth": parse_breadth(raw.get("breadth_text", "")),
        "prereq_text": raw.get("prereq_text", ""),
        "prereq_rule": prereqs["rule"],
        "prereq_notes": prereqs["notes"],
        "prereq_parse_status": prereqs["status"],
        "coreq_text": raw.get("coreq_text", ""),
        "antireq_ids": extract_course_ids(raw.get("antireq_text", ""), lookup),
        "antireq_text": raw.get("antireq_text", ""),
        "extra_info": raw.get("extra_info", ""),
        "url": raw.get("url", ""),
    }


def parse_credit(text, suffixes):
    """Use the page's stated weight; fall back to the suffix rule."""
    match = re.search(r"\d+(?:\.\d+)?", text or "")
    return float(match.group(0)) if match else credit_from_suffixes(suffixes)


def parse_breadth(text):
    """"CATEGORY A or C" -> ["A", "C"]."""
    after = re.sub(r"(?i)^.*?category", "", text or "")
    return sorted(set(re.findall(r"\b([ABC])\b", after)))


def build_unlocks(courses):
    """For each course id, the courses that name it in their prerequisite rule."""
    unlocks = {}
    for course in courses:
        for required in set(rule_course_ids(course["prereq_rule"])):
            unlocks.setdefault(required, []).append(course["id"])
    return {course_id: sorted(ids) for course_id, ids in sorted(unlocks.items())}


def sanity_problems(courses):
    """Problems the data sanity tests and the report both look for."""
    problems = []
    ids = [course["id"] for course in courses]
    known = set(ids)
    for course_id in sorted({i for i in ids if ids.count(i) > 1}):
        problems.append(f"duplicate id {course_id}")
    for course in courses:
        for field in ("id", "title", "url"):
            if not course.get(field):
                problems.append(f"{course.get('id', '?')} has no {field}")
    return problems, unknown_rule_ids(courses, known)


def unknown_rule_ids(courses, known):
    """Prerequisite ids that are not courses in the data (often retired courses)."""
    unknown = {}
    for course in courses:
        for required in rule_course_ids(course["prereq_rule"]):
            if required not in known:
                unknown.setdefault(required, []).append(course["id"])
    return unknown


def load_raw_records(use_sample):
    if use_sample:
        sample = json.loads(SAMPLE_FILE.read_text())
        return sample["courses"], [], True
    from parse import parse_raw_pages  # only needed for real data

    records, failures = parse_raw_pages()
    return records, failures, False


def build(use_sample):
    lookup = calendar_lookup()
    subjects_by_code = {subject["code"]: subject for subject in SUBJECTS}
    raw_records, failures, is_sample = load_raw_records(use_sample)

    courses = []
    for raw in raw_records:
        try:
            courses.append(build_course(raw, lookup, subjects_by_code))
        except (BuildError, KeyError) as error:
            failures.append({"code": raw.get("code_text"), "url": raw.get("url"), "reason": str(error)})
    courses.sort(key=lambda course: (course["subject"], course["number"]))

    problems, unknown = sanity_problems(courses)
    used_subjects = {course["subject"] for course in courses}
    statuses = {}
    for course in courses:
        statuses[course["prereq_parse_status"]] = statuses.get(course["prereq_parse_status"], 0) + 1

    generated = datetime.date.today().isoformat()
    write_json(OUT_DIR / "courses.json", {
        "generated": generated,
        "source": SOURCE,
        "sample": is_sample,
        "courses": courses,
    })
    write_json(OUT_DIR / "subjects.json", [s for s in SUBJECTS if s["code"] in used_subjects])
    write_json(OUT_DIR / "unlocks.json", build_unlocks(courses))
    report = {
        "generated": generated,
        "course_count": len(courses),
        "prereq_status_counts": statuses,
        "failures": failures,
        "problems": problems,
        "unknown_prereq_ids": unknown,
        "unparsed": [{"id": c["id"], "prereq_text": c["prereq_text"]}
                     for c in courses if c["prereq_parse_status"] == "unparsed"],
    }
    REPORT_FILE.write_text(json.dumps(report, indent=2) + "\n")
    return report


def write_json(path, data):
    # Compact JSON keeps the first page load small.
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description="Build the site's course data.")
    parser.add_argument("--sample", action="store_true", help="use sample/sample_courses.json")
    report = build(parser.parse_args().sample)
    size_kb = sum(p.stat().st_size for p in OUT_DIR.glob("*.json")) / 1024
    print(f"{report['course_count']} courses, prerequisite status: {report['prereq_status_counts']}")
    print(f"{len(report['failures'])} failures, {len(report['problems'])} problems, "
          f"{len(report['unknown_prereq_ids'])} unknown prerequisite ids")
    print(f"data size: {size_kb:.1f} KB (uncompressed)")


if __name__ == "__main__":
    main()
