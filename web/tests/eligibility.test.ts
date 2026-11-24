import { describe, expect, it } from 'vitest';
import { checkEligibility, isSatisfied } from '../src/eligibility';
import { courseRefMatcher, findCourseRefs } from '../src/text';
import type { Course, Rule } from '../src/types';
import { courses, subjects } from './load';

const matcher = courseRefMatcher(subjects);
const mentioned = (course: Course) => findCourseRefs(course.prereq_text, matcher).map((ref) => ref.id);

/** Courses with partial status and no course rule: always "with conditions" unless finished. */
const ALWAYS_CONDITIONAL = [
  'BIOLOGY-1001', 'CALCULUS-1000', 'CALCULUS-1500', 'CHEM-1301', 'ENGLISH-1022',
  'ENGSCI-1036', 'HISTORY-2125', 'MATH-1229', 'PHYSICS-1501',
];
const NO_PREREQS = courses.filter((c) => c.prereq_parse_status === 'none').map((c) => c.id);

interface Transcript {
  name: string;
  completed: string[];
  /** Eligible courses that have prerequisites (open courses are checked separately). */
  eligible: string[];
  /** Partial-status courses with a course rule that is met. */
  conditional: string[];
  checkCalendar: string[];
  /** Course -> finished courses it clashes with. */
  antireqs: Record<string, string[]>;
}

// Each expected list was worked out by hand from the sample prerequisite rules.
const TRANSCRIPTS: Transcript[] = [
  {
    name: 'nothing finished yet',
    completed: [],
    eligible: [],
    conditional: [],
    checkCalendar: [],
    antireqs: {},
  },
  {
    name: 'one programming course and matrix algebra',
    completed: ['COMPSCI-1026', 'MATH-1229'],
    eligible: ['COMPSCI-1027', 'STATS-2244'],
    conditional: [],
    checkCalendar: ['MATH-1600'],
    antireqs: { 'ENGSCI-1036': ['COMPSCI-1026'] },
  },
  {
    name: 'first-year computer science',
    completed: ['COMPSCI-1026', 'COMPSCI-1027', 'MATH-1600', 'CALCULUS-1000', 'STATS-1024'],
    eligible: [
      'CALCULUS-1301', 'CALCULUS-1501', 'COMPSCI-2208', 'COMPSCI-2209', 'COMPSCI-2210', 'COMPSCI-2211',
      'COMPSCI-2214', 'DATASCI-2000', 'MATH-1120', 'MATH-2155', 'STATS-2244',
    ],
    conditional: [],
    checkCalendar: ['CALCULUS-2502', 'ECON-2122'],
    antireqs: { 'CALCULUS-1500': ['CALCULUS-1000'], 'MATH-1229': ['MATH-1600'], 'ENGSCI-1036': ['COMPSCI-1026'] },
  },
  {
    name: 'second-year computer science',
    completed: [
      'COMPSCI-1026', 'COMPSCI-1027', 'MATH-1600', 'STATS-1024', 'COMPSCI-2208', 'COMPSCI-2209',
      'COMPSCI-2210', 'COMPSCI-2211', 'COMPSCI-2214', 'STATS-2244',
    ],
    eligible: [
      'COMPSCI-2212', 'COMPSCI-3305', 'COMPSCI-3319', 'COMPSCI-3331', 'COMPSCI-3342', 'COMPSCI-3346',
      'COMPSCI-3350', 'DATASCI-2000', 'MATH-1120', 'MATH-2155', 'SE-2250',
    ],
    conditional: [],
    checkCalendar: ['CALCULUS-2502', 'COMPSCI-3340', 'ECON-2122'],
    antireqs: { 'MATH-2155': ['COMPSCI-2214'] },
  },
  {
    name: 'psychology and biology',
    completed: ['PSYCHOL-1002', 'PSYCHOL-2810', 'BIOLOGY-1001', 'BIOLOGY-1002', 'CHEM-1301', 'SOCIOLOG-1020', 'STATS-1024'],
    eligible: [
      'BIOLOGY-2290', 'BIOLOGY-2483', 'CHEM-1302', 'PSYCHOL-2035', 'PSYCHOL-2040', 'PSYCHOL-2220',
      'SOCIOLOG-2205', 'STATS-2244',
    ],
    conditional: ['BIOLOGY-2581', 'PSYCHOL-2800'],
    checkCalendar: ['ECON-2122', 'PSYCHOL-3301'],
    antireqs: { 'SOCIOLOG-2205': ['STATS-1024'], 'STATS-2244': ['PSYCHOL-2810'] },
  },
];

describe.each(TRANSCRIPTS)('transcript: $name', (transcript) => {
  const done = new Set(transcript.completed);
  const result = checkEligibility(courses, done, mentioned);
  const ids = (entries: Array<{ course: Course }>) => entries.map((e) => e.course.id).sort();

  it('lists exactly the expected eligible courses', () => {
    const withPrereqs = result.eligible.filter((e) => e.course.prereq_parse_status !== 'none');
    expect(ids(withPrereqs)).toEqual([...transcript.eligible].sort());
  });

  it('always includes unfinished courses with no prerequisites', () => {
    const open = result.eligible.filter((e) => e.course.prereq_parse_status === 'none').map((e) => e.course.id);
    expect(open.sort()).toEqual(NO_PREREQS.filter((id) => !done.has(id)).sort());
  });

  it('lists the expected courses with conditions', () => {
    const expected = [...transcript.conditional, ...ALWAYS_CONDITIONAL.filter((id) => !done.has(id))];
    expect(ids(result.withConditions)).toEqual(expected.sort());
  });

  it('sends unreadable rules to "check the calendar"', () => {
    expect(result.checkCalendar.map((c) => c.id).sort()).toEqual([...transcript.checkCalendar].sort());
  });

  it('warns about antirequisites', () => {
    const warnings: Record<string, string[]> = {};
    for (const entry of [...result.eligible, ...result.withConditions]) {
      if (entry.antireqConflicts.length) warnings[entry.course.id] = entry.antireqConflicts;
    }
    expect(warnings).toEqual(transcript.antireqs);
  });

  it('never lists a finished course', () => {
    const all = [...result.eligible, ...result.withConditions].map((e) => e.course.id);
    expect(all.filter((id) => done.has(id))).toEqual([]);
  });
});

describe('isSatisfied', () => {
  const rule: Rule = { and: ['A-1000', { or: ['B-1000', 'C-1000'] }] };
  it('needs every AND child and one OR child', () => {
    expect(isSatisfied(rule, new Set(['A-1000', 'C-1000']))).toBe(true);
    expect(isSatisfied(rule, new Set(['A-1000']))).toBe(false);
    expect(isSatisfied(rule, new Set(['B-1000', 'C-1000']))).toBe(false);
  });
  it('treats no rule as satisfied', () => {
    expect(isSatisfied(null, new Set())).toBe(true);
  });
});
