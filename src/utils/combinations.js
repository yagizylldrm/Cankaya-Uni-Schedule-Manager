import { parseTimeRange } from './plan.js';

function timetableKey(combination) {
  const courses = (combination.sections || []).map(section => {
    const meetings = (section.slots || []).map(slot => {
      const range = parseTimeRange(slot.time_slot);
      return [slot.day, ...(range || [slot.time_slot])];
    });
    meetings.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return [section.course_code, meetings];
  });
  courses.sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify(courses);
}

export function uniqueTimetableCombinations(combinations) {
  const seen = new Set();
  const unique = [];
  for (const combination of combinations) {
    const key = timetableKey(combination);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...combination, index: unique.length });
  }
  return unique;
}
