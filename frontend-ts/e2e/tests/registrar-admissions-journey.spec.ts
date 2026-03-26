import { expect, test } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';

test.describe('Critical Journey: Registrar Admissions Review', () => {
  test('registrar can open admission list and navigate to detail', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.registrar.email, TEST_USERS.registrar.password);
    await page.goto('/#/employee/admissions');
    await expect(page).toHaveURL(/#\/employee\/admissions/);

    await expect(page.getByRole('heading', { name: 'All Admission Applications' })).toBeVisible();

    const viewButtons = page.getByRole('button', { name: 'View' });
    const count = await viewButtons.count();
    test.skip(count === 0, 'No seeded admissions available to validate detail flow.');

    await viewButtons.first().click();
    await expect(page.getByRole('heading', { name: 'Application Details' })).toBeVisible();
  });
});
