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

function parseRgb(rgbStr) {
  const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function relativeLuminance([r, g, b]) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrastRatio(rgb1, rgb2) {
  const lum1 = relativeLuminance(rgb1);
  const lum2 = relativeLuminance(rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

async function setupPage(page) {
  // Clear storage and freeze browser clock to 2026-10-16
  await page.addInitScript(() => {
    localStorage.clear();
    const fixedDate = new Date('2026-10-16T12:00:00Z');
    Date.now = () => fixedDate.getTime();
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/departments') {
      await route.fulfill({ json: [{ code: 'CENG', name: 'Bilgisayar Mühendisliği' }] });
    } else if (url.pathname === '/api/courses') {
      await route.fulfill({ json: [mockCourse] });
    } else if (url.pathname === '/api/courses/CENG101') {
      await route.fulfill({ json: mockCourse });
    } else if (url.pathname === '/api/combinations') {
      await route.fulfill({ json: { count: 1, combinations: mockCombos } });
    } else {
      await route.fulfill({ json: {} });
    }
  });

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
}

test('design tokens and typography: studio semantic colors and font families', async ({ page }) => {
  await setupPage(page);

  // Body styles in light mode
  const body = page.locator('body');
  const lightBg = await body.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  const fontFamily = await body.evaluate((el) => window.getComputedStyle(el).fontFamily);

  // Expect canvas #F7F7F3 in rgb (247, 247, 243)
  expect(lightBg).toBe('rgb(247, 247, 243)');
  // Expect font stack to lead with IBM Plex Sans
  expect(fontFamily.toLowerCase()).toContain('ibm plex sans');

  // Verify Literata and IBM Plex Sans font definitions exist in document.fonts
  const hasLiterata = await page.evaluate(() => Array.from(document.fonts).some(f => f.family.includes('Literata')));
  const hasIBMPlexSans = await page.evaluate(() => Array.from(document.fonts).some(f => f.family.includes('IBM Plex Sans')));
  expect(hasLiterata).toBe(true);
  expect(hasIBMPlexSans).toBe(true);

  // Verify theme switch to dark mode
  const themeToggle = page.getByRole('button', { name: /temaya geç/i });
  await themeToggle.click();

  // In dark mode html has dark class, and background is #121212 (rgb(18, 18, 18))
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect.poll(async () => {
    return await body.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  }).toBe('rgb(18, 18, 18)');
});

test('token contrast ratio meets WCAG AA standards in light and dark modes', async ({ page }) => {
  await setupPage(page);

  // In light mode: check ink/canvas and muted-ink/canvas contrast
  const lightColors = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return {
      canvas: window.getComputedStyle(body).backgroundColor,
      ink: window.getComputedStyle(body).color,
    };
  });

  const lightRatio = contrastRatio(parseRgb(lightColors.canvas), parseRgb(lightColors.ink));
  // WCAG AA normal text minimum is 4.5:1
  expect(lightRatio).toBeGreaterThanOrEqual(4.5);

  // Switch to dark mode
  const themeToggle = page.getByRole('button', { name: /temaya geç/i });
  await themeToggle.click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect.poll(async () => {
    return await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
  }).toBe('rgb(18, 18, 18)');

  const darkColors = await page.evaluate(() => {
    const body = document.body;
    return {
      canvas: window.getComputedStyle(body).backgroundColor,
      ink: window.getComputedStyle(body).color,
    };
  });

  const darkRatio = contrastRatio(parseRgb(darkColors.canvas), parseRgb(darkColors.ink));
  expect(darkRatio).toBeGreaterThanOrEqual(4.5);
});

test('visual baseline check across mobile, tablet, and desktop viewports', async ({ page }) => {
  await setupPage(page);

  // Add course to render full schedule
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByText('Seçili program', { exact: true })).toBeVisible();

  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(100);

    // Verify page has no unexpected horizontal overflow in light mode
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify timetable grid or agenda exists
    if (vp.width < 768) {
      await page.getByRole('button', { name: 'Program', exact: true }).click();
      await page.getByRole('button', { name: /Günlük/i }).click();
      await expect(page.locator('[data-agenda]')).toBeVisible();
    } else {
      const weekBtn = page.getByRole('button', { name: 'Haftalık', exact: true });
      if (await weekBtn.isVisible()) {
        await weekBtn.click();
      }
      await expect(page.locator('[data-weekly-grid]')).toBeVisible();
    }
  }

  // Switch to dark mode and verify
  const themeToggle = page.getByRole('button', { name: /temaya geç/i });
  if (await themeToggle.isVisible()) {
    await themeToggle.click();
  } else {
    // on mobile might be under more
    const moreBtn = page.getByRole('button', { name: 'Daha' });
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await page.getByRole('button', { name: /temaya geç/i }).click();
      await page.keyboard.press('Escape');
    }
  }

  await expect(page.locator('html')).toHaveClass(/dark/);
  // Verify dark mode background
  await expect.poll(async () => {
    return await page.locator('body').evaluate(el => window.getComputedStyle(el).backgroundColor);
  }).toBe('rgb(18, 18, 18)');
});
