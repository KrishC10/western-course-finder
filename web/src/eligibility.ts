// "What can I take next?" as plain functions with no page code, so it can be unit-tested.
import type { Course, Rule } from './types';

export interface EligibleCourse {
  course: Course;
  /** Completed courses that are antirequisites of this one. */
  antireqConflicts: string[];
  /** True when the rule names a course the student has finished. */
  unlockedByCompleted: boolean;
}

export interface EligibilityResult {
  eligible: EligibleCourse[];
  withConditions: EligibleCourse[];
  /** Courses whose rule we could not read, limited to ones that mention a finished course. */
  checkCalendar: Course[];
}

export function isSatisfied(rule: Rule | null, completed: Set<string>): boolean {
  if (rule === null) return true;
  if (typeof rule === 'string') return completed.has(rule);
  if ('and' in rule) return rule.and.every((child) => isSatisfied(child, completed));
  return rule.or.some((child) => isSatisfied(child, completed));
}

export function ruleCourseIds(rule: Rule | null): string[] {
  if (rule === null) return [];
  if (typeof rule === 'string') return [rule];
  const children = 'and' in rule ? rule.and : rule.or;
  return children.flatMap(ruleCourseIds);
}

/** Antirequisites can be listed on either course, so check both directions. */
export function antireqConflicts(course: Course, completed: Set<string>, byId: Map<string, Course>): string[] {
  const conflicts = new Set(course.antireq_ids.filter((id) => completed.has(id)));
  for (const doneId of completed) {
    if (byId.get(doneId)?.antireq_ids.includes(course.id)) conflicts.add(doneId);
  }
  return [...conflicts].sort();
}

/**
 * Sort every course the student has not finished into eligible, eligible
 * with conditions, or "check the calendar".
 *
 * `mentionedIds` lists course ids written in a course's prerequisite text;
 * it is used only for unparsed rules, to show the ones relevant to this student.
 */
export function checkEligibility(
  courses: Course[],
  completed: Set<string>,
  mentionedIds: (course: Course) => string[],
): EligibilityResult {
  const byId = new Map(courses.map((course) => [course.id, course]));
  const result: EligibilityResult = { eligible: [], withConditions: [], checkCalendar: [] };

  for (const course of courses) {
    if (completed.has(course.id)) continue;
    const status = course.prereq_parse_status;

    if (status === 'unparsed') {
      if (mentionedIds(course).some((id) => completed.has(id))) result.checkCalendar.push(course);
      continue;
    }
    if (!isSatisfied(course.prereq_rule, completed)) continue;

    const entry: EligibleCourse = {
      course,
      antireqConflicts: antireqConflicts(course, completed, byId),
      unlockedByCompleted: ruleCourseIds(course.prereq_rule).some((id) => completed.has(id)),
    };
    if (status === 'partial') result.withConditions.push(entry);
    else result.eligible.push(entry);
  }
  return result;
}

/** Group courses by subject name, keeping each group in course-code order. */
export function groupBySubject<T extends { course: Course }>(items: T[]): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const name = item.course.subject_name;
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
