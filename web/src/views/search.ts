import type { AppData } from '../data';
import { search, type SearchOutcome } from '../search';
import {
  FACETS, activeFilterCount, applyFilters, facetCounts, facetOptions,
  type Facet, type FacetKey, type FilterState,
} from '../filters';
import { filtersFromParams, rememberSearch, searchHash } from '../router';
import { el, plural } from '../text';
import { courseCard } from './card';

const PAGE_SIZE = 30;
const DEBOUNCE_MS = 150;
const EXAMPLES = ['CS 2210', 'intro psychology', 'no prerequisites first year', 'pyschology'];

/** One checkbox per filter option; counts are updated in place so focus is never lost. */
interface OptionControl {
  input: HTMLInputElement;
  count: HTMLElement;
  row: HTMLElement;
}

export function renderSearch(root: HTMLElement, data: AppData, params: URLSearchParams): void {
  let query = params.get('q') ?? '';
  const filters = filtersFromParams(params);
  let shown = PAGE_SIZE;

  const input = el('input', {
    id: 'search-input',
    type: 'search',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'Course code, title or topic',
    'aria-describedby': 'search-help',
  });
  input.value = query;

  const welcome = el(
    'div',
    { class: 'welcome' },
    el('p', {}, 'Search every undergraduate course by code, title, subject or description. Try:'),
    el('ul', { class: 'examples' }, ...EXAMPLES.map((example) =>
      el('li', {}, el('a', { href: searchHash(example, filters) }, example)))),
  );

  const optionControls = new Map<string, OptionControl>();
  const noPrereq = filterOption('noPrereq', 'true', 'No prerequisites', filters.noPrereq);
  const filterPanel = el(
    'div',
    { class: 'filters', id: 'filters' },
    el('h2', { class: 'filters-heading' }, 'Filters'),
    ...FACETS.map((facet) => facetFieldset(facet)),
    el('fieldset', {}, el('legend', {}, 'Prerequisites'), el('ul', { class: 'options' }, noPrereq.row)),
    el('button', { type: 'button', class: 'button-secondary', id: 'clear-filters' }, 'Clear all filters'),
  );

  const filterToggle = el('button', {
    type: 'button',
    class: 'filters-toggle button-secondary',
    'aria-expanded': 'false',
    'aria-controls': 'filters',
  });

  const status = el('p', { class: 'result-count', role: 'status' });
  const note = el('p', { class: 'result-note' });
  const list = el('ol', { class: 'results' });
  const more = el('button', { type: 'button', class: 'button-secondary load-more' }, 'Load more');

  root.append(
    el('h1', { class: 'visually-hidden', tabindex: '-1' }, 'Search courses'),
    el(
      'form',
      { role: 'search', class: 'search-form' },
      el('label', { for: 'search-input', class: 'search-label' }, 'Search courses'),
      input,
      el('p', { id: 'search-help', class: 'hint' }, 'For example "CS 1026", "intro programming" or "Psych".'),
    ),
    welcome,
    el(
      'div',
      { class: 'search-layout' },
      el('aside', { class: 'filters-column', 'aria-label': 'Filters' }, filterToggle, filterPanel),
      el('section', { class: 'results-column', 'aria-label': 'Results' }, status, note, list, more),
    ),
  );

  function facetFieldset(facet: Facet): HTMLElement {
    const options = facetOptions(data.courses, facet);
    const subjectNames = new Map(data.subjects.map((subject) => [subject.code, subject.name]));
    const label = (value: string) =>
      facet.key === 'subject' ? `${subjectNames.get(value) ?? value} (${value})` : facet.optionLabel(value);
    return el(
      'fieldset',
      {},
      el('legend', {}, facet.label),
      el(
        'ul',
        { class: facet.key === 'subject' ? 'options options-scroll' : 'options' },
        ...options.map((value) => filterOption(facet.key, value, label(value), filters[facet.key].includes(value)).row),
      ),
    );
  }

  function filterOption(key: FacetKey | 'noPrereq', value: string, label: string, checked: boolean): OptionControl {
    const id = `filter-${key}-${value}`.replace(/[^A-Za-z0-9-]/g, '-');
    const checkbox = el('input', { type: 'checkbox', id, name: key, value, checked });
    const count = el('span', { class: 'count' });
    const row = el('li', {}, el('label', { for: id }, checkbox, el('span', { class: 'option-label' }, label), count));
    const control = { input: checkbox, count, row };
    optionControls.set(`${key}:${value}`, control);
    checkbox.addEventListener('change', () => {
      toggleFilter(filters, key, value, checkbox.checked);
      shown = PAGE_SIZE;
      update();
    });
    return control;
  }

  function update(): void {
    const outcome = search(data.index, query);
    const filtered = applyFilters(outcome.results, filters, outcome.hints);
    updateCounts(outcome);
    welcome.hidden = query.trim() !== '';

    status.textContent = plural(filtered.length, 'course');
    note.textContent = describeOutcome(outcome);
    note.hidden = note.textContent === '';

    list.replaceChildren(...filtered.slice(0, shown).map((result) =>
      el('li', {}, courseCard(result.course, { terms: result.terms, match: result.match }))));
    if (filtered.length === 0) {
      list.append(el('li', { class: 'empty' }, 'No courses match. Try fewer filters or a different word.'));
    }
    more.hidden = filtered.length <= shown;
    more.textContent = `Load more (${plural(filtered.length - shown, 'more course')})`;

    const filterCount = activeFilterCount(filters);
    filterToggle.textContent = filterCount ? `Filters (${filterCount})` : 'Filters';

    const hash = searchHash(query, filters);
    rememberSearch(hash);
    if (location.hash !== hash && !(location.hash === '' && hash === '#/')) {
      // replaceState, so typing does not fill the back button with one entry per letter.
      history.replaceState(null, '', hash);
    }
  }

  function updateCounts(outcome: SearchOutcome): void {
    const { counts, noPrereq: noPrereqCount } = facetCounts(outcome.results, filters, outcome.hints);
    for (const facet of FACETS) {
      for (const [key, control] of optionControls) {
        if (!key.startsWith(`${facet.key}:`)) continue;
        const value = key.slice(facet.key.length + 1);
        setCount(control, counts[facet.key].get(value) ?? 0);
      }
    }
    setCount(noPrereq, noPrereqCount);
  }

  let timer: number | undefined;
  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      query = input.value;
      shown = PAGE_SIZE;
      update();
    }, DEBOUNCE_MS);
  });
  root.querySelector('form')!.addEventListener('submit', (event) => event.preventDefault());

  filterToggle.addEventListener('click', () => {
    const open = filterToggle.getAttribute('aria-expanded') !== 'true';
    filterToggle.setAttribute('aria-expanded', String(open));
    filterPanel.classList.toggle('is-open', open);
  });

  filterPanel.querySelector('#clear-filters')!.addEventListener('click', () => {
    for (const facet of FACETS) filters[facet.key] = [];
    filters.noPrereq = false;
    for (const control of optionControls.values()) control.input.checked = false;
    shown = PAGE_SIZE;
    update();
  });

  more.addEventListener('click', () => {
    const firstNew = shown;
    shown += PAGE_SIZE;
    update();
    // Move focus to the first new result so keyboard users keep their place.
    list.children[firstNew]?.querySelector('a')?.focus();
  });

  update();
}

function setCount(control: OptionControl, count: number): void {
  control.count.textContent = `(${count})`;
  // Options that would show nothing stay visible but dimmed, unless ticked.
  control.row.classList.toggle('is-empty', count === 0 && !control.input.checked);
}

function toggleFilter(filters: FilterState, key: FacetKey | 'noPrereq', value: string, on: boolean): void {
  if (key === 'noPrereq') {
    filters.noPrereq = on;
    return;
  }
  const values = filters[key].filter((existing) => existing !== value);
  filters[key] = on ? [...values, value] : values;
}

function describeOutcome(outcome: SearchOutcome): string {
  const parts: string[] = [];
  if (outcome.partial) parts.push('No course matched every word. Showing partial matches.');
  if (outcome.hints.noPrereq) parts.push('Only courses with no prerequisites.');
  if (outcome.hints.level) parts.push(`Only ${outcome.hints.level}-level courses.`);
  return parts.join(' ');
}
