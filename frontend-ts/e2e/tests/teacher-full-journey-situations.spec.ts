import { expect, test, type Page } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';

async function assertPageHealthy(page: Page) {
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Something Went Wrong|Page Error|Access Restricted|Error in /i })).toHaveCount(0);
}

function mainNav(page: Page) {
  return page.getByRole('navigation', { name: 'Main navigation' });
}

test.describe('Teacher Full Journey - Situational Coverage', () => {
  test('teacher can complete full portal journey across allowed features', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.teacher.email, TEST_USERS.teacher.password);

    await expect(page).toHaveURL(/#\/employee/);
    await expect(mainNav(page).getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    await assertPageHealthy(page);

    await mainNav(page).getByRole('link', { name: 'Exams', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/exams/);
    await expect(page.getByRole('tab', { name: 'Exams' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Create Exam' })).toBeVisible();
    await assertPageHealthy(page);

    // Situation: import preview modal can open and close safely.
    await page.getByRole('tab', { name: 'Create Exam' }).click();
    await expect(page.getByRole('heading', { name: 'Upload Questionnaire' })).toBeVisible({ timeout: 20000 });
    await page.locator('#questionnaire-upload').setInputFiles('e2e/fixtures/exam-import-sample.json');
    await expect(page.getByRole('dialog', { name: 'Import Preview' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Import Preview' }).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog', { name: 'Import Preview' })).toBeHidden();

    await mainNav(page).getByRole('link', { name: 'Results', exact: true }).click();
    await expect(page).toHaveURL(/#\/employee\/results/);
    await expect(page.getByRole('heading', { name: /Teacher Score Dashboard/i })).toBeVisible();
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

  test('teacher is blocked from restricted employee routes', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.teacher.email, TEST_USERS.teacher.password);

    await expect(mainNav(page).getByRole('link', { name: 'Admissions', exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByRole('link', { name: 'Audit Log', exact: true })).toHaveCount(0);

    await page.goto('/#/employee/users');
    await expect(page).toHaveURL(/#\/employee\/users/);
    await expect(page.getByRole('heading', { name: /Access Restricted/i })).toBeVisible();

    await page.goto('/#/employee/audit');
    await expect(page).toHaveURL(/#\/employee\/audit/);
    await expect(page.getByRole('heading', { name: /Access Restricted/i })).toBeVisible();
  });

  test('teacher can logout and protected routes require login again', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.teacher.email, TEST_USERS.teacher.password);

    await mainNav(page).getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('button', { name: 'Log Out', exact: true }).click();

    await expect(page).toHaveURL(/#\/login/);
    await page.goto('/#/employee/results');
    await expect(page).toHaveURL(/#\/login/);
  });
});
