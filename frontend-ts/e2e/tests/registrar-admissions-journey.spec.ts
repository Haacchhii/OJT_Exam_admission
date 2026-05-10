import { expect, test } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';

test.describe('Critical Journey: Registrar Admissions Review', () => {
  test('registrar can open admission list and navigate to detail', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.registrar.email, TEST_USERS.registrar.password);
    await page.goto('/#/employee/admissions');
    await expect(page).toHaveURL(/#\/employee\/admissions/);

    await expect(page.getByRole('heading', { name: 'All Admission Applications' })).toBeVisible();

    const rows = page.locator('tbody tr[role="button"]');
    const count = await rows.count();
    test.skip(count === 0, 'No seeded admissions available to validate detail flow.');

    await rows.first().click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Application Details' })).toBeVisible({ timeout: 15000 });
  });
});