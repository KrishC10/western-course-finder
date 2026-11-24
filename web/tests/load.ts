// Read the same JSON the site ships with, straight from disk.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CoursesFile, Subject, UnlocksFile } from '../src/types';

const dataDir = fileURLToPath(new URL('../public/data/', import.meta.url));
const read = <T>(name: string): T => JSON.parse(readFileSync(dataDir + name, 'utf8')) as T;

export const coursesFile = read<CoursesFile>('courses.json');
export const courses = coursesFile.courses;
export const subjects = read<Subject[]>('subjects.json');
export const unlocks = read<UnlocksFile>('unlocks.json');
