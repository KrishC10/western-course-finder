import MiniSearch from 'minisearch';
import type { Course, Subject } from './types';

export interface SearchIndex {
  mini: MiniSearch<Course>;
  courses: Course[];
  byId: Map<string, Course>;
  /** Squashed subject spellings ("cs", "computerscience") -> subject code. */
  aliases: Map<string, string>;
}

export interface SearchResult {
  course: Course;
  /** Set when the query was a course code ("code") or a bare number ("number"). */
  match?: 'code' | 'number';
  /** Indexed words that matched, used to highlight titles and descriptions. */
  terms: string[];
}

export interface SearchOutcome {
  results: SearchResult[];
  /** True when AND found nothing and we fell back to OR. */
  partial: boolean;
  hints: QueryHints;
}

export interface QueryHints {
  text: string;
  noPrereq: boolean;
  level: number | null;
}

export type CodeMatch = { kind: 'code'; id: string } | { kind: 'number'; number: number };

const FIELD_BOOSTS = { code: 5, id: 5, title: 3, subjectText: 2, description: 1 };

/** Lowercase and drop everything except letters, digits and "/". */
export function squash(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9/]+/g, '');
}

export function buildAliasMap(subjects: Subject[]): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const subject of subjects) {
    for (const spelling of [subject.code, subject.name, ...subject.aliases]) {
      aliases.set(squash(spelling), subject.code);
    }
  }
  return aliases;
}

/**
 * Spot queries that are really a course code, however they were typed:
 * "CS 1026", "cs1026", "compsci-1026", "Computer Science 1026A/B", "1026".
 */
export function detectCourseCode(query: string, aliases: Map<string, string>): CodeMatch | null {
  const match = squash(query).match(/^([a-z]*)(\d{4})[a-z/]*$/);
  if (!match) return null;
  const [, letters, digits] = match;
  if (!letters) return { kind: 'number', number: Number(digits) };
  const subject = aliases.get(letters);
  return subject ? { kind: 'code', id: `${subject}-${digits}` } : null;
}

/**
 * Pull plain-English filters out of the query, so the welcome example
 * "no prerequisites first year" does what it says.
 */
export function parseQueryHints(query: string): QueryHints {
  let text = query;
  let noPrereq = false;
  let level: number | null = null;

  const noPrereqPattern = /\b(no|without)\s+pre-?req(uisite)?s?\b/i;
  if (noPrereqPattern.test(text)) {
    noPrereq = true;
    text = text.replace(noPrereqPattern, ' ');
  }
  const years: Array<[RegExp, number]> = [
    [/\b(first|1st)[\s-]+year\b/i, 1000],
    [/\b(second|2nd)[\s-]+year\b/i, 2000],
    [/\b(third|3rd)[\s-]+year\b/i, 3000],
    [/\b(fourth|4th)[\s-]+year\b/i, 4000],
  ];
  for (const [pattern, yearLevel] of years) {
    if (pattern.test(text)) {
      level = yearLevel;
      text = text.replace(pattern, ' ');
    }
  }
  return { text: text.replace(/\s+/g, ' ').trim(), noPrereq, level };
}

function subjectText(course: Course, subjectsByCode: Map<string, Subject>): string {
  const subject = subjectsByCode.get(course.subject);
  return [course.subject_name, ...(subject?.aliases ?? [])].join(' ');
}

/** Typos in longer words are more likely and safer to forgive. */
function fuzzyFor(term: string): number | false {
  if (term.length >= 8) return 2; // "pyschology" is two edits from "psychology"
  if (term.length >= 5) return 1;
  return false;
}

export function buildSearchIndex(courses: Course[], subjects: Subject[]): SearchIndex {
  const subjectsByCode = new Map(subjects.map((subject) => [subject.code, subject]));
  const mini = new MiniSearch<Course>({
    idField: 'id',
    fields: Object.keys(FIELD_BOOSTS),
    storeFields: ['level'],
    extractField: (course, field) => {
      if (field === 'subjectText') return subjectText(course, subjectsByCode);
      return String((course as unknown as Record<string, unknown>)[field] ?? '');
    },
    searchOptions: {
      boost: FIELD_BOOSTS,
      prefix: true,
      fuzzy: fuzzyFor,
      combineWith: 'AND',
      // Most students search for intro courses, so lower levels win near-ties.
      boostDocument: (_id, _term, stored) => 1 + (5000 - Number(stored?.level ?? 0)) / 100000,
    },
  });
  mini.addAll(courses);
  return {
    mini,
    courses: [...courses].sort(byCode),
    byId: new Map(courses.map((course) => [course.id, course])),
    aliases: buildAliasMap(subjects),
  };
}

export function byCode(a: Course, b: Course): number {
  return a.subject.localeCompare(b.subject) || a.number - b.number;
}

/** Run a query: exact code first, then ranked text matches. */
export function search(index: SearchIndex, query: string): SearchOutcome {
  const hints = parseQueryHints(query);
  if (!hints.text) {
    return { results: index.courses.map((course) => ({ course, terms: [] })), partial: false, hints };
  }

  const top = codeMatches(index, hints.text);
  const seen = new Set(top.map((result) => result.course.id));
  let hits = index.mini.search(hints.text);
  let partial = false;
  if (hits.length === 0 && top.length === 0) {
    hits = index.mini.search(hints.text, { combineWith: 'OR' });
    partial = hits.length > 0;
  }

  const ranked = hits
    .filter((hit) => !seen.has(String(hit.id)))
    .map((hit) => ({ hit, course: index.byId.get(String(hit.id))! }))
    .sort((a, b) => b.hit.score - a.hit.score || a.course.level - b.course.level || byCode(a.course, b.course))
    .map(({ hit, course }) => ({ course, terms: hit.terms }));

  return { results: [...top, ...ranked], partial, hints };
}

function codeMatches(index: SearchIndex, text: string): SearchResult[] {
  const code = detectCourseCode(text, index.aliases);
  if (code?.kind === 'code') {
    const course = index.byId.get(code.id);
    return course ? [{ course, match: 'code', terms: [] }] : [];
  }
  if (code?.kind === 'number') {
    return index.courses
      .filter((course) => course.number === code.number)
      .map((course) => ({ course, match: 'number' as const, terms: [] }));
  }
  return [];
}
