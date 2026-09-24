// Saved plans keep user choices; names and section metadata come from the API.
export function refreshBasketMetadata(basket, details) {
  let changed = false;
  const next = { ...basket };
  for (const detail of details) {
    const old = basket[detail.code];
    if (!old) continue; // A delayed response must not restore a removed course.
    const sections = detail.sections || [];
    const validNumbers = new Set(sections.map(s => String(s.section_no)));
    const { untimed: _previousUntimed, ...oldWithoutUntimed } = old;
    const updated = { ...oldWithoutUntimed, name: detail.name, dept_code: detail.dept_code,
      type: detail.type, type_label: detail.type_label,
      ...(detail.untimed === true ? { untimed: true } : {}), allSections: sections,
      selectedSections: old.selectedSections.filter(n => validNumbers.has(String(n))) };
    if (JSON.stringify(updated) !== JSON.stringify(old)) {
      next[detail.code] = updated;
      changed = true;
    }
  }
  return changed ? next : basket;
}

export function refreshCombinationInstructors(combinations, details) {
  const byCode = new Map(details.map(d => [d.code, d]));
  let changed = false;
  const next = combinations.map(combo => ({ ...combo, sections: combo.sections.map(section => {
    const current = byCode.get(section.course_code)?.sections.find(s => String(s.section_no) === String(section.section_no));
    if (current && current.instructor !== section.instructor) {
      changed = true;
      return { ...section, instructor: current.instructor };
    }
    return section;
  }) }));
  return changed ? next : combinations;
}
