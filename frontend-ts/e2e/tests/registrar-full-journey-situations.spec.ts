import { expect, test, type Page } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';

async function assertPageHealthy(page: Page) {
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Something Went Wrong|Page Error|Access Restricted|Error in /i })).toHaveCount(0);
}

function mainNav(page: Page) {
  return page.getByRole('navigation', { name: 'Main navigation' });
}

test.describe('Registrar Full Journey - Situational Coverage', () => {
  test('registrar can complete full portal journey across allowed features', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.registrar.email, TEST_USERS.registrar.password);

    await expect(page).toHaveURL(/#\/employee/);
    await assertPageHealthy(page);

    await mainNav(page).getByRole('link', { name: 'Admissions', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/admissions/);
    await expect(page.getByRole('heading', { name: /All Admission Applications/i })).toBeVisible();
    await assertPageHealthy(page);

    // Situation: if admissions are seeded, registrar can inspect details.
    const rows = page.locator('tbody tr[role="button"]');
    const count = await rows.count();
    if (count > 0) {
      await rows.first().click();
      await expect(page.getByRole('heading', { name: /Application Details/i })).toBeVisible({ timeout: 15000 });
      await assertPageHealthy(page);
      await page.goto('/#/employee/admissions');
      await expect(
        page.getByRole('heading', { name: /All Admission Applications|Application Details/i })
      ).toBeVisible();
    }

    await mainNav(page).getByRole('link', { name: 'Results', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/results/);
    await expect(page.getByRole('heading', { name: /Exam Results|Essay Review|Per-Question Analytics/i })).toBeVisible();
    await assertPageHealthy(page);

    await mainNav(page).getByRole('link', { name: 'Reports', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/reports/);
    await expect(page.getByRole('heading', { name: /Reports & Exports/i })).toBeVisible();
    await assertPageHealthy(page);

    await mainNav(page).getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/settings/);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await assertPageHealthy(page);
  });

  test('registrar is blocked from restricted employee routes', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.registrar.email, TEST_USERS.registrar.password);

    await expect(mainNav(page).getByRole('link', { name: 'Exams', exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByRole('link', { name: 'Audit Log', exact: true })).toHaveCount(0);

    await page.goto('/#/employee/exams');
    await expect(page).toHaveURL(/#\/employee\/exams/);
    await expect(page.getByRole('heading', { name: /Access Restricted/i })).toBeVisible();

    await page.goto('/#/employee/users');
    await expect(page).toHaveURL(/#\/employee\/users/);
    await expect(page.getByRole('heading', { name: /Access Restricted/i })).toBeVisible();
  });

  test('registrar can logout and protected routes require login again', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.registrar.email, TEST_USERS.registrar.password);

    await mainNav(page).getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('button', { name: 'Log Out', exact: true }).click();

    await expect(page).toHaveURL(/#\/login/);
    await page.goto('/#/employee/admissions');
    await expect(page).toHaveURL(/#\/login/);
  });
});
