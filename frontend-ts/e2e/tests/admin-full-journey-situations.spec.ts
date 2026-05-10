import { expect, test, type Page } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';

async function assertPageHealthy(page: Page) {
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Something Went Wrong|Page Error|Access Restricted|Error in /i })).toHaveCount(0);
}

function mainNav(page: Page) {
  return page.getByRole('navigation', { name: 'Main navigation' });
}

test.describe('Admin Full Journey - Situational Coverage', () => {
  test('administrator can complete full portal journey across all employee features', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.admin.email, TEST_USERS.admin.password);

    await expect(page).toHaveURL(/#\/employee/);
    await assertPageHealthy(page);

    await mainNav(page).getByRole('link', { name: 'Admissions', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/admissions/);
    await expect(page.getByRole('heading', { name: /All Admission Applications/i })).toBeVisible();
    await assertPageHealthy(page);

    // Situation: if rows exist, admin can open admission detail.
    const viewButtons = page.locator('tbody').getByRole('button', { name: 'View' });
    if (await viewButtons.count()) {
      await viewButtons.first().click();
      await expect(page.getByRole('heading', { name: /Application Details/i })).toBeVisible();
      await page.goto('/#/employee/admissions');
    }

    await mainNav(page).getByRole('link', { name: 'Exams', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/exams/);
    await expect(page.getByRole('tab', { name: 'Exams' })).toBeVisible();
    await assertPageHealthy(page);

    await mainNav(page).getByRole('link', { name: 'Results', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/results/);
    await expect(page.getByRole('heading', { name: /Teacher Score Dashboard/i })).toBeVisible();
    await assertPageHealthy(page);

    await mainNav(page).getByRole('link', { name: 'Reports', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/reports/);
    await expect(page.getByRole('heading', { name: /Reports & Exports/i })).toBeVisible();
    await assertPageHealthy(page);

    await mainNav(page).getByRole('link', { name: 'Users', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/users/);
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();
    await assertPageHealthy(page);

    await mainNav(page).getByRole('link', { name: 'Audit Log', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/audit/);
    await expect(page.getByRole('heading', { name: /Audit Trail/i })).toBeVisible();
    await assertPageHealthy(page);

    await mainNav(page).getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/settings/);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await assertPageHealthy(page);
  });

  test('administrator can directly open privileged routes', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.admin.email, TEST_USERS.admin.password);

    await page.goto('/#/employee/users');
    await expect(page).toHaveURL(/#\/employee\/users/);
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();

    await page.goto('/#/employee/audit');
    await expect(page).toHaveURL(/#\/employee\/audit/);
    await expect(page.getByRole('heading', { name: /Audit Trail/i })).toBeVisible();
  });

  test('administrator can logout and protected routes require login again', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.admin.email, TEST_USERS.admin.password);

    await mainNav(page).getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('button', { name: 'Log Out', exact: true }).click();

    await expect(page).toHaveURL(/#\/login/);
    await page.goto('/#/employee/settings');
    await expect(page).toHaveURL(/#\/login/);
  });
});
