import type { AppData } from '../data';
import type { Course } from '../types';
import { el, linkifyCourses } from '../text';
import { lastSearchHash } from '../router';
import { breadthLabel, creditLabel } from './card';

const STATUS_NOTES: Record<Course['prereq_parse_status'], string> = {
  none: '',
  parsed: '',
  partial: 'Some requirements are not courses; they are listed below.',
  unparsed: 'This rule was too complex to read automatically. Check the official calendar for details.',
};

export function renderCourse(root: HTMLElement, data: AppData, id: string): void {
  const course = data.byId.get(id);
  const back = el('a', { href: lastSearchHash(), class: 'back-link' }, '← Back to search');
  if (!course) {
    root.append(
      back,
      el('h1', { tabindex: '-1' }, 'Course not found'),
      el('p', {}, `There is no course with the code ${id} in this data. It may have been renamed or retired.`),
    );
    return;
  }

  const linkify = (text: string) => linkifyCourses(text, data.refs, (courseId) => data.byId.has(courseId));
  root.append(
    back,
    el(
      'article',
      { class: 'course' },
      el('p', { class: 'course-code' }, course.code),
      el('h1', { tabindex: '-1' }, course.title),
      el(
        'p',
        { class: 'card-meta' },
        el('span', { class: 'badge' }, creditLabel(course)),
        el('span', { class: 'badge' }, breadthLabel(course)),
        el('span', { class: 'badge' }, `${course.level} level`),
        el('span', { class: 'badge' }, course.faculty),
      ),
      ...course.description.split('\n\n').map((paragraph) => el('p', { class: 'course-desc' }, paragraph)),
      requirements(course, linkify),
      unlocksSection(course, data),
      el(
        'p',
        {},
        el('a', { href: course.url, class: 'button', target: '_blank', rel: 'noopener' },
          'View on official calendar', el('span', { class: 'visually-hidden' }, ' (opens in a new tab)')),
      ),
    ),
  );
}

function requirements(course: Course, linkify: (text: string) => DocumentFragment): HTMLElement {
  const rows: Array<[string, Node]> = [];
  const prereqs = course.prereq_text
    ? el(
        'div',
        {},
        el('p', {}, linkify(course.prereq_text)),
        STATUS_NOTES[course.prereq_parse_status] && el('p', { class: 'hint' }, STATUS_NOTES[course.prereq_parse_status]),
        course.prereq_notes.length > 0 &&
          el('ul', { class: 'notes' }, ...course.prereq_notes.map((note) => el('li', {}, note))),
      )
    : el('p', {}, 'None');
  rows.push(['Prerequisites', prereqs]);
  if (course.coreq_text) rows.push(['Corequisites', el('p', {}, linkify(course.coreq_text))]);
  if (course.antireq_text) rows.push(['Antirequisites', el('p', {}, linkify(course.antireq_text))]);
  if (course.extra_info) rows.push(['Extra information', el('p', {}, course.extra_info)]);

  return el(
    'section',
    { class: 'requirements', 'aria-labelledby': 'requirements-heading' },
    el('h2', { id: 'requirements-heading' }, 'Requirements'),
    el('dl', {}, ...rows.flatMap(([label, value]) => [el('dt', {}, label), el('dd', {}, value)])),
  );
}

function unlocksSection(course: Course, data: AppData): HTMLElement {
  const unlocked = (data.unlocks[course.id] ?? [])
    .map((id) => data.byId.get(id))
    .filter((found): found is Course => found !== undefined);
  return el(
    'section',
    { class: 'unlocks', 'aria-labelledby': 'unlocks-heading' },
    el('h2', { id: 'unlocks-heading' }, 'Unlocks'),
    unlocked.length === 0
      ? el('p', {}, 'No other course lists this one as a prerequisite.')
      : el(
          'div',
          {},
          el('p', { class: 'hint' }, 'Courses that list this course in their prerequisites (some may need other courses too):'),
          el('ul', { class: 'link-list' }, ...unlocked.map((other) =>
            el('li', {}, el('a', { href: `#/course/${other.id}` }, el('span', { class: 'card-code' }, other.code), ` ${other.title}`)))),
        ),
  );
}
