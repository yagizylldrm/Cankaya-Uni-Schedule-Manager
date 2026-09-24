import { DEFAULT_PREFERENCES, inputSignature, validatePlan } from './plan.js';

export const DRAFTS_KEY = 'cankaya_plan_drafts_v1';
const LEGACY_KEYS = ['cankaya_course_basket', 'cankaya_preferences', 'cankaya_custom_blocks'];
const emptyProgram = { primaryDept: 'CENG', secondaryDept: 'YOK', secondaryType: 'YOK' };

export function emptyDraft(program = emptyProgram) {
  return { version: 1, basket: {}, preferences: { ...DEFAULT_PREFERENCES }, customBlocks: {},
    program: { ...program }, semester: { start: '', end: '' }, selectedCombination: null };
}

export function readDrafts() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFTS_KEY));
    if (saved?.version === 1 && Array.isArray(saved.drafts) && saved.drafts.length && saved.drafts.length <= 10 &&
        saved.drafts.some(d => d.id === saved.activeId)) {
      return { ...saved, drafts: saved.drafts.map(d => ({ id: d.id, name: d.name, plan: validatePlan(d.plan) })) };
    }
  } catch { /* Fall back to the previous single-plan storage. */ }
  let plan = emptyDraft();
  try {
    const profile = JSON.parse(localStorage.getItem('cankaya_student_profile') || '{}');
    const saved = JSON.parse(localStorage.getItem('cankaya_selected_schedule') || 'null');
    const candidate = { ...plan,
      basket: JSON.parse(localStorage.getItem(LEGACY_KEYS[0]) || '{}'),
      preferences: JSON.parse(localStorage.getItem(LEGACY_KEYS[1]) || JSON.stringify(DEFAULT_PREFERENCES)),
      customBlocks: JSON.parse(localStorage.getItem(LEGACY_KEYS[2]) || '{}'),
      program: { primaryDept: profile.primaryDept || 'CENG', secondaryDept: profile.secondaryDept || 'YOK',
        secondaryType: profile.secondaryType || 'YOK' },
      semester: saved?.plan?.semester || plan.semester,
      selectedCombination: saved?.signature === inputSignature(
        JSON.parse(localStorage.getItem(LEGACY_KEYS[0]) || '{}'),
        JSON.parse(localStorage.getItem(LEGACY_KEYS[1]) || JSON.stringify(DEFAULT_PREFERENCES)),
        JSON.parse(localStorage.getItem(LEGACY_KEYS[2]) || '{}'), profile) ? saved.plan.selectedCombination : null };
    plan = validatePlan(candidate);
  } catch { /* Malformed legacy data must not prevent the app from opening. */ }
  return { version: 1, activeId: 'default', drafts: [{ id: 'default', name: 'Plan 1', plan }] };
}

export function validateDraftName(name, drafts, excludeId = null) {
  const clean = String(name).trim();
  if (!clean || clean.length > 60) throw new Error('Plan adı 1–60 karakter olmalı.');
  if (drafts.some(d => d.id !== excludeId && d.name.toLocaleLowerCase('tr') === clean.toLocaleLowerCase('tr'))) {
    throw new Error('Bu isimde bir plan zaten var.');
  }
  return clean;
}
