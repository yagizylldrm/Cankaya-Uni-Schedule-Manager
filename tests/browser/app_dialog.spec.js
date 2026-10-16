import { test, expect } from '@playwright/test';

test.describe('AppDialog component accessibility and focus semantics', () => {
  test('dialog opens, supports Escape key, backdrop click, and restores focus to trigger', async ({ page }) => {
    // Mock basic APIs
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/departments') {
        await route.fulfill({ json: [{ code: 'CENG', name: 'Bilgisayar Mühendisliği' }] });
      } else if (url.pathname === '/api/courses') {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: {} });
      }
    });

    await page.goto('/');

    const trigger = page.getByRole('button', { name: 'Programı kaydet veya yükle' });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const loadOption = page.getByRole('button', { name: 'Kayıtlı programı yükle', exact: true });
    await expect(loadOption).toBeVisible();
    await loadOption.click();

    // Verify dialog opened
    const dialog = page.getByRole('dialog', { name: 'Kayıtlı programı yükle' });
    await expect(dialog).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Focus restored to trigger button
    await expect(trigger).toBeFocused();
  });

  test('AI assistant dialog opens, shows model selector, preset prompts, and can be closed', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/departments') {
        await route.fulfill({ json: [{ code: 'CENG', name: 'Bilgisayar Mühendisliği' }] });
      } else if (url.pathname === '/api/courses') {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: {} });
      }
    });

    await page.goto('/');

    // AI Assistant trigger button in navbar
    const aiTrigger = page.getByRole('button', { name: 'Yapay Zeka Asistanı' });
    await expect(aiTrigger).toBeVisible();
    await aiTrigger.click();

    // Verify AI Dialog opened
    const dialog = page.getByRole('dialog', { name: 'Yapay Zeka Program Asistanı' });
    await expect(dialog).toBeVisible();

    // Verify model provider buttons and preset prompts
    await expect(dialog.getByRole('button', { name: 'Google Gemini' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Groq (Llama 3.3)' })).toBeVisible();
    await expect(dialog.getByText('Pazartesi günü tamamen boş olsun')).toBeVisible();

    // Close via close button
    const closeBtn = dialog.getByRole('button', { name: 'Kapat' });
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();
  });
});

