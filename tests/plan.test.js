import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlan, validatePlan, buildCalendar, buildCSV, inputSignature, parseTimeRange } from '../src/utils/plan.js';

const section = { section_no: '2', instructor: 'Öğretim Üyesi', classroom: 'B-102', slots: [{ day: 'Pazartesi', time_slot: '09:00/09:20' }] };
const state = {
  basket: { CENG101: { code: 'CENG101', name: 'Ders', credit: 3, ects: 5, selectedSections: ['2'], allSections: [section] } },
  profile: { primaryDept: 'CENG', secondaryType: 'YOK', secondaryDept: 'YOK', passedCourses: { SECRET: { grade: 'AA' } } },
  preferences: { free_friday: false, free_monday: false, no_morning: false },
  customBlocks: { 'Pazartesi:12:00 - 12:50': { day: 'Pazartesi', time_slot: '12:00 - 12:50', title: 'Özel; etkinlik, öğle', note: 'Private note' } },
  selectedCombination: { sections: [{ ...section, course_code: 'CENG101' }] },
  semester: { start: '2026-09-21', end: '2026-10-04' },
};

test('saved plan round trip preserves chosen sections and drops transcript/unknown properties', () => {
  const saved = createPlan(state);
  const restored = validatePlan(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(saved, restored);
  assert.equal(restored.selectedCombination.sections[0].section_no, '2');
  assert.equal(restored.selectedCombination.total_credits, 3);
  assert.ok(!JSON.stringify(saved).includes('SECRET'));
  assert.ok(!JSON.stringify(saved).includes('passedCourses'));
});

test('reject malformed plans and selected sections that disagree with basket', () => {
  for (const value of [null, [], {}, { version: 999 }, { ...createPlan(state), basket: [] }]) assert.throws(() => validatePlan(value));
  const plan = createPlan(state);
  plan.selectedCombination.sections[0].section_no = '9';
  assert.throws(() => validatePlan(plan));
  const changed = createPlan(state);
  changed.selectedCombination.sections[0].slots[0].time_slot = '11:00 - 11:50';
  assert.throws(() => validatePlan(changed));
});

test('signature detects changes in every scheduling input and ignores property order', () => {
  const sig = inputSignature(state.basket, state.preferences, state.customBlocks, state.profile);
  assert.equal(sig, inputSignature(state.basket, { no_morning: false, free_monday: false, free_friday: false }, state.customBlocks, state.profile));
  assert.notEqual(sig, inputSignature({}, state.preferences, state.customBlocks, state.profile));
  assert.notEqual(sig, inputSignature(state.basket, { ...state.preferences, free_friday: true }, state.customBlocks, state.profile));
  assert.notEqual(sig, inputSignature(state.basket, state.preferences, {}, state.profile));
  assert.notEqual(sig, inputSignature(state.basket, state.preferences, state.customBlocks, { ...state.profile, primaryDept: 'IE' }));
});

test('calendar honors inclusive semester dates, Istanbul time and short-period duration', () => {
  const calendar = buildCalendar(createPlan(state));
  assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(calendar.includes('DTSTART:20260921T060000Z'));
  assert.ok(calendar.includes('DTEND:20260921T065000Z'));
  assert.ok(calendar.includes('DTSTART:20260928T060000Z'));
  assert.ok(!calendar.includes('Private note'));
  assert.ok(!calendar.includes('20261005'));
  assert.ok(calendar.endsWith('\r\n'));
});

test('calendar omits earlier weekdays and escapes optional private activities', () => {
  const plan = createPlan(state);
  plan.semester = { start: '2026-09-22', end: '2026-09-28' };
  const calendar = buildCalendar(plan, true);
  assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(calendar.includes('Özel\\; etkinlik\\, öğle'));
  assert.ok(calendar.includes('Private note'));
  assert.ok(!calendar.includes('20260921T'));
});

test('calendar validates dates and folds UTF-8 at 75 bytes', () => {
  const plan = createPlan(state);
  plan.selectedCombination.sections[0].instructor = 'Çankaya '.repeat(50);
  const calendar = buildCalendar(plan);
  for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  assert.ok(calendar.replace(/\r\n /g, '').includes('Çankaya '.repeat(50)));
  for (const semester of [{ start: '', end: '' }, { start: '2026-02-30', end: '2026-03-01' }, { start: '2026-10-01', end: '2026-09-01' }]) {
    assert.throws(() => buildCalendar({ ...plan, semester }));
  }
  assert.equal(parseTimeRange('25:00 - 26:00'), null);
  assert.equal(parseTimeRange('10:00 - 09:00'), null);
});

test('CSV exports chosen sections, Turkish headers and normalized times without grades', () => {
  const csv = buildCSV(createPlan(state));
  assert.ok(csv.startsWith('\uFEFF"Tür","Ders Kodu"'));
  assert.ok(csv.includes('"Ders","CENG101","Ders","2","Pazartesi","09:00","09:50","Öğretim Üyesi","B-102","3","5",""'));
  assert.equal(csv.split('\r\n').length, 3);
  assert.ok(!csv.includes('SECRET'));
  assert.ok(!csv.includes('Private note'));
  assert.throws(() => buildCSV({ ...createPlan(state), selectedCombination: null }));
});

test('CSV quotes commas, quotes and newlines and neutralizes formulas in optional activities', () => {
  const plan = createPlan(state);
  plan.basket.CENG101.name = 'Ders, "İleri"\nProgramlama';
  const block = Object.values(plan.customBlocks)[0];
  block.title = '=1+1';
  block.note = 'Öğle, "ara"\nNot';
  const csv = buildCSV(plan, true);
  assert.ok(csv.includes('"Ders, ""İleri""\nProgramlama"'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"Öğle, ""ara""\nNot"'));
  assert.ok(csv.indexOf('"Ders","CENG101"') < csv.indexOf('"Etkinlik"'));
});

test('CSV keeps courses with unknown times and orders timed rows by weekday', () => {
  const plan = createPlan(state);
  plan.selectedCombination.sections[0].slots = [];
  const csv = buildCSV(plan, true);
  assert.ok(csv.includes('"Ders","CENG101","Ders","2","","",""'));
  assert.ok(csv.indexOf('"Etkinlik"') < csv.indexOf('"Ders","CENG101"'));
});
