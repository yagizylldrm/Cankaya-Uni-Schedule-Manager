import { test, expect } from '@playwright/test';

const mockCourse = {
  code: 'CENG101',
  name: 'Programlamaya Giriş',
  dept_code: 'CENG',
  credit: 3,
  ects: 5,
  type: 'ZORUNLU',
  type_label: 'Zorunlu',
  sections_count: 1,
  instructors: ['Test Öğretim Üyesi'],
  can_take: true,
  sections: [{
    section_no: '1',
    instructor: 'Test Öğretim Üyesi',
    classroom: 'B-102',
    slots: [{ day: 'Pazartesi', time_slot: '09:00 - 09:50', classroom: 'B-102' }]
  }]
};

const mockCombos = [{
  index: 0,
  total_courses: 1,
  total_credits: 3,
  total_ects: 5,
  days_count: 1,
  sections: [{
    course_code: 'CENG101',
    section_no: '1',
    instructor: 'Test Öğretim Üyesi',
    classroom: 'B-102',
    slots: [{ day: 'Pazartesi', time_slot: '09:00 - 09:50', classroom: 'B-102' }]
  }]
}];

const mockSlots = [
  {
    seans_id: '101',
    seans_adi: 'Fitness Seansı 1',
    baslangic: '09:00',
    bitis: '10:00',
    time_slot: '09:00 - 10:00',
    doluluk: '15 / 25',
    occupied: 15,
    capacity: 25,
    is_full: false
  },
  {
    seans_id: '102',
    seans_adi: 'Fitness Seansı 2',
    baslangic: '11:00',
    bitis: '12:00',
    time_slot: '11:00 - 12:00',
    doluluk: '8 / 25',
    occupied: 8,
    capacity: 25,
    is_full: false
  }
];

async function setupSportsPage(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/departments') {
      await route.fulfill({ json: [{ code: 'CENG', name: 'Bilgisayar Mühendisliği' }] });
    } else if (url.pathname === '/api/courses') {
      await route.fulfill({ json: [mockCourse] });
    } else if (url.pathname === '/api/combinations') {
      await route.fulfill({ json: { count: 1, combinations: mockCombos } });
    } else if (url.pathname === '/api/sports/login') {
      const data = route.request().postDataJSON();
      if (data.username === 'invalid') {
        await route.fulfill({
          status: 400,
          json: { detail: 'Kullanıcı adı veya şifre hatalı.' }
        });
      } else {
        await route.fulfill({
          json: {
            success: true,
            token: 'mock_encrypted_session_token_xyz',
            student_name: 'Ahmet Yılmaz',
            username: data.username
          }
        });
      }
    } else if (url.pathname === '/api/sports/slots') {
      await route.fulfill({
        json: {
          success: true,
          date: '28.09.2026',
          slots: mockSlots
        }
      });
    } else if (url.pathname === '/api/sports/book') {
      await route.fulfill({
        json: {
          success: true,
          message: 'Randevunuz başarıyla oluşturuldu!'
        }
      });
    } else {
      await route.fulfill({ json: {} });
    }
  });

  await page.goto('/');
}

test('sports booking modal opens, handles login, displays clash detection and books slot', async ({ page }) => {
  await setupSportsPage(page);

  // 1. Add course to basket to create timetable
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();

  // 2. Click "Spor Randevusu" button in Navbar
  const sportsBtn = page.getByRole('button', { name: 'Spor Randevusu' });
  await expect(sportsBtn).toBeVisible();
  await sportsBtn.click();

  // 3. Modal opens with title and security notice
  await expect(page.getByRole('heading', { name: 'Spor Tesisi Randevu Sistemi' })).toBeVisible();
  await expect(page.getByText('Sıfır Güvenlik Riski & Şifresiz Mimari')).toBeVisible();

  // 4. Test login failure
  await page.fill('input[placeholder="Örn: 202111001/c2111001"]', 'invalid');
  await page.fill('input[placeholder="Randevu sistemi şifreniz"]', 'wrongpass');
  await page.getByRole('button', { name: 'Güvenli Giriş Yap' }).click();
  await expect(page.getByText('Kullanıcı adı veya şifre hatalı.')).toBeVisible();

  // 5. Test login success
  await page.fill('input[placeholder="Örn: 202111001/c2111001"]', '202111001');
  await page.fill('input[placeholder="Randevu sistemi şifreniz"]', 'correctpass');
  await page.getByRole('button', { name: 'Güvenli Giriş Yap' }).click();

  // 6. Authenticated dashboard appears
  await expect(page.getByText('Ahmet Yılmaz')).toBeVisible();
  await expect(page.getByText('Oturum Aktif')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Çıkış Yap' })).toBeVisible();

  // 7. Verify slots are loaded
  await expect(page.getByText('Fitness Seansı 1')).toBeVisible();
  await expect(page.getByText('Fitness Seansı 2')).toBeVisible();

  // Set date to a Monday (e.g. 2026-09-28) to test clash with CENG101 on Pazartesi 09:00 - 09:50
  const dateInput = page.locator('input[type="date"]');
  await dateInput.fill('2026-09-28');

  // Verify clash badge on Slot 1 (09:00 - 10:00 vs CENG101 09:00 - 09:50)
  await expect(page.getByText(/Ders Çakışması: CENG101/)).toBeVisible();

  // Verify suitable badge on Slot 2 (11:00 - 12:00)
  await expect(page.getByText('Ders programınız uygun')).toBeVisible();

  // 8. Book Slot 2
  const bookButtons = page.getByRole('button', { name: 'Randevu Al' });
  await bookButtons.last().click();

  // Verify booking confirmation
  await expect(page.getByText('Randevu Alındı')).toBeVisible();
  const addToTimetableBtn = page.getByRole('button', { name: 'Haftalık Programa Ekle' });
  await expect(addToTimetableBtn).toBeVisible();

  // 9. Add to weekly timetable
  await addToTimetableBtn.click();
  await expect(page.getByText('Programa Eklendi')).toBeVisible();

  // 10. Close modal and verify custom block on timetable
  await page.getByLabel('Kapat', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Spor Tesisi Randevu Sistemi' })).not.toBeVisible();

  // The custom block should now be rendered on the timetable
  await expect(page.getByText('Spor / Fitness')).toBeVisible();
});
