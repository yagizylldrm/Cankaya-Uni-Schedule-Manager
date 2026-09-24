import { parseTimeRange } from './plan.js';

function overlaps(a, b) {
  if (a.day !== b.day) return false;
  const first = parseTimeRange(a.time_slot);
  const second = parseTimeRange(b.time_slot);
  if (first && second) return Math.max(first[0], second[0]) < Math.min(first[1], second[1]);
  return a.time_slot === b.time_slot;
}

// A basket contains possible sections, not simultaneous classes. Show one
// section per course while a schedule is pending or no valid one exists.
export function choosePreviewSections(basket, customBlocks = {}) {
  const courses = Object.values(basket).map(course => ({
    code: course.code,
    candidates: (course.allSections || []).filter(section =>
      (course.selectedSections || []).includes(String(section.section_no)))
  }));
  const chosen = [];
  const blocks = Object.values(customBlocks);

  // Decide constrained courses first, then give flexible courses room to avoid them.
  for (const course of [...courses].sort((a, b) => a.candidates.length - b.candidates.length)) {
    let best = null;
    let bestScore = Infinity;
    for (const section of course.candidates) {
      const score = (section.slots || []).reduce((total, slot) =>
        total + chosen.reduce((count, other) => count + (other.slots || []).filter(s => overlaps(slot, s)).length, 0)
        + blocks.filter(block => overlaps(slot, block)).length, 0);
      if (score < bestScore) {
        best = section;
        bestScore = score;
      }
    }
    if (best) chosen.push({ ...best, course_code: course.code });
  }

  const byCode = new Map(chosen.map(section => [section.course_code, section]));
  return courses.map(course => byCode.get(course.code)).filter(Boolean);
}
