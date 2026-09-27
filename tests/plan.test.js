import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlan,
  validatePlan,
  buildCalendar,
  buildCSV,
  inputSignature,
  parseTimeRange,
  buildSharePayload,
  parseSharePayload,
} from '../src/utils/plan.js';
import { emptyDraft, validateDraftName } from '../src/utils/drafts.js';
import { choosePreviewSections } from '../src/utils/previewSections.js';
import { generateCombinations } from '../src/services/api.js';
import {
  SportsApiError,
  encryptPassword,
  loginSports,
} from '../src/services/sportsApi.js';

function bytesToPem(bytes) {
  const base64 = Buffer.from(bytes).toString('base64');
  const lines = base64.match(/.{1,64}/g).join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----\n`;
}

async function createLoginKey(keyId = 'test-key') {
  const keyPair = await globalThis.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  );
  const spki = await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey);
  return {
    keyId,
    keyPair,
    pem: bytesToPem(new Uint8Array(spki))
  };
}

async function decryptLoginCiphertext(key, ciphertext) {
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    key,
    Buffer.from(ciphertext, 'base64')
  );
  return new TextDecoder().decode(plaintext);
}

test('sports password encryption uses SPKI RSA-OAEP SHA-256', async () => {
  const key = await createLoginKey();
  const ciphertext = await encryptPassword('güvenli-şifre', key.pem);

  assert.notEqual(ciphertext, 'güvenli-şifre');
  assert.equal(
    await decryptLoginCiphertext(key.keyPair.privateKey, ciphertext),
    'güvenli-şifre'
  );
});

test('sports login fetches a key and never sends plaintext password', async () => {
  const originalFetch = globalThis.fetch;
  const key = await createLoginKey('key-one');
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (options.method === 'GET') {
      return {
        ok: true,
        json: async () => ({
          key_id: key.keyId,
          public_key_pem: key.pem,
          algorithm: 'RSA-OAEP',
          hash: 'SHA-256',
          max_plaintext_bytes: 190
        })
      };
    }
    return {
      ok: true,
      json: async () => ({ token: 'session-token', username: 'student' })
    };
  };

  try {
    await loginSports('student', 'secret-password');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, '/api/sports-booking/public-key');
    assert.equal(requests[0].options.method, 'GET');
    assert.equal(requests[0].options.body, undefined);
    const loginBody = JSON.parse(requests[1].options.body);
    assert.equal(loginBody.username, 'student');
    assert.equal(loginBody.key_id, key.keyId);
    assert.equal(Object.hasOwn(loginBody, 'password'), false);
    assert.equal(
      await decryptLoginCiphertext(key.keyPair.privateKey, loginBody.encrypted_password),
      'secret-password'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sports login retries exactly once after a stale worker key', async () => {
  const originalFetch = globalThis.fetch;
  const keys = [await createLoginKey('key-one'), await createLoginKey('key-two')];
  let getCount = 0;
  let postCount = 0;
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'GET') {
      const key = keys[getCount++];
      return {
        ok: true,
        json: async () => ({
          key_id: key.keyId,
          public_key_pem: key.pem,
          algorithm: 'RSA-OAEP',
          hash: 'SHA-256',
          max_plaintext_bytes: 190
        })
      };
    }

    postCount += 1;
    if (postCount === 1) {
      return {
        ok: false,
        status: 409,
        json: async () => ({
          detail: { code: 'LOGIN_KEY_STALE', message: 'Anahtar yenilendi.' }
        })
      };
    }
    const body = JSON.parse(options.body);
    assert.equal(body.key_id, 'key-two');
    assert.equal(
      await decryptLoginCiphertext(keys[1].keyPair.privateKey, body.encrypted_password),
      'secret-password'
    );
    return {
      ok: true,
      json: async () => ({ token: 'session-token', username: 'student' })
    };
  };

  try {
    await loginSports('student', 'secret-password');
    assert.equal(getCount, 2);
    assert.equal(postCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sports login fails closed after a second stale worker key', async () => {
  const originalFetch = globalThis.fetch;
  const keys = [await createLoginKey('key-one'), await createLoginKey('key-two')];
  let getCount = 0;
  let postCount = 0;
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'GET') {
      const key = keys[getCount++];
      return {
        ok: true,
        json: async () => ({
          key_id: key.keyId,
          public_key_pem: key.pem,
          algorithm: 'RSA-OAEP',
          hash: 'SHA-256',
          max_plaintext_bytes: 190
        })
      };
    }

    postCount += 1;
    return {
      ok: false,
      status: 409,
      json: async () => ({
        detail: { code: 'LOGIN_KEY_STALE', message: 'Anahtar yenilendi.' }
      })
    };
  };

  try {
    await assert.rejects(
      loginSports('student', 'secret-password'),
      err => err instanceof SportsApiError &&
        err.code === 'LOGIN_KEY_UNAVAILABLE'
    );
    assert.equal(getCount, 2);
    assert.equal(postCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sports login rejects oversized passwords before a login POST', async () => {
  const originalFetch = globalThis.fetch;
  const key = await createLoginKey();
  let postCount = 0;
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'POST') postCount += 1;
    return {
      ok: true,
      json: async () => ({
        key_id: key.keyId,
        public_key_pem: key.pem,
        algorithm: 'RSA-OAEP',
        hash: 'SHA-256',
        max_plaintext_bytes: 190
      })
    };
  };

  try {
    await assert.rejects(
      loginSports('student', 'ş'.repeat(100)),
      err => err instanceof SportsApiError &&
        err.code === 'PASSWORD_TOO_LONG_FOR_ENCRYPTION'
    );
    assert.equal(postCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('API combinations count distinct weekly timetables after hydration', async () => {
  const originalFetch = globalThis.fetch;
  const sections = {
    '1': { course_code: 'EE205', section_no: '1', slots: [{ day: 'Cuma', time_slot: '09:00/09:20' }] },
    '2': { course_code: 'EE205', section_no: '2', slots: [{ day: 'Cuma', time_slot: '09:00 - 09:50' }] },
    '3': { course_code: 'EE205', section_no: '3', slots: [{ day: 'Salı', time_slot: '15:00/15:20' }] },
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({
    count: 3,
    section_catalog: { EE205: sections },
    combinations: ['1', '2', '3'].map((number, index) => ({ index, section_refs: [['EE205', number]] }))
  }) });
  try {
    const result = await generateCombinations({ EE205: ['1', '2', '3'] });
    assert.equal(result.count, 2);
    assert.deepEqual(result.combinations.map(combo => combo.sections[0].section_no), ['1', '3']);
    assert.deepEqual(result.combinations.map(combo => combo.index), [0, 1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('draft preview shows one EE205 section and avoids an avoidable clash', () => {
  const at = (day, hour) => ({ day, time_slot: `${hour}:00/${hour}:20` });
  const basket = {
    CENG466: { code: 'CENG466', selectedSections: ['2'], allSections: [
      { section_no: '2', slots: [at('Çarşamba', '13')] }] },
    EE205: { code: 'EE205', selectedSections: ['3', '8'], allSections: [
      { section_no: '3', slots: [at('Çarşamba', '13'), at('Cuma', '09')] },
      { section_no: '8', slots: [at('Salı', '15'), at('Cuma', '09')] }] },
    MATH205: { code: 'MATH205', selectedSections: ['1'], allSections: [
      { section_no: '1', slots: [at('Salı', '09')] }] },
    PHYS132: { code: 'PHYS132', selectedSections: ['2'], allSections: [
      { section_no: '2', slots: [at('Salı', '09')] }] },
  };
  const preview = choosePreviewSections(basket);
  assert.equal(preview.length, 4);
  assert.equal(preview.find(section => section.course_code === 'EE205').section_no, '8');
});

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

test('untimed courses survive save, import and CSV export', () => {
  const untimed = { code: 'ESR103', name: 'Etik İlkeler ve Sosyal Sorumluluk', credit: 1, ects: 1,
    untimed: true, selectedSections: [], allSections: [] };
  const plan = createPlan({ ...state,
    basket: { ...state.basket, ESR103: untimed },
    selectedCombination: { sections: [...state.selectedCombination.sections,
      { course_code: 'ESR103', section_no: 'SAATSIZ', instructor: 'Belirsiz', classroom: '', slots: [] }] },
  });
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), plan);
  assert.equal(plan.selectedCombination.total_credits, 4);
  assert.equal(plan.selectedCombination.total_ects, 6);
  assert.ok(buildCSV(plan).includes('"Ders","ESR103","Etik İlkeler ve Sosyal Sorumluluk","SAATSIZ"'));
  const invalid = structuredClone(plan);
  invalid.basket.ESR103.untimed = false;
  assert.throws(() => validatePlan(invalid));
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

test('validateDraftName enforces length, trimmed text and uniqueness', () => {
  const existing = [{ id: '1', name: 'Plan 1' }, { id: '2', name: 'Alternatif' }];
  assert.equal(validateDraftName('  Yedek Plan  ', existing), 'Yedek Plan');
  assert.throws(() => validateDraftName('', existing));
  assert.throws(() => validateDraftName('   ', existing));
  assert.throws(() => validateDraftName('a'.repeat(61), existing));
  assert.throws(() => validateDraftName('plan 1', existing));
  assert.equal(validateDraftName('Plan 1', existing, '1'), 'Plan 1');
});

test('emptyDraft creates clean default plan structure', () => {
  const draft = emptyDraft({ primaryDept: 'CENG', secondaryDept: 'YOK', secondaryType: 'YOK' });
  assert.equal(draft.version, 1);
  assert.deepEqual(draft.basket, {});
  assert.equal(draft.program.primaryDept, 'CENG');
  assert.equal(draft.selectedCombination, null);
});

test('input signature changes when a course is added to the basket', () => {
  const basketA = { CENG101: state.basket.CENG101 };
  const basketB = {
    ...basketA,
    MATH101: {
      code: 'MATH101', name: 'Matematik', credit: 4, ects: 6,
      selectedSections: ['1'], allSections: [{ ...section, section_no: '1' }],
    },
  };
  assert.notEqual(
    inputSignature(basketA, state.preferences, state.customBlocks, state.profile),
    inputSignature(basketB, state.preferences, state.customBlocks, state.profile),
  );
});

test('schedule is stale only when existing combinations belong to another signature', () => {
  const isScheduleStale = (combinations, resultSignature, currentSignature) =>
    Boolean(combinations.length && resultSignature !== currentSignature);

  assert.equal(isScheduleStale([{ index: 0 }], 'old', 'current'), true);
  assert.equal(isScheduleStale([{ index: 0 }], 'current', 'current'), false);
  assert.equal(isScheduleStale([], 'old', 'current'), false);
  assert.equal(isScheduleStale([], null, 'current'), false);
});

test('time ranges expose overlapping minutes and expand short notation', () => {
  const first = parseTimeRange('08:40 - 09:30');
  const second = parseTimeRange('09:00 - 09:50');
  assert.deepEqual(first, [520, 570]);
  assert.deepEqual(second, [540, 590]);
  assert.equal(Math.max(first[0], second[0]) < Math.min(first[1], second[1]), true);
  assert.deepEqual(parseTimeRange('09:00/09:20'), [540, 590]);
});

test('old plans migrate missing preference keys to false', () => {
  const oldPlan = createPlan(state);
  oldPlan.preferences = { free_friday: false, free_monday: false, no_morning: false };
  const migrated = validatePlan(oldPlan);
  assert.equal(migrated.preferences.no_lunch_break, false);
});

test('share payload round trip preserves a minimal plan except section catalog data', () => {
  const plan = createPlan({
    ...state,
    basket: {},
    customBlocks: {},
    selectedCombination: null,
    semester: { start: '', end: '' },
  });
  assert.deepEqual(parseSharePayload(buildSharePayload(plan)), plan);
});

test('fewest-days sort orders combinations by days count', () => {
  const combinations = [
    { index: 0, days_count: 5 },
    { index: 1, days_count: 2 },
    { index: 2, days_count: 4 },
  ];
  const sorted = [...combinations].sort((a, b) => a.days_count - b.days_count);
  assert.deepEqual(sorted.map(combo => combo.index), [1, 2, 0]);
  assert.deepEqual(combinations.map(combo => combo.index), [0, 1, 2]);
});
