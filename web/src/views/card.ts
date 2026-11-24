import type { Course } from '../types';
import { el, highlight } from '../text';
import { hasPrereqs } from '../filters';

export interface CardOptions {
  terms?: string[];
  match?: 'code' | 'number';
  /** Extra content under the description, e.g. an antirequisite warning. */
  extra?: Node | null;
  headingLevel?: 'h2' | 'h3' | 'h4';
}

export function creditLabel(course: Course): string {
  return `${course.credit_weight.toFixed(1)} credit`;
}

export function breadthLabel(course: Course): string {
  return course.breadth.length ? `Breadth ${course.breadth.join(' or ')}` : 'No breadth category';
}

/** First sentence of the description, for a one-line summary. */
function summary(description: string): string {
  const firstParagraph = description.split('\n')[0];
  const sentence = firstParagraph.match(/^.*?[.!?](\s|$)/);
  return (sentence ? sentence[0] : firstParagraph).trim();
}

export function courseCard(course: Course, options: CardOptions = {}): HTMLElement {
  const terms = options.terms ?? [];
  const heading = el(
    options.headingLevel ?? 'h2',
    { class: 'card-title' },
    el(
      'a',
      { href: `#/course/${course.id}` },
      el('span', { class: 'card-code' }, course.code),
      ' ',
      el('span', {}, highlight(course.title, terms)),
    ),
  );

  const badges = el(
    'p',
    { class: 'card-meta' },
    options.match === 'code' && el('span', { class: 'badge badge-match' }, 'Exact match'),
    options.match === 'number' && el('span', { class: 'badge badge-match' }, 'Number match'),
    el('span', { class: 'badge' }, creditLabel(course)),
    el('span', { class: 'badge' }, breadthLabel(course)),
    !hasPrereqs(course) && el('span', { class: 'badge badge-open' }, 'No prerequisites'),
  );

  return el(
    'article',
    { class: 'card' },
    heading,
    badges,
    el('p', { class: 'card-desc' }, highlight(summary(course.description), terms)),
    options.extra,
  );
}
