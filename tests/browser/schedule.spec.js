import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const sections = ['1', '2'].map((n, i) => ({ section_no: n, instructor: 'Test Öğretim Üyesi', classroom: 'B-102',
  slots: [{ day: 'Pazartesi', time_slot: i ? '11:00 - 11:50' : '09:00 - 09:50', classroom: 'B-102' }] }));
const course = { code: 'CENG101', name: 'Programlamaya Giriş', dept_code: 'CENG', credit: 3, ects: 5,
  type: 'ZORUNLU', type_label: 'Zorunlu', sections_count: 2, instructors: ['Test Öğretim Üyesi'], can_take: true, sections };
const combos = sections.map((s, index) => ({ index, total_courses: 1, total_credits: 3, total_ects: 5, days_count: 1,
  sections: [{ ...s, course_code: course.code }] }));

async function mockApi(page) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
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
  await page.getByRole('button', { name: 'Program Oluştur', exact: true }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
}

async function menu(page) {
  await page.getByRole('button', { name: 'Programı kaydet veya yükle' }).click();
}

test('mobile first visit guides course selection and agenda has no page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ders programını üç adımda oluştur' })).toBeVisible();
  await expect(page.getByPlaceholder('Ders kodu veya öğretim elemanı ara...')).toBeVisible();
  await page.getByRole('button', { name: '1. Bölümünü seç' }).click();
  await expect(page.getByRole('combobox', { name: 'Ana bölüm' })).toBeFocused();
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await page.getByRole('button', { name: 'Program Oluştur', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Günlük program' })).toBeVisible();
  await page.getByLabel('Gün', { exact: true }).selectOption('Pazartesi');
  await expect(page.getByRole('button', { name: /09:00 - 09:50 CENG101/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Etkinlik ekle', exact: true }).click();
  await page.getByLabel('Etkinlik saati').selectOption('13:00 - 13:50');
  await page.getByRole('button', { name: 'Ekle', exact: true }).last().click();
  await expect(page.getByText('Seçimler değişti — programı yeniden oluşturun.')).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/mobile-agenda.png', fullPage: true });
});

test('stale results block exports and verified conflict action regenerates', async ({ page }) => {
  await createSchedule(page);
  await page.getByRole('checkbox', { name: 'Pazartesi Boş' }).check();
  await expect(page.getByText('Seçimler değişti — programı yeniden oluşturun.')).toBeVisible();
  await menu(page);
  await expect(page.getByRole('button', { name: 'Programı kaydet (JSON)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'PNG Görsel Olarak' })).toBeDisabled();
  await page.getByRole('heading', { name: 'Çankaya Üniversitesi', exact: true }).click();
  await page.getByRole('button', { name: 'Yeniden oluştur', exact: true }).click();
  await expect(page.getByText('Pazartesi boş tercihini kaldırırsanız program oluşturulabilir.')).toBeVisible();
  await page.getByRole('button', { name: 'Tercihi kaldır ve oluştur' }).click();
  await expect(page.getByRole('checkbox', { name: 'Pazartesi Boş' })).not.toBeChecked();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
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

test('changes during an in-flight generation remain stale when response arrives', async ({ page }) => {
  await createSchedule(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/combinations', async route => { await gate; await route.fulfill({ json: { count: 2, combinations: combos } }); });
  await page.getByRole('button', { name: 'Program Oluştur', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Cuma Günü Boş' }).check();
  release();
  await expect(page.getByRole('button', { name: 'Program Oluştur', exact: true })).toBeEnabled();
  await expect(page.getByText('Seçimler değişti — programı yeniden oluşturun.')).toBeVisible();
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
  await page.getByRole('button', { name: 'Program Oluştur', exact: true }).click();
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
  await page.route('**/api/courses?*', route => route.fulfill({ json: [course, other] }));
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
  await page.getByRole('button', { name: /Ders Sepeti/ }).click();
  await page.getByRole('button', { name: 'Sepetten Kaldır' }).first().click();
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('CENG101');
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).toContainText('MATH101');
  expect(requests).toEqual([['CENG101'], ['CENG101', 'MATH101'], ['MATH101']]);
  await page.getByRole('button', { name: 'Sepetten Kaldır' }).click();
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
  await page.getByRole('button', { name: /Ders Sepeti/ }).click();
  await page.getByRole('button', { name: 'Sepetten Kaldır' }).click();
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
  await page.getByRole('button', { name: /Ders Sepeti/ }).click();
  await page.getByRole('button', { name: 'Şubeleri Göster' }).click();
  const requested = page.waitForRequest('**/api/combinations');
  await page.getByRole('checkbox', { name: /Section 1/ }).uncheck();
  expect((await requested).postDataJSON().selected_courses.CENG101).toEqual(['2']);
  await expect(page.getByText('Program güncelleniyor…', { exact: true })).toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('S.1');
  await expect(page.locator('[data-weekly-grid]')).toContainText('S.2');
  await page.getByRole('checkbox', { name: /Section 2/ }).uncheck();
  await expect(page.getByText('CENG101: en az bir şube seçin.', { exact: true })).toBeVisible();
  const oldResponse = page.waitForResponse('**/api/combinations');
  release();
  await oldResponse;
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('CENG101');
  await expect(page.getByText('Seçili program', { exact: true })).not.toBeVisible();
  await page.getByRole('checkbox', { name: /Section 1/ }).check();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();
  await expect(page.locator('[data-weekly-grid]')).toContainText('S.1');
  await expect(page.locator('[data-weekly-grid]')).not.toContainText('S.2');
  await expect(page.getByText('CENG101: en az bir şube seçin.', { exact: true })).not.toBeVisible();
});
