// Hash routing: GitHub Pages only serves files, so the view lives after "#".
import { FACETS, emptyFilters, type FilterState } from './filters';

export type Route =
  | { name: 'search'; params: URLSearchParams }
  | { name: 'course'; id: string }
  | { name: 'next' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const [route, queryString = ''] = path.split('?');
  const courseMatch = route.match(/^\/course\/([A-Za-z]+-\d{4})$/);
  if (courseMatch) return { name: 'course', id: courseMatch[1].toUpperCase() };
  if (route === '/next') return { name: 'next' };
  return { name: 'search', params: new URLSearchParams(queryString) };
}

export function filtersFromParams(params: URLSearchParams): FilterState {
  const state = emptyFilters();
  for (const facet of FACETS) {
    state[facet.key] = (params.get(facet.key) ?? '').split(',').filter(Boolean);
  }
  state.noPrereq = params.get('noprereq') === '1';
  return state;
}

export function searchHash(query: string, filters: FilterState): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  for (const facet of FACETS) {
    if (filters[facet.key].length) params.set(facet.key, filters[facet.key].join(','));
  }
  if (filters.noPrereq) params.set('noprereq', '1');
  const queryString = params.toString();
  return queryString ? `#/search?${queryString}` : '#/';
}

/** The last search the student made, so a course page can link back to it. */
let lastSearch = '#/';

export function rememberSearch(hash: string): void {
  lastSearch = hash;
}

export function lastSearchHash(): string {
  return lastSearch;
}
