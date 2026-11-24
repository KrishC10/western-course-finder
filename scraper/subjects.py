"""Subject codes, full names, faculties and the short aliases students type.

Codes, names and faculties come from the calendar. Aliases are hand-written
because students type "CS" or "Psych", which the calendar never does.
When real data is scraped, any subject missing here is listed in
parse_report.json so it can be added.
"""

SUBJECTS = [
    {"code": "BIOLOGY", "name": "Biology", "faculty": "Science", "aliases": ["bio", "biol"]},
    {"code": "BUSINESS", "name": "Business Administration", "faculty": "Ivey Business School", "aliases": ["bus", "bu", "business"]},
    {"code": "CALCULUS", "name": "Calculus", "faculty": "Science", "aliases": ["calc"]},
    {"code": "CHEM", "name": "Chemistry", "faculty": "Science", "aliases": ["chem"]},
    {"code": "COMPSCI", "name": "Computer Science", "faculty": "Science", "aliases": ["cs", "comp sci", "compsci"]},
    {"code": "DATASCI", "name": "Data Science", "faculty": "Science", "aliases": ["ds", "data sci"]},
    {"code": "ECON", "name": "Economics", "faculty": "Social Science", "aliases": ["econ", "eco"]},
    {"code": "ENGLISH", "name": "English", "faculty": "Arts and Humanities", "aliases": ["eng", "engl"]},
    {"code": "ENGSCI", "name": "Engineering Science", "faculty": "Engineering", "aliases": ["es", "eng sci"]},
    {"code": "GEOGRAPH", "name": "Geography", "faculty": "Social Science", "aliases": ["geog", "geo"]},
    {"code": "HISTORY", "name": "History", "faculty": "Social Science", "aliases": ["hist"]},
    {"code": "MATH", "name": "Mathematics", "faculty": "Science", "aliases": ["math", "maths"]},
    {"code": "MIT", "name": "Media, Information and Technoculture", "faculty": "Information and Media Studies", "aliases": ["mit", "media"]},
    {"code": "PHILOSOP", "name": "Philosophy", "faculty": "Arts and Humanities", "aliases": ["phil", "philo"]},
    {"code": "PHYSICS", "name": "Physics", "faculty": "Science", "aliases": ["phys"]},
    {"code": "PSYCHOL", "name": "Psychology", "faculty": "Social Science", "aliases": ["psych", "psyc", "psy"]},
    {"code": "SE", "name": "Software Engineering", "faculty": "Engineering", "aliases": ["se", "softeng", "soft eng"]},
    {"code": "SOCIOLOG", "name": "Sociology", "faculty": "Social Science", "aliases": ["soc", "socio"]},
    {"code": "STATS", "name": "Statistical Sciences", "faculty": "Science", "aliases": ["stats", "stat", "statistics"]},
    {"code": "WRITING", "name": "Writing", "faculty": "Arts and Humanities", "aliases": ["writ"]},
]


def calendar_lookup(subjects=SUBJECTS):
    """Map lowercase subject code or full name to the subject code.

    Used when reading calendar text, which only ever uses codes or full names.
    Aliases are left out on purpose: "es" or "bio" followed by a number in
    prerequisite text would be a coincidence, not a course.
    """
    lookup = {}
    for subject in subjects:
        lookup[subject["code"].lower()] = subject["code"]
        lookup[subject["name"].lower()] = subject["code"]
    return lookup
