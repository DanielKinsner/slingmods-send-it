import type { CourseSpec } from '../../sim/types';
import { SUNSET } from './sunset';
import { PIER } from './pier';
import { validateCourse } from './build';

export const COURSES: CourseSpec[] = [SUNSET, PIER];

for (const c of COURSES) {
  const errs = validateCourse(c);
  if (errs.length) throw new Error(`Course ${c.id} is invalid: ${errs.join('; ')}`);
}

export function courseById(id: string): CourseSpec {
  return COURSES.find((c) => c.id === id) ?? COURSES[0];
}
