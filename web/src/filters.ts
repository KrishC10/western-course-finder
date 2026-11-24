import type { Course } from './types';
import type { QueryHints, SearchResult } from './search';

export type FacetKey = 'faculty' | 'subject' | 'level' | 'weight' | 'breadth';

export interface FilterState {
  faculty: string[];
  subject: string[];
  level: string[];
  weight: string[];
  breadth: string[];
  noPrereq: boolean;
}

export interface Facet {
  key: FacetKey;
  label: string;
  /** The values a course has for this facet (breadth can have two). */
  values: (course: Course) => string[];
  optionLabel: (value: string) => string;
}

export const FACETS: Facet[] = [
  { key: 'faculty', label: 'Faculty', values: (c) => [c.faculty], optionLabel: (v) => v },
  { key: 'subject', label: 'Subject', values: (c) => [c.subject], optionLabel: (v) => v },
  { key: 'level', label: 'Level', values: (c) => [String(c.level)], optionLabel: (v) => `${v} level` },
  { key: 'weight', label: 'Credit weight', values: (c) => [String(c.credit_weight)], optionLabel: (v) => `${Number(v).toFixed(1)} credit` },
  { key: 'breadth', label: 'Breadth', values: (c) => c.breadth, optionLabel: (v) => `Category ${v}` },
];

export function emptyFilters(): FilterState {
  return { faculty: [], subject: [], level: [], weight: [], breadth: [], noPrereq: false };
}

export function hasPrereqs(course: Course): boolean {
  return course.prereq_parse_status !== 'none';
}

/**
 * Keep results that pass every facet. Within one facet, ticking several
 * options means "any of these"; across facets it means "all of these".
 * `skip` leaves one facet out, which is how option counts are worked out.
 */
export function applyFilters(
  results: SearchResult[],
  state: FilterState,
  hints?: QueryHints,
  skip?: FacetKey | 'noPrereq',
): SearchResult[] {
  return results.filter(({ course }) => {
    if (hints?.level && course.level !== hints.level) return false;
    if (hints?.noPrereq && hasPrereqs(course)) return false;
    if (skip !== 'noPrereq' && state.noPrereq && hasPrereqs(course)) return false;
    return FACETS.every((facet) => {
      const chosen = state[facet.key];
      if (facet.key === skip || chosen.length === 0) return true;
      return facet.values(course).some((value) => chosen.includes(value));
    });
  });
}

/**
 * How many results each option would show. Options are counted as if their
 * own facet were not applied, so students can see the alternatives.
 */
export function facetCounts(
  results: SearchResult[],
  state: FilterState,
  hints?: QueryHints,
): { counts: Record<FacetKey, Map<string, number>>; noPrereq: number } {
  const counts = {} as Record<FacetKey, Map<string, number>>;
  for (const facet of FACETS) {
    const tally = new Map<string, number>();
    for (const { course } of applyFilters(results, state, hints, facet.key)) {
      for (const value of facet.values(course)) tally.set(value, (tally.get(value) ?? 0) + 1);
    }
    counts[facet.key] = tally;
  }
  const noPrereq = applyFilters(results, state, hints, 'noPrereq').filter(({ course }) => !hasPrereqs(course)).length;
  return { counts, noPrereq };
}

/** Every option for a facet across the whole catalogue, in a sensible order. */
export function facetOptions(courses: Course[], facet: Facet): string[] {
  const values = new Set(courses.flatMap((course) => facet.values(course)));
  return [...values].sort((a, b) => (isNaN(Number(a)) ? a.localeCompare(b) : Number(a) - Number(b)));
}

export function activeFilterCount(state: FilterState): number {
  return FACETS.reduce((total, facet) => total + state[facet.key].length, 0) + (state.noPrereq ? 1 : 0);
}
