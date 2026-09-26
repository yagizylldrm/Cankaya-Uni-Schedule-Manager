import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const sections = ['1', '2'].map((n, i) => ({ section_no: n, instructor: 'Test Öğretim Üyesi', classroom: 'B-102',
  slots: [{ day: 'Pazartesi', time_slot: i ? '11:00 - 11:50' : '09:00 - 09:50', classroom: 'B-102' }] }));
const course = { code: 'CENG101', name: 'Programlamaya Giriş', dept_code: 'CENG', credit: 3, ects: 5,
  type: 'ZORUNLU', type_label: 'Zorunlu', sections_count: 2, instructors: ['Test Öğretim Üyesi'], can_take: true, sections };
const combos = sections.map((s, index) => ({ index, total_courses: 1, total_credits: 3, total_ects: 5, days_count: 1,
  sections: [{ ...s, course_code: course.code }] }));

async function mockApi(page, overrides = {}) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (overrides[url.pathname]) {
      const response = overrides[url.pathname];
      await route.fulfill({
        body: JSON.stringify(response),
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
      });
      return;
    }

    let data;
    if (url.pathname === '/api/departments') data = [{ code: 'CENG', name: 'Bilgisayar Mühendisliği' }];
    else if (url.pathname === '/api/courses') data = [course];
    else if (url.pathname === '/api/courses/CENG101') data = course;
    else if (url.pathname === '/api/combinations') {
      const req = route.request().postDataJSON();
      data = req.preferences.free_monday ? { count: 0, combinations: [], conflicts_info: 'Uygun program bulunamadı.',
        conflict_details: [{ kind: 'preferences', message: 'Pazartesi boş tercihini kaldırırsanız program oluşturulabilir.',
          action: { type: 'relax_preferences', keys: ['free_monday'], label: 'Tercihi kaldır ve oluştur' } }] } : { count: 2, combinations: combos };
    } else data = {};
    await route.fulfill({ json: data });
  });
}

async function createSchedule(page) {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
}

async function menu(page) {
  await page.getByRole('button', { name: 'Programı kaydet veya yükle' }).click();
}

test('selected courses remain available across search filters and draft switches', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Çıkar', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Planlar' }).click();
  await page.getByPlaceholder('Yeni plan adı').fill('Cuma boş');
  await page.getByRole('button', { name: 'Boş plan' }).click();
  await expect(page.getByRole('button', { name: 'Ekle', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Çıkar', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Planlar' }).click();
  await page.getByRole('button', { name: 'Aç', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Çıkar', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Çıkar', exact: true })).toBeVisible();
});

test('recently added courses appear first in the course list', async ({ page }) => {
  const another = { ...course, code: 'CENG102', name: 'İkinci Ders' };
  await mockApi(page);
  await page.route('**/api/courses?**', route => route.fulfill({ json: [course, another] }));
  await page.route('**/api/courses/CENG102?**', route => route.fulfill({ json: another }));
  await page.goto('/');
  const cards = page.locator('div.group').filter({ has: page.getByRole('button', { name: 'Ekle', exact: true }) });
  await expect(cards).toHaveCount(2);
  await cards.nth(1).getByRole('button', { name: 'Ekle' }).click();
  await expect(page.locator('div.group').first()).toContainText('CENG102');
  await page.locator('div.group').filter({ hasText: 'CENG101' }).getByRole('button', { name: 'Ekle' }).click();
  await expect(page.locator('div.group').first()).toContainText('CENG101');
});

test('draft preview does not draw every alternative section at once', async ({ page }) => {
  const sameTimeCourse = { ...course, sections: [sections[0], { ...sections[1], slots: sections[0].slots }] };
  await mockApi(page);
  await page.route('**/api/courses/CENG101?**', route => route.fulfill({ json: sameTimeCourse }));
  await page.route('**/api/combinations', route => route.fulfill({ json: {
    count: 0, combinations: [], conflicts_info: 'Uygun program bulunamadı.'
  } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByText('Uygun program bulunamadı.')).toBeVisible();
  await expect(page.locator('[data-weekly-grid] [title^="CENG101 Sec"]')).toHaveCount(1);
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('ÇAKIŞMA!');
});

test('custom activities can be reviewed and cleared from the list', async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem('cankaya_custom_blocks', JSON.stringify({
    'Pazartesi:12:00 - 12:50': { day: 'Pazartesi', time_slot: '12:00 - 12:50', title: 'Yemek', note: '', color: 'amber' },
  })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Etkinlikler' }).click();
  await expect(page.getByRole('dialog', { name: 'Özel etkinlikler' })).toContainText('Yemek');
  await page.getByRole('button', { name: 'Sil', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Özel etkinlikler' })).toContainText('Henüz etkinlik eklenmedi');
});

test('transcript progress separates completed courses and credits', async ({ page }) => {
  let requestBody;
  await page.addInitScript(() => localStorage.setItem('cankaya_student_profile', JSON.stringify({
    primaryDept: 'CENG', secondaryDept: 'YOK', secondaryType: 'YOK',
    passedCourses: { CENG105: { code: 'CENG105', grade: 'AA', credit: 2, ects: 2 } },
    failedCourses: {}, pendingCourses: {},
  })));
  await mockApi(page, {
    '/api/curriculum/progress': {
      program_name: 'Bilgisayar Mühendisliği (Lisans)',
      credit_data_available: true,
      compulsory_passed: 23,
      compulsory_total: 44,
      completed_credits: 68,
      total_credits: 131,
      tech_slots_passed: 1,
      tech_slots_total: 5,
      social_slots_passed: 2,
      social_slots_total: 2,
    },
  });
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/curriculum/progress') {
      requestBody = request.postDataJSON();
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: /^Transkript & Ön Koşul/ }).click();

  await expect(page.getByText('Ders ilerlemesi', { exact: true })).toBeVisible();
  await expect(page.getByText('23 / 44 ders', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: '23 / 44 ders tamamlandı (52%).' })).toBeVisible();
  await expect(page.getByText('Kredi ilerlemesi', { exact: true })).toBeVisible();
  await expect(page.getByText('68 / 131 kredi', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: '68 / 131 kredi tamamlandı (52%).' })).toBeVisible();
  expect(requestBody.passed_courses.CENG105.credit).toBe(2);
});

test('an old progress response never appears as zero over zero credits', async ({ page }) => {
  await mockApi(page, {
    '/api/curriculum/progress': {
      compulsory_passed: 23,
      compulsory_total: 44,
      tech_slots_passed: 1,
      tech_slots_total: 5,
      social_slots_passed: 2,
      social_slots_total: 2,
    },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Transkript & Ön Koşul', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('Kredi bilgisi yüklenemedi');
  await expect(page.getByText('0 / 0 kredi', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toBeVisible();
});

test('zero completed credits uses the official curriculum total', async ({ page }) => {
  await mockApi(page, {
    '/api/curriculum/progress': {
      program_name: 'Bilgisayar Mühendisliği (Lisans)',
      credit_data_available: true,
      compulsory_passed: 0,
      compulsory_total: 44,
      completed_credits: 0,
      total_credits: 143,
      tech_slots_passed: 0,
      tech_slots_total: 5,
      social_slots_passed: 0,
      social_slots_total: 2,
    },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Transkript & Ön Koşul', exact: true }).click();

  await expect(page.getByText('0 / 143 kredi', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: '0 / 143 kredi tamamlandı (0%).' })).toBeVisible();
});

test('transcript import shows and enables the passed-course filter', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/courses?**', async route => {
    const hidePassed = new URL(route.request().url()).searchParams.get('hide_passed') === 'true';
    await route.fulfill({ json: hidePassed ? [] : [course] });
  });
  await page.route('**/api/transcript/parse', route => route.fulfill({ json: {
    all_detected_courses: [{ code: 'CENG101' }],
    passed_courses: { CENG101: { code: 'CENG101', grade: 'AA' } },
    failed_courses: {}, pending_courses: {},
  } }));
  await page.goto('/');
  await expect(page.getByRole('checkbox', { name: 'Geçtiğim Dersleri Gizle' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Transkript & Ön Koşul', exact: true }).click();
  await page.getByPlaceholder('Oasis transkript sayfasındaki tüm metni kopyalayıp (Ctrl+A, Ctrl+C) buraya yapıştırın...').fill('CENG101 Programming AA');
  await page.getByRole('button', { name: 'Transkripti Ayrıştır ve Aktar' }).click();
  await page.getByRole('button', { name: 'Tamam', exact: true }).click();
  const filter = page.getByRole('checkbox', { name: 'Geçtiğim Dersleri Gizle' });
  await expect(filter).toBeChecked();
  await expect(page.getByRole('button', { name: 'Ekle', exact: true })).toHaveCount(0);
  await filter.uncheck();
  await expect(page.getByRole('button', { name: 'Ekle', exact: true })).toBeVisible();
  await page.reload();
  await expect(filter).not.toBeChecked();
});

test('mobile first visit shows course selection and agenda has no page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByPlaceholder('Ders kodu veya öğretim elemanı ara...')).toBeVisible();
  await page.getByRole('combobox', { name: 'Ana bölüm' }).click();
  await expect(page.getByRole('combobox', { name: 'Ana bölüm' })).toBeFocused();
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await page.getByRole('button', { name: 'Haftalık Program' }).click();
  await expect(page.getByRole('region', { name: 'Günlük program' })).toBeVisible();
  await page.getByLabel('Gün', { exact: true }).selectOption('Pazartesi');
  await expect(page.getByRole('button', { name: /09:00 - 09:50 CENG101/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Etkinlik ekle', exact: true }).click();
  await page.getByLabel('Etkinlik saati').selectOption('13:00 - 13:50');
  await page.getByRole('button', { name: 'Ekle', exact: true }).last().click();
  await expect(page.getByRole('button', { name: /13:00 - 13:50/ })).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/mobile-agenda.png', fullPage: true });
});

test('preference conflict provides actionable one-click resolution', async ({ page }) => {
  await createSchedule(page);
  const freeDay = page.getByRole('combobox', { name: 'Boş gün tercihi' });
  await freeDay.selectOption('free_monday');
  await expect(page.getByText('Pazartesi boş tercihini kaldırırsanız program oluşturulabilir.')).toBeVisible();
  await page.getByRole('button', { name: 'Tercihi kaldır ve oluştur' }).click();
  await expect(freeDay).toHaveValue('');
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
});

test('impossible preference keeps the current timetable visible', async ({ page }) => {
  await createSchedule(page);
  await page.getByRole('button', { name: 'Sonraki Kombinasyon' }).click();
  await expect(page.locator('[data-weekly-grid] [title^="CENG101 Sec 2"]')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Boş gün tercihi' }).selectOption('free_monday');
  await expect(page.getByText(/Mevcut program korunuyor/)).toBeVisible();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  await expect(page.locator('[data-weekly-grid] [title^="CENG101 Sec 2"]')).toHaveCount(1);
  await expect(page.locator('[data-weekly-grid] [title^="CENG101 Sec 1"]')).toHaveCount(0);
});

test('JSON saves selected alternative, reload retains it, import reviews and restores it', async ({ page }) => {
  await createSchedule(page);
  await page.getByRole('button', { name: 'Sonraki Kombinasyon' }).click();
  await menu(page);
  await page.getByRole('button', { name: 'Programı kaydet (JSON)' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON dosyasını indir' }).click();
  const download = await downloadPromise;
  const content = await fs.readFile(await download.path(), 'utf8');
  const plan = JSON.parse(content);
  expect(plan.selectedCombination.sections[0].section_no).toBe('2');
  expect(content).not.toContain('passedCourses');
  await page.reload();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cankaya_selected_schedule')).plan.selectedCombination.sections[0].section_no)).toBe('2');
  await menu(page);
  await page.getByRole('button', { name: 'Kayıtlı programı yükle', exact: true }).click();
  await page.getByLabel('Program JSON dosyası').setInputFiles({ name: 'plan.json', mimeType: 'application/json', buffer: Buffer.from(content) });
  await expect(page.getByText('CENG101 · Şube 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Programı yükle', exact: true }).click();
  await expect(page.getByText(/Program dosyası yüklendi/)).toBeVisible();
  await expect(page.getByText('Seçimler değişti — programı yeniden oluşturun.')).not.toBeVisible();
});

test('calendar export uses provided dates and default excludes personal activities', async ({ page }) => {
  await createSchedule(page);
  await menu(page);
  await page.getByRole('button', { name: 'Takvime aktar (.ics)' }).click();
  await page.getByLabel('Dönem başlangıcı', { exact: true }).fill('2026-09-21');
  await page.getByLabel('Dönem bitişi', { exact: true }).fill('2026-09-28');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Takvim dosyasını indir' }).click();
  const download = await pending;
  const content = await fs.readFile(await download.path(), 'utf8');
  expect(content).toContain('DTSTART:20260921T060000Z');
  expect(content).toContain('DTSTART:20260928T060000Z');
  expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(2);
});

test('preference toggles trigger automatic debounced generation', async ({ page }) => {
  await createSchedule(page);
  let fridayRequested = false;
  await page.route('**/api/combinations', async route => {
    fridayRequested = route.request().postDataJSON().preferences?.free_friday === true;
    await route.fulfill({ json: { count: 2, combinations: combos } });
  });
  await page.getByRole('combobox', { name: 'Boş gün tercihi' }).selectOption('free_friday');
  await expect.poll(() => fridayRequested).toBe(true);
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
});

test('malformed import leaves existing schedule intact', async ({ page }) => {
  await createSchedule(page);
  await menu(page);
  await page.getByRole('button', { name: 'Kayıtlı programı yükle', exact: true }).click();
  await page.getByLabel('Program JSON dosyası').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"basket":[]}') });
  await expect(page.getByRole('alert')).toContainText('Geçerli bir program dosyası');
  await page.getByRole('button', { name: 'Kapat', exact: true }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
});

test('PNG export captures weekly timetable from the mobile agenda', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await page.getByRole('button', { name: 'Haftalık Program' }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  await menu(page);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNG Görsel Olarak' }).click();
  const download = await pending;
  const bytes = await fs.readFile(await download.path());
  expect(bytes.length).toBeGreaterThan(10000);
  expect(bytes.readUInt32BE(16)).toBeGreaterThanOrEqual(1400);
  await download.saveAs('test-results/mobile-export.png');
});

test('adding and removing courses automatically updates the preview and generated schedule', async ({ page }) => {
  await mockApi(page);
  const other = { ...course, code: 'MATH101', name: 'Matematik', sections: [{ ...sections[0], slots: [{ day: 'Salı', time_slot: '10:00 - 10:50' }] }] };
  await page.route('**/api/courses?**', route => route.fulfill({ json: [course, other] }));
  await page.route('**/api/courses/MATH101?*', route => route.fulfill({ json: other }));
  const requests = [];
  await page.route('**/api/combinations', async route => {
    const codes = Object.keys(route.request().postDataJSON().selected_courses);
    requests.push(codes);
    const selected = codes.map(code => ({ ...(code === 'CENG101' ? sections[0] : other.sections[0]), course_code: code }));
    await route.fulfill({ json: { count: 1, combinations: [{ ...combos[0], total_courses: codes.length, sections: selected }] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ekle', exact: true }).first().click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).toContainText('CENG101');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.locator('[data-weekly-grid]')).toContainText('MATH101');
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  await expect(page.getByText('Ders Sepeti', { exact: true })).toHaveCount(0);
  await page.locator('div.group').filter({ hasText: 'CENG101' }).getByRole('button', { name: 'Çıkar', exact: true }).click();
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('CENG101');
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).toContainText('MATH101');
  expect(requests).toEqual([['CENG101'], ['CENG101', 'MATH101'], ['MATH101']]);
  await page.getByRole('button', { name: 'Çıkar', exact: true }).click();
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('MATH101');
  await expect(page.getByText('Seçimler değişti — programı yeniden oluşturun.')).not.toBeVisible();
  expect(requests).toHaveLength(3);
});

test('removing the last course while generation is pending ignores the old response', async ({ page }) => {
  await mockApi(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/combinations', async route => { await gate; await route.fulfill({ json: { count: 2, combinations: combos } }); });
  await page.goto('/');
  const request = page.waitForRequest('**/api/combinations');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await request;
  await expect(page.getByText('Program güncelleniyor…', { exact: true })).toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).toContainText('CENG101');
  await page.getByRole('button', { name: 'Çıkar', exact: true }).click();
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('CENG101');
  const response = page.waitForResponse('**/api/combinations');
  release();
  await response;
  await expect(page.getByText('Seçili program', { exact: true })).not.toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('CENG101');
  await menu(page);
  await expect(page.getByRole('button', { name: 'CSV olarak indir', exact: true })).toBeDisabled();
});

test('CSV download exports the selected alternative without requiring semester dates', async ({ page }) => {
  await createSchedule(page);
  await page.getByRole('button', { name: 'Sonraki Kombinasyon' }).click();
  await menu(page);
  await page.getByRole('button', { name: 'CSV olarak indir', exact: true }).click();
  await expect(page.locator('dialog input[type="date"]')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Kişisel etkinlikleri ve notlarını da ekle' })).not.toBeChecked();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV dosyasını indir', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('cankaya_program.csv');
  const csv = await fs.readFile(await download.path(), 'utf8');
  expect(csv).toContain('"CENG101","Programlamaya Giriş","2","Pazartesi","11:00","11:50"');
  expect(csv).not.toContain('"09:00"');
  expect(csv).not.toContain('passedCourses');
});

test('section selection regenerates automatically and ignores superseded responses', async ({ page }) => {
  await createSchedule(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/combinations', async route => {
    const selected = route.request().postDataJSON().selected_courses.CENG101;
    if (selected.length === 1 && selected[0] === '2') await gate;
    const matches = combos.filter(c => selected.includes(c.sections[0].section_no));
    await route.fulfill({ json: { count: matches.length, combinations: matches,
      conflicts_info: matches.length ? null : 'CENG101: en az bir şube seçin.' } });
  });
  await page.getByText('Şubeler (2/2)', { exact: true }).click();
  const requested = page.waitForRequest('**/api/combinations');
  await page.getByRole('checkbox', { name: /Şube 1/ }).uncheck();
  expect((await requested).postDataJSON().selected_courses.CENG101).toEqual(['2']);
  await expect(page.getByText('Program güncelleniyor…', { exact: true })).toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('S.1');
  await expect(page.locator('[data-weekly-grid]')).toContainText('S.2');
  await page.getByRole('checkbox', { name: /Şube 2/ }).uncheck();
  await expect(page.getByText('CENG101: en az bir şube seçin.', { exact: true })).toBeVisible();
  const oldResponse = page.waitForResponse('**/api/combinations');
  release();
  await oldResponse;
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('CENG101');
  await expect(page.getByText('Seçili program', { exact: true })).not.toBeVisible();
  await page.getByRole('checkbox', { name: /Şube 1/ }).check();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).toContainText('S.1');
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('S.2');
  await expect(page.getByText('CENG101: en az bir şube seçin.', { exact: true })).not.toBeVisible();
});

test('adding another course keeps the page and previous timetable steady while updating', async ({ page }) => {
  await mockApi(page);
  const other = { ...course, code: 'MATH101', name: 'Matematik', sections: [{ ...sections[0], slots: [{ day: 'Salı', time_slot: '10:00 - 10:50' }] }] };
  await page.route('**/api/courses?**', route => route.fulfill({ json: [course, other] }));
  await page.route('**/api/courses/MATH101?*', route => route.fulfill({ json: other }));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/combinations', async route => {
    const selected = route.request().postDataJSON().selected_courses;
    const codes = Object.keys(selected);
    if (codes.length === 2) await gate;
    const chosen = codes.map(code => ({ ...(code === 'CENG101' ? sections[0] : other.sections[0]), course_code: code }));
    await route.fulfill({ json: { count: 1, combinations: [{ ...combos[0], total_courses: codes.length, sections: chosen }] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ekle', exact: true }).first().click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  const topBefore = await page.locator('[data-schedule-panel]').evaluate(element => element.getBoundingClientRect().top);
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByText('Program güncelleniyor…', { exact: true })).toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).toContainText('CENG101');
  expect(await page.locator('[data-schedule-panel]').evaluate(element => element.getBoundingClientRect().top)).toBe(topBefore);
  release();
  await expect(page.locator('[data-weekly-grid]')).toContainText('MATH101');
  expect(await page.locator('[data-schedule-panel]').evaluate(element => element.getBoundingClientRect().top)).toBe(topBefore);
});

test('instructor filter selects only that teacher’s sections in the timetable', async ({ page }) => {
  await mockApi(page);
  const taughtSections = [
    { ...sections[0], instructor: 'Dr. Ayşe Yılmaz' },
    { ...sections[1], instructor: 'Dr. Mehmet Kaya' }
  ];
  const taughtCourse = { ...course, instructors: taughtSections.map(s => s.instructor), sections: taughtSections };
  const requests = [];
  await page.route('**/api/courses?*', route => route.fulfill({ json: [taughtCourse] }));
  await page.route('**/api/courses/CENG101?*', route => route.fulfill({ json: taughtCourse }));
  await page.route('**/api/combinations', async route => {
    const selected = route.request().postDataJSON().selected_courses.CENG101;
    requests.push(selected);
    const matching = taughtSections.filter(s => selected.includes(s.section_no));
    await route.fulfill({ json: { count: matching.length, combinations: matching.map((s, index) => ({
      index, total_courses: 1, total_credits: 3, total_ects: 5, days_count: 1,
      sections: [{ ...s, course_code: course.code }]
    })) } });
  });
  await page.goto('/');
  const filter = page.getByRole('combobox', { name: 'CENG101 hoca filtresi' });
  await expect(filter).toBeVisible();
  await filter.selectOption('Dr. Mehmet Kaya');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.locator('[data-weekly-grid]')).toContainText('Dr. Mehmet Kaya');
  await expect.poll(() => requests.at(-1)).toEqual(['2']);

  await filter.selectOption('Dr. Ayşe Yılmaz');
  await expect(page.locator('[data-weekly-grid]')).toContainText('Dr. Ayşe Yılmaz');
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('Dr. Mehmet Kaya');
  await expect.poll(() => requests.at(-1)).toEqual(['1']);
  await page.reload();
  await expect(filter).toHaveValue('Dr. Ayşe Yılmaz');
  await expect(page.locator('[data-weekly-grid]')).toContainText('Dr. Ayşe Yılmaz');
  await filter.selectOption('');
  await expect.poll(() => requests.at(-1)).toEqual(['1', '2']);
  await expect(filter).toHaveValue('');
});

test('adding a course shows immediate progress while its details load', async ({ page }) => {
  await mockApi(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/courses/CENG101?*', async route => {
    await gate;
    await route.fulfill({ json: course });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ekleniyor…' })).toBeVisible();
  release();
  await expect(page.getByRole('button', { name: 'Çıkar', exact: true })).toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).toContainText('CENG101');
});

test('compact program response renders the same sections', async ({ page }) => {
  await mockApi(page);
  let compactRequested = false;
  await page.route('**/api/combinations', async route => {
    compactRequested = route.request().postDataJSON().compact === true;
    await route.fulfill({ json: {
      count: 2,
      section_catalog: { CENG101: Object.fromEntries(sections.map(s => [s.section_no, { ...s, course_code: course.code }])) },
      combinations: sections.map((s, index) => ({ index, total_courses: 1, total_credits: 3,
        total_ects: 5, days_count: 1, section_refs: [[course.code, s.section_no]] }))
    } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).toContainText('CENG101');
  expect(compactRequested).toBe(true);
});

test('a course without weekly meetings completes schedule generation', async ({ page }) => {
  const untimed = { ...course, code: 'COL201', name: 'Kariyer Planlama', credit: 0, ects: 1,
    sections_count: 0, instructors: [], sections: [], untimed: true };
  await mockApi(page);
  await page.route('**/api/courses?*', route => route.fulfill({ json: [course, untimed] }));
  await page.route('**/api/courses/COL201?*', route => route.fulfill({ json: untimed }));
  await page.route('**/api/combinations', route => {
    const codes = Object.keys(route.request().postDataJSON().selected_courses);
    const withUntimed = codes.includes('COL201');
    return route.fulfill({ json: { count: 2, combinations: combos.map(combo => ({
      ...combo, total_courses: codes.length, total_ects: withUntimed ? 6 : 5,
      sections: withUntimed ? [...combo.sections, { course_code: 'COL201', section_no: 'SAATSIZ', slots: [] }] : combo.sections
    })) } });
  });
  await page.goto('/');
  await page.locator('div.group').filter({ hasText: 'CENG101' }).getByRole('button', { name: 'Ekle' }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  await page.locator('div.group').filter({ hasText: 'COL201' }).getByRole('button', { name: 'Ekle' }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  await expect(page.getByText('Hesaplanıyor…', { exact: true })).not.toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).toContainText('CENG101');
});

test('a repeated add does not leave the calculation indicator visible', async ({ page }) => {
  const untimed = { ...course, code: 'COL201', name: 'Kariyer Planlama', credit: 0, ects: 1,
    sections_count: 0, instructors: [], sections: [], untimed: true };
  await mockApi(page);
  await page.route('**/api/courses?*', route => route.fulfill({ json: [course, untimed] }));
  let detailRequests = 0;
  let releaseDetail;
  const detailGate = new Promise(resolve => { releaseDetail = resolve; });
  await page.route('**/api/courses/COL201?*', async route => {
    detailRequests += 1;
    if (detailRequests === 2) await detailGate;
    await route.fulfill({ json: untimed });
  });
  await page.route('**/api/combinations', route => {
    const codes = Object.keys(route.request().postDataJSON().selected_courses);
    return route.fulfill({ json: { count: 1, combinations: [{ ...combos[0], total_courses: codes.length,
      sections: codes.includes('COL201')
        ? [...combos[0].sections, { course_code: 'COL201', section_no: 'SAATSIZ', slots: [] }]
        : combos[0].sections }] } });
  });
  await page.goto('/');
  await page.locator('div.group').filter({ hasText: 'CENG101' }).getByRole('button', { name: 'Ekle' }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  const colCard = page.locator('div.group').filter({ hasText: 'COL201' });
  await colCard.getByTitle('Ders Detayı ve Web Sayfası').click();
  const modal = page.locator('div.fixed.inset-0');
  await expect(modal.getByRole('button', { name: 'Ekle', exact: true })).toBeVisible();
  await page.evaluate(() => {
    [...document.querySelectorAll('div.group')].find(element => element.textContent.includes('COL201'))
      .querySelector('button:not([title])').click();
  });
  await expect.poll(() => detailRequests).toBe(2);
  await modal.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  releaseDetail();
  await expect(colCard.getByRole('button', { name: 'Çıkar', exact: true })).toBeVisible();
  await expect(page.getByText('Hesaplanıyor…', { exact: true })).not.toBeVisible();
  await expect(page.getByText('Program güncelleniyor…', { exact: true })).not.toBeVisible();
});

test('API error shows a retry button', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/departments') await route.fulfill({ status: 500, json: { detail: 'failed' } });
    else if (pathname === '/api/courses') await route.fulfill({ json: [course] });
    else await route.fulfill({ json: {} });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Bölümler listelenemedi');
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toBeVisible();
});

test('changing the basket locks exports until the replacement schedule arrives', async ({ page }) => {
  const other = { ...course, code: 'MATH101', name: 'Matematik', sections: [{
    ...sections[0], section_no: '1', slots: [{ day: 'Salı', time_slot: '10:00 - 10:50' }],
  }] };
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/departments') return route.fulfill({ json: [{ code: 'CENG', name: 'Bilgisayar Mühendisliği' }] });
    if (url.pathname === '/api/courses') return route.fulfill({ json: [course, other] });
    if (url.pathname === '/api/courses/CENG101') return route.fulfill({ json: course });
    if (url.pathname === '/api/courses/MATH101') return route.fulfill({ json: other });
    if (url.pathname !== '/api/combinations') return route.fulfill({ json: {} });
    const codes = Object.keys(route.request().postDataJSON().selected_courses);
    if (codes.includes('MATH101')) await gate;
    const chosen = codes.map(code => ({
      ...(code === 'CENG101' ? sections[0] : other.sections[0]), course_code: code,
    }));
    return route.fulfill({ json: { count: 1, combinations: [{
      ...combos[0], total_courses: codes.length, sections: chosen,
    }] } });
  });
  await page.goto('/');
  await page.locator('div.group').filter({ hasText: 'CENG101' }).getByRole('button', { name: 'Ekle' }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  await page.locator('div.group').filter({ hasText: 'MATH101' }).getByRole('button', { name: 'Ekle' }).click();
  await expect(page.getByText(/Gösterilen program güncel seçimlere ait değil/)).toBeVisible();
  await menu(page);
  await expect(page.getByRole('button', { name: 'Programı kaydet (JSON)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Takvime aktar (.ics)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'CSV olarak indir' })).toBeDisabled();
  release();
  await expect(page.getByText(/Gösterilen program güncel seçimlere ait değil/)).not.toBeVisible();
});

test('sorting combinations keeps the selected timetable', async ({ page }) => {
  const varied = [
    { ...combos[0], index: 10, days_count: 3 },
    { ...combos[1], index: 11, days_count: 1 },
  ];
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/departments') return route.fulfill({ json: [{ code: 'CENG', name: 'Bilgisayar Mühendisliği' }] });
    if (pathname === '/api/courses') return route.fulfill({ json: [course] });
    if (pathname === '/api/courses/CENG101') return route.fulfill({ json: course });
    if (pathname === '/api/combinations') return route.fulfill({ json: { count: 2, combinations: varied } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await page.getByTitle('Sonraki Kombinasyon').click();
  await expect(page.locator('[data-weekly-grid] [title^="CENG101 Sec 2"]')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Kombinasyon sıralaması' }).selectOption('fewest_days');
  await expect(page.locator('[data-weekly-grid] [title^="CENG101 Sec 2"]')).toHaveCount(1);
});

test('old draft JSON with legacy preference keys opens without error', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  const oldPlan = {
    version: 1,
    basket: {},
    preferences: { free_friday: false, free_monday: false, no_morning: false },
    customBlocks: {},
    program: { primaryDept: 'CENG', secondaryDept: 'YOK', secondaryType: 'YOK' },
    semester: { start: '', end: '' },
    selectedCombination: null,
  };
  await menu(page);
  await page.getByRole('button', { name: 'Kayıtlı programı yükle', exact: true }).click();
  await page.getByLabel('Program JSON dosyası').setInputFiles({
    name: 'old-plan.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oldPlan)),
  });
  await page.getByRole('button', { name: 'Programı yükle', exact: true }).click();
  await expect(page.getByText(/Program dosyası yüklendi/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
