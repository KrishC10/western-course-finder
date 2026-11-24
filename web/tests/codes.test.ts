import { describe, expect, it } from 'vitest';
import { buildAliasMap, detectCourseCode, parseQueryHints } from '../src/search';
import { subjects } from './load';

const aliases = buildAliasMap(subjects);
const code = (query: string) => detectCourseCode(query, aliases);

describe('course code detection', () => {
  it.each([
    'CS 1026', 'cs1026', 'compsci 1026', 'Computer Science 1026A/B', // forms from the spec (F2)
    'CS1026B', 'compsci-1026', 'COMPSCI 1026', '  cs   1026  ', 'Comp Sci 1026', 'computer science 1026a/b',
  ])('reads %j as COMPSCI-1026', (query) => {
    expect(code(query)).toEqual({ kind: 'code', id: 'COMPSCI-1026' });
  });

  it('maps common short forms', () => {
    expect(code('psych 1002')).toEqual({ kind: 'code', id: 'PSYCHOL-1002' });
    expect(code('Stats 1024')).toEqual({ kind: 'code', id: 'STATS-1024' });
    expect(code('bus 2257')).toEqual({ kind: 'code', id: 'BUSINESS-2257' });
    expect(code('Media, Information and Technoculture 1020E')).toEqual({ kind: 'code', id: 'MIT-1020' });
  });

  it('treats a bare number as a number search', () => {
    expect(code('1026')).toEqual({ kind: 'number', number: 1026 });
  });

  it('ignores words and unknown subjects', () => {
    expect(code('intro programming')).toBeNull();
    expect(code('xyz 1026')).toBeNull();
    expect(code('102')).toBeNull();
  });
});

describe('query hints', () => {
  it('turns plain-English filters into hints', () => {
    expect(parseQueryHints('no prerequisites first year')).toEqual({ text: '', noPrereq: true, level: 1000 });
    expect(parseQueryHints('psychology 2nd year')).toEqual({ text: 'psychology', noPrereq: false, level: 2000 });
  });
});
