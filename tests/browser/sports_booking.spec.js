import { test, expect } from '@playwright/test';
import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto';

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

async function setupSportsPage(page, {
  slotsOverride = null,
  bookOverride = null,
  publicKeyOverride = null,
  loginOverride = null
} = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const keyId = 'playwright-sports-login-key';

  // Fix browser time to a known Monday (2026-09-28)
  await page.clock.setFixedTime(new Date('2026-09-28T09:00:00Z'));

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/departments') {
      await route.fulfill({ json: [{ code: 'CENG', name: 'Bilgisayar Mühendisliği' }] });
    } else if (url.pathname === '/api/courses') {
      await route.fulfill({ json: [mockCourse] });
    } else if (url.pathname === '/api/combinations') {
      await route.fulfill({ json: { count: 1, combinations: mockCombos } });
    } else if (url.pathname === '/api/sports-booking/public-key') {
      if (publicKeyOverride) {
        await publicKeyOverride(route, { publicKey, privateKey, keyId });
      } else {
        await route.fulfill({
          json: {
            key_id: keyId,
            public_key_pem: publicKey,
            algorithm: 'RSA-OAEP',
            hash: 'SHA-256',
            max_plaintext_bytes: 190
          }
        });
      }
    } else if (url.pathname === '/api/sports/login') {
      const data = route.request().postDataJSON();
      expect(data).not.toHaveProperty('password');
      expect(data.key_id).toBe(keyId);
      const password = privateDecrypt(
        {
          key: privateKey,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(data.encrypted_password, 'base64')
      ).toString('utf8');

      if (loginOverride) {
        await loginOverride(route, { data, password });
      } else if (data.username === 'invalid' || password === 'wrongpass') {
        await route.fulfill({
          status: 401,
          json: { detail: { code: 'INVALID_CREDENTIALS', message: 'Kullanıcı adı veya şifre hatalı.' } }
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
      if (slotsOverride) {
        await slotsOverride(route);
      } else {
        await route.fulfill({
          json: {
            success: true,
            date: '28.09.2026',
            slots: mockSlots
          }
        });
      }
    } else if (url.pathname === '/api/sports/book') {
      if (bookOverride) {
        await bookOverride(route);
      } else {
        await route.fulfill({
          json: {
            success: true,
            message: 'Randevunuz başarıyla oluşturuldu!'
          }
        });
      }
    } else {
      await route.fulfill({ json: {} });
    }
  });

  await page.goto('/');
}

async function loginToSportsModal(page, username = '202111001', password = 'correctpass') {
  const sportsBtn = page.getByRole('button', { name: 'Spor Randevusu' });
  await expect(sportsBtn).toBeVisible();
  await sportsBtn.click();

  await expect(page.getByRole('heading', { name: 'Spor Tesisi Randevu Sistemi' })).toBeVisible();
  await page.locator('#sports-username').fill(username);
  await page.locator('#sports-password').fill(password);
  await page.getByRole('button', { name: 'Güvenli Giriş Yap' }).click();

  await expect(page.getByText('Ahmet Yılmaz')).toBeVisible();
  await expect(page.getByText('Oturum Aktif')).toBeVisible();
}

test('sports booking modal full flow: truthful security notice, login failure/success, clash detection, booking, timetable integration', async ({ page }) => {
  await setupSportsPage(page);

  // 1. Add course to basket to create timetable
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();

  // 2. Click "Spor Randevusu" button in Navbar
  const sportsBtn = page.getByRole('button', { name: 'Spor Randevusu' });
  await expect(sportsBtn).toBeVisible();
  await sportsBtn.click();

  // 3. Modal opens with title and truthful security notice (no "Sıfır Güvenlik Riski")
  await expect(page.getByRole('heading', { name: 'Spor Tesisi Randevu Sistemi' })).toBeVisible();
  await expect(page.getByText('Güvenlik & Gizlilik Bilgilendirmesi')).toBeVisible();
  await expect(page.getByText(/gönderilmeden önce tarayıcınızda uygulama sunucusunun geçici RSA anahtarıyla şifrelenir/)).toBeVisible();
  await expect(page.getByText(/bu nedenle yöntem uçtan uca şifreleme değildir/)).toBeVisible();
  await expect(page.getByText('Sıfır Güvenlik Riski & Şifresiz Mimari')).not.toBeVisible();

  // 4. Test login failure
  await page.locator('#sports-username').fill('invalid');
  await page.locator('#sports-password').fill('wrongpass');
  await page.getByRole('button', { name: 'Güvenli Giriş Yap' }).click();
  await expect(page.getByRole('alert')).toContainText('Kullanıcı adı veya şifre hatalı.');

  // Password should be cleared after failure
  await expect(page.locator('#sports-password')).toHaveValue('');

  // 5. Test login success
  await page.locator('#sports-username').fill('202111001');
  await page.locator('#sports-password').fill('correctpass');
  await page.getByRole('button', { name: 'Güvenli Giriş Yap' }).click();

  // 6. Authenticated dashboard appears
  await expect(page.getByText('Ahmet Yılmaz')).toBeVisible();
  await expect(page.getByText('Oturum Aktif')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Çıkış Yap' })).toBeVisible();

  // 7. Verify slots are loaded
  await expect(page.getByText('Fitness Seansı 1')).toBeVisible();
  await expect(page.getByText('Fitness Seansı 2')).toBeVisible();

  // Verify clash badge on Slot 1 (09:00 - 10:00 vs CENG101 09:00 - 09:50)
  await expect(page.getByText(/Ders Çakışması: CENG101/)).toBeVisible();

  // Verify suitable badge on Slot 2 (11:00 - 12:00)
  await expect(page.getByText('Ders programınız uygun')).toBeVisible();

  // Verify progressbar a11y attributes
  const progressBars = page.getByRole('progressbar');
  await expect(progressBars.first()).toHaveAttribute('aria-valuenow', '15');
  await expect(progressBars.first()).toHaveAttribute('aria-valuemax', '25');

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

test('public key failure clears password and never posts login', async ({ page }) => {
  let loginPosts = 0;
  await setupSportsPage(page, {
    publicKeyOverride: async (route) => route.fulfill({
      json: {
        key_id: 'broken-key',
        public_key_pem: 'not-a-pem',
        algorithm: 'RSA-OAEP',
        hash: 'SHA-256',
        max_plaintext_bytes: 190
      }
    }),
    loginOverride: async (route) => {
      loginPosts += 1;
      await route.fulfill({ status: 500, json: {} });
    }
  });

  await page.getByRole('button', { name: 'Spor Randevusu' }).click();
  await page.locator('#sports-username').fill('student');
  await page.locator('#sports-password').fill('secret-password');
  await page.getByRole('button', { name: 'Güvenli Giriş Yap' }).click();

  await expect(page.getByRole('alert')).toContainText('şifreleme anahtarı');
  await expect(page.locator('#sports-password')).toHaveValue('');
  expect(loginPosts).toBe(0);
});

test('stale login key is refreshed exactly once before authentication', async ({ page }) => {
  let keyGets = 0;
  let loginPosts = 0;
  await setupSportsPage(page, {
    publicKeyOverride: async (route, { publicKey, keyId }) => {
      keyGets += 1;
      await route.fulfill({
        json: {
          key_id: keyId,
          public_key_pem: publicKey,
          algorithm: 'RSA-OAEP',
          hash: 'SHA-256',
          max_plaintext_bytes: 190
        }
      });
    },
    loginOverride: async (route, { data, password }) => {
      loginPosts += 1;
      expect(password).toBe('secret-password');
      if (loginPosts === 1) {
        await route.fulfill({
          status: 409,
          json: {
            detail: {
              code: 'LOGIN_KEY_STALE',
              message: 'Şifreleme anahtarı yenilendi.'
            }
          }
        });
        return;
      }
      await route.fulfill({
        json: {
          success: true,
          token: 'mock_encrypted_session_token_xyz',
          student_name: 'Ahmet Yılmaz',
          username: data.username
        }
      });
    }
  });

  await loginToSportsModal(page, 'student', 'secret-password');
  expect(keyGets).toBe(2);
  expect(loginPosts).toBe(2);
});

test('session lifecycle: modal close and reopen preserves session in memory, explicit logout clears session', async ({ page }) => {
  await setupSportsPage(page);
  await loginToSportsModal(page);

  // Close modal via Kapat button
  await page.getByLabel('Kapat', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Spor Tesisi Randevu Sistemi' })).not.toBeVisible();

  // Reopen modal: session should still be active in React memory!
  await page.getByRole('button', { name: 'Spor Randevusu' }).click();
  await expect(page.getByText('Ahmet Yılmaz')).toBeVisible();
  await expect(page.getByText('Oturum Aktif')).toBeVisible();

  // Now click explicit "Çıkış Yap"
  await page.getByRole('button', { name: 'Çıkış Yap' }).click();

  // Should return to login form
  await expect(page.getByRole('button', { name: 'Güvenli Giriş Yap' })).toBeVisible();
  await expect(page.getByText('Ahmet Yılmaz')).not.toBeVisible();
});

test('race condition defense: out-of-order date responses only show the latest requested date', async ({ page }) => {
  let dateRequestOrder = [];

  await setupSportsPage(page, {
    slotsOverride: async (route) => {
      const data = route.request().postDataJSON();
      const date = data.date;
      dateRequestOrder.push(date);

      if (date === '28.09.2026') {
        // Delay first date response by 300ms
        await new Promise((r) => setTimeout(r, 300));
        await route.fulfill({
          json: {
            success: true,
            date: '28.09.2026',
            slots: [
              {
                seans_id: '101',
                seans_adi: 'Eski Tarih Seansı',
                baslangic: '09:00',
                bitis: '10:00',
                time_slot: '09:00 - 10:00',
                doluluk: '1 / 25',
                occupied: 1,
                capacity: 25,
                is_full: false
              }
            ]
          }
        });
      } else {
        // Fast response for second date
        await route.fulfill({
          json: {
            success: true,
            date: '29.09.2026',
            slots: [
              {
                seans_id: '201',
                seans_adi: 'Yeni Tarih Seansı',
                baslangic: '14:00',
                bitis: '15:00',
                time_slot: '14:00 - 15:00',
                doluluk: '5 / 25',
                occupied: 5,
                capacity: 25,
                is_full: false
              }
            ]
          }
        });
      }
    }
  });

  await loginToSportsModal(page);

  // Click "Yarın" quickly to trigger second request
  await page.getByRole('button', { name: 'Yarın' }).click();

  // Wait for load to settle
  await expect(page.getByText('Yeni Tarih Seansı')).toBeVisible();

  // Wait extra time to ensure old response does NOT overwrite new slots
  await page.waitForTimeout(400);
  await expect(page.getByText('Yeni Tarih Seansı')).toBeVisible();
  await expect(page.getByText('Eski Tarih Seansı')).not.toBeVisible();
});

test('slot error display and retry functionality', async ({ page }) => {
  let attempt = 0;

  await setupSportsPage(page, {
    slotsOverride: async (route) => {
      attempt++;
      if (attempt === 1) {
        await route.fulfill({
          status: 502,
          json: { detail: { code: 'UPSTREAM_ERROR', message: 'Üniversite sunucusuna bağlanılamadı.' } }
        });
      } else {
        await route.fulfill({
          json: {
            success: true,
            date: '28.09.2026',
            slots: mockSlots
          }
        });
      }
    }
  });

  await loginToSportsModal(page);

  // Error alert should be displayed with retry button
  await expect(page.getByRole('alert')).toContainText('Üniversite sunucusuna bağlanılamadı.');
  const retryBtn = page.getByRole('button', { name: 'Tekrar Dene' });
  await expect(retryBtn).toBeVisible();

  // Click retry
  await retryBtn.click();

  // Slots should load successfully
  await expect(page.getByText('Fitness Seansı 1')).toBeVisible();
  await expect(page.getByRole('alert')).not.toBeVisible();
});

test('concurrency defense: booking lock prevents double booking requests', async ({ page }) => {
  let bookCount = 0;

  await setupSportsPage(page, {
    bookOverride: async (route) => {
      bookCount++;
      await new Promise((r) => setTimeout(r, 200));
      await route.fulfill({
        json: {
          success: true,
          message: 'Randevunuz başarıyla oluşturuldu!'
        }
      });
    }
  });

  await loginToSportsModal(page);

  const bookBtn = page.getByRole('button', { name: 'Randevu Al' }).first();
  await bookBtn.dblclick();

  await expect(page.getByText('Randevu Alındı')).toBeVisible();
  // Exactly 1 booking request was sent despite rapid double click
  expect(bookCount).toBe(1);
});

test('session expiry 401 code automatically logs user out', async ({ page }) => {
  let callCount = 0;
  await setupSportsPage(page, {
    slotsOverride: async (route) => {
      callCount++;
      if (callCount === 1) {
        // Initial load during login succeeds
        await route.fulfill({
          json: {
            success: true,
            date: '28.09.2026',
            slots: mockSlots
          }
        });
      } else {
        // Subsequent fetch returns 401 expired
        await route.fulfill({
          status: 401,
          json: { detail: { code: 'SESSION_EXPIRED', message: 'Oturum süreniz doldu.' } }
        });
      }
    }
  });

  await loginToSportsModal(page);

  // Trigger date change to trigger slot fetch that returns 401
  await page.getByRole('button', { name: 'Yarın' }).click();

  // Should return to login view
  await expect(page.getByRole('button', { name: 'Güvenli Giriş Yap' })).toBeVisible();
});

test('accessibility & dialog keyboard ergonomics: Escape key closes, focus restored to navbar trigger', async ({ page }) => {
  await setupSportsPage(page);

  const sportsTrigger = page.getByRole('button', { name: 'Spor Randevusu' });
  await expect(sportsTrigger).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(sportsTrigger).toHaveAttribute('aria-expanded', 'false');

  await sportsTrigger.click();
  await expect(sportsTrigger).toHaveAttribute('aria-expanded', 'true');

  const dialog = page.locator('dialog[aria-labelledby="sports-modal-title"]');
  await expect(dialog).toBeVisible();

  // Press Escape
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();

  // Focus restored to trigger
  await expect(sportsTrigger).toBeFocused();
  await expect(sportsTrigger).toHaveAttribute('aria-expanded', 'false');
});

test('mobile viewport 390x844: touch target sizes >= 44px and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupSportsPage(page);

  const sportsBtn = page.getByRole('button', { name: 'Spor' });
  await sportsBtn.click();

  // Check login button height
  const loginSubmitBtn = page.getByRole('button', { name: 'Güvenli Giriş Yap' });
  const box = await loginSubmitBtn.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);

  // Check inputs have font-size >= 16px to prevent iOS auto-zoom
  const usernameInput = page.locator('#sports-username');
  const fontSize = await usernameInput.evaluate((el) => window.getComputedStyle(el).fontSize);
  expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(16);

  // Check no horizontal scroll/overflow on dialog
  const dialog = page.locator('dialog[aria-labelledby="sports-modal-title"]');
  const scrollWidth = await dialog.evaluate((el) => el.scrollWidth);
  const clientWidth = await dialog.evaluate((el) => el.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
});
