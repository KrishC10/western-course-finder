import type { Course, CoursesFile, Subject, UnlocksFile } from './types';
import { buildSearchIndex, type SearchIndex } from './search';
import { courseRefMatcher, type CourseRefMatcher } from './text';

/** Everything the views need, loaded once at start-up. */
export interface AppData {
  courses: Course[];
  byId: Map<string, Course>;
  subjects: Subject[];
  unlocks: UnlocksFile;
  generated: string;
  isSample: boolean;
  index: SearchIndex;
  refs: CourseRefMatcher;
}

async function getJson<T>(name: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
  if (!response.ok) throw new Error(`Could not load ${name} (${response.status})`);
  return response.json() as Promise<T>;
}

export async function loadData(): Promise<AppData> {
  const [coursesFile, subjects, unlocks] = await Promise.all([
    getJson<CoursesFile>('courses.json'),
    getJson<Subject[]>('subjects.json'),
    getJson<UnlocksFile>('unlocks.json'),
  ]);
  return makeAppData(coursesFile, subjects, unlocks);
}

/** Separate from loadData so tests can build the same data from files on disk. */
export function makeAppData(coursesFile: CoursesFile, subjects: Subject[], unlocks: UnlocksFile): AppData {
  const courses = coursesFile.courses;
  return {
    courses,
    byId: new Map(courses.map((course) => [course.id, course])),
    subjects,
    unlocks,
    generated: coursesFile.generated,
    isSample: Boolean(coursesFile.sample),
    index: buildSearchIndex(courses, subjects),
    refs: courseRefMatcher(subjects),
  };
}
