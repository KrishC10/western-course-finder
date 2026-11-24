import './styles.css';
import { loadData, type AppData } from './data';
import { parseRoute } from './router';
import { el, formatDate } from './text';
import { renderSearch } from './views/search';
import { renderCourse } from './views/course';
import { renderNext } from './views/next';

const app = document.getElementById('app')!;

function route(data: AppData, moveFocus: boolean): void {
  const current = parseRoute(location.hash);
  app.replaceChildren();
  app.removeAttribute('aria-busy');

  if (current.name === 'course') renderCourse(app, data, current.id);
  else if (current.name === 'next') renderNext(app, data);
  else renderSearch(app, data, current.params);

  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-nav]')) {
    const active = link.dataset.nav === (current.name === 'next' ? 'next' : 'search');
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.title = current.name === 'course'
    ? `${data.byId.get(current.id)?.code ?? 'Course'} · Western Course Finder`
    : current.name === 'next' ? 'What can I take next? · Western Course Finder' : 'Western Course Finder';

  if (moveFocus) {
    // Tell screen reader users the page changed, the way a full page load would.
    window.scrollTo(0, 0);
    app.querySelector<HTMLElement>('h1')?.focus();
  }
}

function showFooterInfo(data: AppData): void {
  document.getElementById('data-date')!.textContent = formatDate(data.generated);
  if (data.isSample) {
    document.getElementById('sample-notice')!.replaceChildren(
      el('strong', {}, 'Sample data. '),
      'This preview uses a small made-up sample of courses, not the real calendar.',
    );
    document.getElementById('sample-notice')!.hidden = false;
  }
}

function showLoadError(error: unknown): void {
  app.removeAttribute('aria-busy');
  app.replaceChildren(
    el('h1', {}, 'Could not load course data'),
    el('p', {}, 'Please check your connection and reload the page.'),
    el('p', { class: 'hint' }, String(error)),
  );
}

loadData()
  .then((data) => {
    showFooterInfo(data);
    window.addEventListener('hashchange', () => route(data, true));
    route(data, false);
  })
  .catch(showLoadError);
