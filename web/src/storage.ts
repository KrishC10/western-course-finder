// A student's finished courses stay in their own browser and nowhere else.
// Storage can be blocked (private windows, strict settings), so every call
// is guarded and the app still works, just without remembering.
const KEY = 'western-course-finder.completed.v1';

export function loadCompleted(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveCompleted(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Nothing to do: the list still works for this visit.
  }
}
