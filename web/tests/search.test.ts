import { describe, expect, it } from 'vitest';
import { buildSearchIndex, search } from '../src/search';
import { courses, subjects } from './load';

const index = buildSearchIndex(courses, subjects);
const topIds = (query: string, n = 5) => search(index, query).results.slice(0, n).map((r) => r.course.id);

describe('exact course codes rank first (F2)', () => {
  it.each(['CS 1026', 'cs1026', 'compsci 1026', '1026', 'Computer Science 1026A/B'])('%j', (query) => {
    const first = search(index, query).results[0];
    expect(first.course.id).toBe('COMPSCI-1026');
    expect(first.match).toBeDefined();
  });
});

// Real student-style queries and a course that must be in the top 5.
const QUERIES: Array<[string, string]> = [
  ['intro programming', 'COMPSCI-1026'],
  ['pyschology', 'PSYCHOL-1002'],
  ['intro psychology', 'PSYCHOL-1002'],
  ['data structures', 'COMPSCI-2210'],
  ['linear algebra', 'MATH-1600'],
  ['microeconomics', 'ECON-1021'],
  ['machine learning', 'DATASCI-3000'],
  ['databases', 'COMPSCI-3319'],
  ['operating systems', 'COMPSCI-3305'],
  ['organic chemistry', 'CHEM-2213'],
  ['genetics', 'BIOLOGY-2581'],
  ['statistics for psychology', 'PSYCHOL-2810'],
  ['calculus', 'CALCULUS-1000'],
  ['artificial intelligence', 'COMPSCI-3346'],
  ['accounting', 'BUSINESS-2257'],
  ['video game', 'COMPSCI-4482'],
  ['econ 1022', 'ECON-1022'],
  ['intro philosophy', 'PHILOSOP-1020'],
  ['computer graphics', 'COMPSCI-3350'],
  ['algoritms', 'COMPSCI-3340'],
  ['psych 2810', 'PSYCHOL-2810'],
  ['intro stats', 'STATS-1024'],
  ['writing essays', 'WRITING-1000'],
  ['climate change', 'GEOGRAPH-1500'],
];

describe('student queries find the right course in the top 5', () => {
  it.each(QUERIES)('%j -> %s', (query, expected) => {
    expect(topIds(query)).toContain(expected);
  });
});

describe('search behaviour', () => {
  it('typos still match psychology courses (F3)', () => {
    const ids = topIds('pyschology');
    expect(ids.every((id) => id.startsWith('PSYCHOL-'))).toBe(true);
  });

  it('falls back to partial matches instead of showing nothing', () => {
    const outcome = search(index, 'psychology zebra');
    expect(outcome.partial).toBe(true);
    expect(outcome.results.length).toBeGreaterThan(0);
  });

  it('an empty box lists every course in code order', () => {
    const ids = search(index, '').results.map((r) => r.course.id);
    expect(ids).toHaveLength(courses.length);
    expect(ids[0] < ids[ids.length - 1]).toBe(true);
  });

  it('answers in under 50 ms (F12)', () => {
    const start = performance.now();
    for (const [query] of QUERIES) search(index, query);
    const average = (performance.now() - start) / QUERIES.length;
    expect(average).toBeLessThan(50);
  });
});
