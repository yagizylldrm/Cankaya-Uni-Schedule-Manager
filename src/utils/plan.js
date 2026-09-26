export const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const DEFAULT_PREFERENCES = {
  free_monday: false,
  free_tuesday: false,
  free_wednesday: false,
  free_thursday: false,
  free_friday: false,
  no_morning: false,
  no_lunch_break: false,
};

export function inputSignature(basket, preferences, customBlocks, profile) {
  const canonical = value => Array.isArray(value) ? value.map(canonical) :
    value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
  return JSON.stringify(canonical({ basket, preferences, customBlocks,
    program: { primaryDept: profile.primaryDept, secondaryDept: profile.secondaryDept, secondaryType: profile.secondaryType } }));
}

export function parseTimeRange(value) {
  const match = typeof value === 'string' && value.match(/^(\d{1,2}):(\d{2})\s*[-/]\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, h, m, eh, em] = match.map(Number);
  if (h > 23 || eh > 23 || m > 59 || em > 59) return null;
  const start = h * 60 + m;
  let end = eh * 60 + em;
  if (end <= start) return null;
  // Match the university's short-period notation used by the scheduler.
  if (end - start < 30) end = start + 50;
  return end <= 1440 ? [start, end] : null;
}

export function createPlan({ basket, preferences, customBlocks, profile, selectedCombination, semester }) {
  return validatePlan({ version: 1, basket, preferences, customBlocks, selectedCombination, semester,
    program: { primaryDept: profile.primaryDept, secondaryDept: profile.secondaryDept, secondaryType: profile.secondaryType } });
}

function compressText(text) {
  const bytes = new TextEncoder().encode(text);
  const input = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  const dictionary = new Map(Array.from({ length: 256 }, (_, index) => [String.fromCharCode(index), index]));
  const codes = [];
  let phrase = '';
  let nextCode = 256;
  for (const character of input) {
    const combined = phrase + character;
    if (dictionary.has(combined)) phrase = combined;
    else {
      if (phrase) codes.push(dictionary.get(phrase));
      if (nextCode < 65536) dictionary.set(combined, nextCode++);
      phrase = character;
    }
  }
  if (phrase) codes.push(dictionary.get(phrase));
  return String.fromCharCode(...codes.flatMap(code => [code >> 8, code & 255]));
}

function decompressText(binary) {
  if (binary.length % 2) throw new Error('Invalid compressed payload');
  const codes = [];
  for (let index = 0; index < binary.length; index += 2) {
    codes.push((binary.charCodeAt(index) << 8) | binary.charCodeAt(index + 1));
  }
  if (!codes.length) throw new Error('Empty compressed payload');
  const dictionary = new Map(Array.from({ length: 256 }, (_, index) => [index, String.fromCharCode(index)]));
  let nextCode = 256;
  let phrase = dictionary.get(codes[0]);
  let output = phrase;
  for (const code of codes.slice(1)) {
    const entry = dictionary.get(code) ?? (code === nextCode ? phrase + phrase[0] : null);
    if (entry == null) throw new Error('Invalid compressed payload');
    output += entry;
    if (nextCode < 65536) dictionary.set(nextCode++, phrase + entry[0]);
    phrase = entry;
  }
  return new TextDecoder().decode(Uint8Array.from(output, character => character.charCodeAt(0)));
}

export function buildSharePayload(plan) {
  const basket = Object.fromEntries(Object.entries(plan.basket).map(([code, course]) => [code, {
    code: course.code,
    selectedSections: course.selectedSections,
  }]));
  const envelope = { version: 1, plan: { basket, preferences: plan.preferences, customBlocks: plan.customBlocks,
    selectedCombination: plan.selectedCombination, semester: plan.semester, program: plan.program } };
  return btoa(compressText(JSON.stringify(envelope))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function parseSharePayload(encoded) {
  try {
    if (typeof encoded !== 'string' || encoded.length > 100000) return null;
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const envelope = JSON.parse(decompressText(atob(base64 + '='.repeat((4 - base64.length % 4) % 4))));
    if (envelope?.version !== 1 || !envelope.plan) return null;
    const data = envelope.plan;
    const combinationSections = Array.isArray(data.selectedCombination?.sections) ? data.selectedCombination.sections : [];
    const basket = Object.fromEntries(Object.entries(data.basket).map(([code, course]) => {
      const selectedSections = course.selectedSections;
      const combinationSection = combinationSections.find(section => section.course_code === code);
      const untimed = combinationSection?.section_no === 'SAATSIZ' && combinationSection.slots?.length === 0 &&
        combinationSection.instructor === 'Belirsiz' && !combinationSection.classroom;
      const allSections = untimed || !Array.isArray(selectedSections) ? [] : selectedSections.map(sectionNo => {
        const selected = combinationSections.find(section => section.course_code === code && String(section.section_no) === sectionNo);
        return selected ? { section_no: selected.section_no, instructor: selected.instructor,
          classroom: selected.classroom, slots: selected.slots } : { section_no: sectionNo, instructor: '', classroom: '', slots: [] };
      });
      return [code, { code: course.code, name: code, dept_code: '', credit: 0, ects: 0, type: '', type_label: '',
        ...(untimed ? { untimed: true } : {}), allSections, selectedSections }];
    }));
    return validatePlan({ version: 1, basket, preferences: data.preferences, customBlocks: data.customBlocks,
      selectedCombination: data.selectedCombination, semester: data.semester, program: data.program });
  } catch {
    return null;
  }
}

export function validatePlan(data) {
  const fail = () => { throw new Error('Geçerli bir program dosyası seçin (sürüm 1).'); };
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  const str = (v, fallback = '') => v === undefined ? fallback : typeof v === 'string' && v.length <= 5000 ? v : fail();
  const num = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fail();
  const slot = s => {
    if (!object(s) || !DAYS.includes(s.day) || !parseTimeRange(s.time_slot)) fail();
    return { day: s.day, time_slot: s.time_slot, classroom: str(s.classroom) };
  };
  const section = s => {
    if (!object(s) || !Array.isArray(s.slots) || s.slots.length > 100 || !['string', 'number'].includes(typeof s.section_no)) fail();
    return { section_no: String(s.section_no), instructor: str(s.instructor), classroom: str(s.classroom),
      slots: s.slots.map(t => slot({ ...t, classroom: t.classroom || s.classroom })) };
  };
  if (!object(data) || data.version !== 1 || !object(data.basket) || Object.keys(data.basket).length > 100) fail();
  const basket = {};
  for (const [code, c] of Object.entries(data.basket)) {
    if (!/^[A-ZÇĞİÖŞÜ0-9 -]{1,30}$/i.test(code) || !object(c) || c.code !== code ||
        !Array.isArray(c.allSections) || c.allSections.length > 100 || !Array.isArray(c.selectedSections)) fail();
    const allSections = c.allSections.map(section);
    if (c.selectedSections.some(s => typeof s !== 'string' || !allSections.some(a => a.section_no === s))) fail();
    const untimed = c.untimed === true;
    if (untimed && (allSections.length !== 0 || c.selectedSections.length !== 0)) fail();
    basket[code] = { code, name: str(c.name, code), dept_code: str(c.dept_code), credit: num(c.credit), ects: num(c.ects),
      type: str(c.type), type_label: str(c.type_label), ...(untimed ? { untimed: true } : {}),
      allSections, selectedSections: [...new Set(c.selectedSections)] };
  }
  const preferences = { ...DEFAULT_PREFERENCES };
  if (!object(data.preferences)) fail();
  for (const key of Object.keys(DEFAULT_PREFERENCES)) {
    if (typeof data.preferences[key] === 'boolean') preferences[key] = data.preferences[key];
  }
  if (!object(data.customBlocks) || Object.keys(data.customBlocks).length > 500) fail();
  const customBlocks = {};
  for (const b of Object.values(data.customBlocks)) {
    const clean = slot(b);
    customBlocks[`${clean.day}:${clean.time_slot}`] = { ...clean, title: str(b.title), note: str(b.note), color: str(b.color, 'amber') };
  }
  const p = data.program;
  if (!object(p) || !['YOK', 'CAP', 'YANDAL'].includes(p.secondaryType)) fail();
  const program = { primaryDept: str(p.primaryDept), secondaryDept: str(p.secondaryDept), secondaryType: p.secondaryType };
  const semester = { start: str(data.semester?.start), end: str(data.semester?.end) };
  if (semester.start || semester.end) validateSemester(semester);
  let selectedCombination = null;
  if (data.selectedCombination != null) {
    const combo = data.selectedCombination;
    if (!object(combo) || !Array.isArray(combo.sections) || combo.sections.length !== Object.keys(basket).length) fail();
    const seen = new Set();
    const sections = combo.sections.map(s => {
      const clean = section(s);
      const code = str(s.course_code);
      if (!basket[code] || seen.has(code)) fail();
      seen.add(code);
      if (basket[code].untimed && clean.section_no === 'SAATSIZ' && clean.slots.length === 0 &&
          clean.instructor === 'Belirsiz' && clean.classroom === '') return { ...clean, course_code: code };
      if (!basket[code].selectedSections.includes(clean.section_no)) fail();
      const original = basket[code].allSections.find(a => a.section_no === clean.section_no);
      if (JSON.stringify(original) !== JSON.stringify(clean)) fail();
      return { ...clean, course_code: code };
    });
    selectedCombination = { index: 0, sections, total_courses: sections.length,
      total_credits: Object.values(basket).reduce((n, c) => n + c.credit, 0),
      total_ects: Object.values(basket).reduce((n, c) => n + c.ects, 0),
      days_count: new Set(sections.flatMap(s => s.slots.map(t => t.day))).size };
  }
  return { version: 1, basket, preferences, customBlocks, program, semester, selectedCombination };
}

export function validateSemester({ start, end }) {
  const date = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!date(start) || !date(end) || start > end || Date.parse(end) - Date.parse(start) > 366 * 86400000) {
    throw new Error('Dönem başlangıç ve bitiş tarihlerini girin (en fazla bir yıl).');
  }
}

const escapeText = value => String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
function foldLine(line) {
  let result = '', bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += char;
    bytes += size;
  }
  return result;
}

// Resolve Istanbul wall time using the runtime's timezone database, independent
// of the user's device timezone. Export individual UTC occurrences (no DST drift).
function istanbulTime(date, minutes) {
  const wall = Date.parse(`${date}T00:00:00Z`) + minutes * 60000;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(wall));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  const rendered = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
  return new Date(wall - (rendered - wall)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildCalendar(plan, includeActivities = false) {
  validateSemester(plan.semester);
  if (!plan.selectedCombination?.sections.length) throw new Error('Önce bir program oluşturun.');
  const events = plan.selectedCombination.sections.flatMap(s => s.slots.map(t => ({ ...t,
    title: `${s.course_code} · Şube ${s.section_no}`, location: t.classroom || s.classroom,
    identity: `${s.course_code}-${s.section_no}`, description: s.instructor || '' })));
  if (includeActivities) events.push(...Object.values(plan.customBlocks).map(b => ({ ...b, identity: `activity-${b.title}`, description: b.note || '', location: '' })));
  if (!events.length) throw new Error('Bu programda takvime aktarılabilecek ders saati bulunmuyor.');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cankaya Schedule Manager//TR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Çankaya Ders Programı'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const seen = new Set();
  for (const event of events) {
    const range = parseTimeRange(event.time_slot);
    if (!range || !DAYS.includes(event.day)) throw new Error(`Ders saati aktarılamadı: ${event.title}`);
    const first = new Date(`${plan.semester.start}T00:00:00Z`);
    first.setUTCDate(first.getUTCDate() + (DAYS.indexOf(event.day) - (first.getUTCDay() + 6) % 7 + 7) % 7);
    for (let date = first; date.toISOString().slice(0, 10) <= plan.semester.end; date.setUTCDate(date.getUTCDate() + 7)) {
      const day = date.toISOString().slice(0, 10);
      const uid = `${encodeURIComponent(`${event.identity}-${day}-${range[0]}-${range[1]}`)}@cankaya-schedule`;
      if (seen.has(uid)) continue;
      seen.add(uid);
      lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART:${istanbulTime(day, range[0])}`,
        `DTEND:${istanbulTime(day, range[1])}`, `SUMMARY:${escapeText(event.title)}`,
        `LOCATION:${escapeText(event.location || '')}`, `DESCRIPTION:${escapeText(event.description)}`, 'END:VEVENT');
    }
  }
  if (!seen.size) throw new Error('Seçilen tarih aralığında ders bulunmuyor.');
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function buildCSV(plan, includeActivities = false) {
  if (!plan.selectedCombination?.sections.length) throw new Error('Önce bir program oluşturun.');
  const rows = [];
  const time = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const addRow = (slot, fields) => {
    const range = slot ? parseTimeRange(slot.time_slot) : null;
    rows.push({ day: slot?.day || '', start: range?.[0] ?? Infinity,
      cells: [...fields.slice(0, 4), slot?.day || '', range ? time(range[0]) : '', range ? time(range[1]) : '', ...fields.slice(4)] });
  };
  for (const section of plan.selectedCombination.sections) {
    const course = plan.basket[section.course_code];
    for (const slot of section.slots.length ? section.slots : [null]) {
      addRow(slot, ['Ders', section.course_code, course?.name || section.course_code, section.section_no,
        section.instructor || '', slot?.classroom || section.classroom || '', course?.credit ?? '', course?.ects ?? '', '']);
    }
  }
  if (includeActivities) for (const block of Object.values(plan.customBlocks)) {
    addRow(block, ['Etkinlik', '', block.title, '', '', block.classroom || '', '', '', block.note || '']);
  }
  const dayIndex = day => DAYS.includes(day) ? DAYS.indexOf(day) : DAYS.length;
  rows.sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || a.start - b.start);
  const cell = value => {
    let text = String(value);
    // Keep text from being interpreted as a spreadsheet formula.
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const header = ['Tür', 'Ders Kodu', 'Ders / Etkinlik', 'Şube', 'Gün', 'Başlangıç', 'Bitiş', 'Öğretim Elemanı', 'Derslik', 'Kredi', 'AKTS', 'Not'];
  // UTF-8 BOM keeps Turkish characters intact when opening in spreadsheets.
  return '\uFEFF' + [header, ...rows.map(r => r.cells)].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function downloadFile(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
