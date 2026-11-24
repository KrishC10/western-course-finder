import { describe, expect, it } from 'vitest';
import { applyFilters, emptyFilters, facetCounts } from '../src/filters';
import { buildSearchIndex, search } from '../src/search';
import { filtersFromParams, searchHash } from '../src/router';
import { courses, subjects } from './load';

const index = buildSearchIndex(courses, subjects);

describe('filters (F4)', () => {
  it('narrow results and combine with search', () => {
    const { results, hints } = search(index, 'statistics');
    const state = { ...emptyFilters(), subject: ['STATS'] };
    const filtered = applyFilters(results, state, hints);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(results.length);
    expect(filtered.every((r) => r.course.subject === 'STATS')).toBe(true);
  });

  it('counts options inside a facet as if that facet were not applied', () => {
    const { results } = search(index, '');
    const state = { ...emptyFilters(), level: ['1000'] };
    const { counts } = facetCounts(results, state);
    // Level counts ignore the level filter, so other levels stay visible...
    expect(counts.level.get('2000')).toBeGreaterThan(0);
    // ...while other facets are counted within level 1000 only.
    const firstYear = courses.filter((c) => c.level === 1000);
    expect(counts.subject.get('COMPSCI')).toBe(firstYear.filter((c) => c.subject === 'COMPSCI').length);
  });

  it('no-prerequisites filter keeps only open courses', () => {
    const state = { ...emptyFilters(), noPrereq: true };
    const filtered = applyFilters(search(index, '').results, state);
    expect(filtered.every((r) => r.course.prereq_parse_status === 'none')).toBe(true);
  });
});

describe('URL state (F9)', () => {
  it('round-trips search text and filters', () => {
    const state = { ...emptyFilters(), subject: ['COMPSCI', 'MATH'], level: ['2000'], noPrereq: true };
    const hash = searchHash('data structures', state);
    const params = new URLSearchParams(hash.split('?')[1]);
    expect(params.get('q')).toBe('data structures');
    expect(filtersFromParams(params)).toEqual(state);
  });

  it('an empty search is the home page', () => {
    expect(searchHash('  ', emptyFilters())).toBe('#/');
  });
});
