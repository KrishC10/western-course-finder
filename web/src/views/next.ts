import type { AppData } from '../data';
import type { Course } from '../types';
import { checkEligibility, groupBySubject, type EligibleCourse } from '../eligibility';
import { search } from '../search';
import { hasPrereqs } from '../filters';
import { loadCompleted, saveCompleted } from '../storage';
import { el, findCourseRefs, plural } from '../text';
import { courseCard } from './card';

const SUGGESTION_LIMIT = 8;

export function renderNext(root: HTMLElement, data: AppData): void {
  let completed = loadCompleted().filter((id) => data.byId.has(id));
  let suggestions: Course[] = [];
  let activeIndex = -1;
  let hideOpen = false;

  const input = el('input', {
    id: 'add-course',
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    role: 'combobox',
    'aria-expanded': 'false',
    'aria-controls': 'add-course-list',
    'aria-autocomplete': 'list',
    'aria-describedby': 'add-course-help',
    placeholder: 'e.g. CS 1026 or Calculus I',
  });
  const listbox = el('ul', { id: 'add-course-list', role: 'listbox', class: 'suggestions', 'aria-label': 'Matching courses' });
  listbox.hidden = true;
  const chips = el('ul', { class: 'chips', 'aria-label': 'Courses you have finished' });
  const clearAll = el('button', { type: 'button', class: 'button-secondary' }, 'Clear all');
  const hideToggle = el('input', { type: 'checkbox', id: 'hide-open' });
  const summary = el('p', { class: 'result-count', role: 'status' });
  const results = el('div', { class: 'next-results' });

  root.append(
    el('h1', { tabindex: '-1' }, 'What can I take next?'),
    el('p', {}, 'Add the courses you have finished. We list every course whose prerequisites you meet.'),
    el(
      'div',
      { class: 'add-box' },
      el('label', { for: 'add-course' }, 'Add a finished course'),
      el('div', { class: 'combobox' }, input, listbox),
      el('p', { id: 'add-course-help', class: 'hint' },
        'Type to search, use the arrow keys to choose, and press Enter to add. Your list is saved only in this browser.'),
    ),
    el('div', { class: 'chips-row' }, chips, clearAll),
    el('p', { class: 'option-inline' }, el('label', { for: 'hide-open' }, hideToggle, ' Hide courses with no prerequisites')),
    summary,
    results,
  );

  function add(course: Course): void {
    if (!completed.includes(course.id)) completed = [...completed, course.id];
    input.value = '';
    closeSuggestions();
    saveAndRender();
    input.focus();
  }

  function remove(id: string): void {
    completed = completed.filter((existing) => existing !== id);
    saveAndRender();
  }

  function saveAndRender(): void {
    saveCompleted(completed);
    renderChips();
    renderResults();
  }

  function renderChips(): void {
    chips.replaceChildren(...completed.map((id) => {
      const course = data.byId.get(id)!;
      const button = el('button', { type: 'button', class: 'chip-remove', 'aria-label': `Remove ${course.code}` }, '×');
      button.addEventListener('click', () => {
        // The chips are redrawn, so find the button now in the same place.
        const index = completed.indexOf(id);
        remove(id);
        const buttons = chips.querySelectorAll<HTMLButtonElement>('.chip-remove');
        (buttons[Math.min(index, buttons.length - 1)] ?? input).focus();
      });
      return el('li', { class: 'chip' }, el('span', {}, course.code), button);
    }));
    if (completed.length === 0) chips.append(el('li', { class: 'hint' }, 'No courses added yet.'));
    clearAll.hidden = completed.length === 0;
  }

  function renderResults(): void {
    const done = new Set(completed);
    const mentioned = (course: Course) => findCourseRefs(course.prereq_text, data.refs).map((ref) => ref.id);
    const outcome = checkEligibility(data.courses, done, mentioned);
    const keep = (entry: EligibleCourse) => !hideOpen || hasPrereqs(entry.course);
    summary.textContent = `${plural(outcome.eligible.length, 'course')} eligible now, `
      + `${outcome.withConditions.length} with conditions, ${outcome.checkCalendar.length} to check.`;

    results.replaceChildren(
      eligibleSection('Eligible now', 'eligible-heading', outcome.eligible.filter(keep),
        'Courses whose prerequisites you meet.'),
      eligibleSection('Eligible with conditions', 'conditions-heading', outcome.withConditions.filter(keep),
        'You meet the course requirements, but there are other conditions, shown on each course.'),
      checkSection(outcome.checkCalendar),
    );
  }

  function eligibleSection(title: string, id: string, entries: EligibleCourse[], help: string): HTMLElement {
    const groups = groupBySubject(entries);
    return el(
      'section',
      { 'aria-labelledby': id, class: 'next-section' },
      el('h2', { id }, `${title} (${entries.length})`),
      el('p', { class: 'hint' }, help),
      entries.length === 0 && el('p', {}, 'Nothing here yet.'),
      ...groups.map(([subjectName, items]) =>
        el(
          'details',
          // Open the subjects where finished courses unlocked something new.
          { open: items.some((item) => item.unlockedByCompleted) },
          el('summary', {}, `${subjectName} (${items.length})`),
          el('ul', { class: 'results' }, ...items.map((item) =>
            el('li', {}, courseCard(item.course, { headingLevel: 'h3', extra: entryNotes(item) })))),
        )),
    );
  }

  function entryNotes(entry: EligibleCourse): HTMLElement | null {
    const warnings = entry.antireqConflicts.map((id) => data.byId.get(id)?.code ?? id);
    const notes = entry.course.prereq_notes;
    if (warnings.length === 0 && notes.length === 0) return null;
    return el(
      'div',
      { class: 'entry-notes' },
      warnings.length > 0 && el('p', { class: 'warning' },
        `Antirequisite: you have taken ${warnings.join(', ')}. You may not get credit for both.`),
      notes.length > 0 && el('p', { class: 'hint' }, `Also requires: ${notes.join('; ')}`),
    );
  }

  function checkSection(courses: Course[]): HTMLElement {
    return el(
      'section',
      { 'aria-labelledby': 'check-heading', class: 'next-section' },
      el('h2', { id: 'check-heading' }, `Check the calendar (${courses.length})`),
      el('p', { class: 'hint' },
        'These courses mention something you have finished, but their rules were too complex to check automatically.'),
      courses.length === 0
        ? el('p', {}, 'Nothing here yet.')
        : el('ul', { class: 'results' }, ...courses.map((course) =>
            el('li', {}, courseCard(course, { headingLevel: 'h3', extra: el('p', { class: 'hint' }, `Prerequisites: ${course.prereq_text}`) })))),
    );
  }

  // --- search-to-add combobox ---

  function openSuggestions(): void {
    const done = new Set(completed);
    suggestions = input.value.trim()
      ? search(data.index, input.value).results.map((r) => r.course).filter((c) => !done.has(c.id)).slice(0, SUGGESTION_LIMIT)
      : [];
    activeIndex = suggestions.length ? 0 : -1;
    drawSuggestions();
  }

  function drawSuggestions(): void {
    listbox.replaceChildren(...suggestions.map((course, index) => {
      const option = el('li', {
        id: `suggestion-${index}`,
        role: 'option',
        class: 'suggestion',
        'aria-selected': String(index === activeIndex),
      }, el('span', { class: 'card-code' }, course.code), ` ${course.title}`);
      // mousedown, not click, so the input does not lose focus first.
      option.addEventListener('mousedown', (event) => {
        event.preventDefault();
        add(course);
      });
      return option;
    }));
    if (input.value.trim() && suggestions.length === 0) {
      listbox.append(el('li', { class: 'suggestion hint', role: 'option', 'aria-disabled': 'true' }, 'No matching courses'));
    }
    const open = listbox.children.length > 0;
    listbox.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (activeIndex >= 0) input.setAttribute('aria-activedescendant', `suggestion-${activeIndex}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function closeSuggestions(): void {
    suggestions = [];
    activeIndex = -1;
    drawSuggestions();
  }

  input.addEventListener('input', openSuggestions);
  input.addEventListener('blur', closeSuggestions);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (suggestions.length === 0) return openSuggestions();
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex = (activeIndex + step + suggestions.length) % suggestions.length;
      drawSuggestions();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0) add(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      closeSuggestions();
    }
  });

  clearAll.addEventListener('click', () => {
    completed = [];
    saveAndRender();
    input.focus();
  });
  hideToggle.addEventListener('change', () => {
    hideOpen = hideToggle.checked;
    renderResults();
  });

  saveAndRender();
}
