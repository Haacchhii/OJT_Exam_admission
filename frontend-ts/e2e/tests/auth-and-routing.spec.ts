import { expect, test } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';

test.describe('Critical Journey: Authentication and Role Routing', () => {
  test('applicant lands on student workspace after login', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.applicant.email, TEST_USERS.applicant.password);
    await expect(page).toHaveURL(/#\/student/);
    await expect(page.getByText('Your Application Journey')).toBeVisible();
  });

  test('teacher lands on employee workspace after login', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.teacher.email, TEST_USERS.teacher.password);
    await expect(page).toHaveURL(/#\/employee/);
    await expect(page.getByRole('link', { name: 'Exams', exact: true }).first()).toBeVisible();
  });
});
