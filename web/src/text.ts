// Small helpers for turning data into DOM safely. Course text is never put
// into innerHTML, so nothing in the data can inject markup.
import type { Subject } from './types';

type Child = Node | string | null | undefined | false;

/** Create an element: el('a', { href: '#/' }, 'Home'). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    element.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child);
  }
  return element;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Wrap matched search words in <mark>. */
export function highlight(text: string, terms: string[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const words = terms.filter((term) => term.length > 1).map(escapeRegex);
  if (words.length === 0) {
    fragment.append(text);
    return fragment;
  }
  const pattern = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    fragment.append(text.slice(position, match.index), el('mark', {}, match[0]));
    position = match.index! + match[0].length;
  }
  fragment.append(text.slice(position));
  return fragment;
}

export interface CourseRef {
  start: number;
  end: number;
  id: string;
}

export interface CourseRefMatcher {
  pattern: RegExp;
  subjectByName: Map<string, string>;
}

/** Same rule as scraper/codes.py: subject names or codes, longest first. */
export function courseRefMatcher(subjects: Subject[]): CourseRefMatcher {
  const subjectByName = new Map<string, string>();
  for (const subject of subjects) {
    subjectByName.set(subject.code.toLowerCase(), subject.code);
    subjectByName.set(subject.name.toLowerCase(), subject.code);
  }
  const names = [...subjectByName.keys()].sort((a, b) => b.length - a.length).map(escapeRegex);
  const pattern = new RegExp(`(?:\\b(${names.join('|')})\\s+)?\\b(\\d{4})([A-Z](?:/[A-Z])*)?\\b`, 'gi');
  return { pattern, subjectByName };
}

/**
 * Find course references in calendar text. "Mathematics 1600A/B or 1229A/B"
 * gives two refs: the bare number borrows the subject before it.
 */
export function findCourseRefs(text: string, matcher: CourseRefMatcher): CourseRef[] {
  const refs: CourseRef[] = [];
  let lastSubject: string | null = null;
  for (const match of text.matchAll(matcher.pattern)) {
    if (match[1]) lastSubject = matcher.subjectByName.get(match[1].toLowerCase()) ?? null;
    if (!lastSubject) continue;
    refs.push({ start: match.index!, end: match.index! + match[0].length, id: `${lastSubject}-${match[2]}` });
  }
  return refs;
}

/** Calendar text with each known course turned into a link to its page. */
export function linkifyCourses(text: string, matcher: CourseRefMatcher, exists: (id: string) => boolean): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let position = 0;
  for (const ref of findCourseRefs(text, matcher)) {
    if (!exists(ref.id)) continue;
    fragment.append(text.slice(position, ref.start));
    fragment.append(el('a', { href: `#/course/${ref.id}` }, text.slice(ref.start, ref.end)));
    position = ref.end;
  }
  fragment.append(text.slice(position));
  return fragment;
}

/** "2026-11-24" -> "November 24, 2026", without time-zone surprises. */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function plural(count: number, word: string): string {
  return `${count.toLocaleString('en-CA')} ${word}${count === 1 ? '' : 's'}`;
}
