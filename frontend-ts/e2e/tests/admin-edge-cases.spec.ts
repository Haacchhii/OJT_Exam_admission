import { expect, test } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';
import { createUserViaApi, deleteUserViaApi, forcePasswordResetViaApi, setUserRoleViaApi } from '../helpers/mutation';

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}@goldenkey.edu`;
}

test.describe('Admin edge-case mutations (safe)', () => {
  test('administrator can create, edit, re-role, reset, and delete a temporary user', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.admin.email, TEST_USERS.admin.password);

    const email = uniqueEmail('e2e-admin-user');
    const payload = {
      firstName: 'Temp',
      lastName: 'User',
      email,
      role: 'applicant',
      status: 'Active',
      password: 'TempUser123!',
    };

    const created = await createUserViaApi(page, payload);
    expect(created?.id).toBeTruthy();

    let cleaned = false;
    try {
      await page.goto('/#/employee/users');
      await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();

      await page.getByRole('textbox', { name: /Search users/i }).fill(email);
      const row = page.locator('tr').filter({ hasText: email }).first();
      await expect(row).toBeVisible({ timeout: 15000 });

      await row.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.getByRole('heading', { name: /Edit User/i })).toBeVisible();
      await page.getByLabel('First Name').fill('Updated');
      await page.getByLabel('Status').selectOption('Inactive');
      await page.getByRole('button', { name: 'Save Changes', exact: true }).click();

      await page.getByRole('textbox', { name: /Search users/i }).fill(email);
      await expect(page.getByText('Updated', { exact: false })).toBeVisible();

      await row.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.getByRole('heading', { name: /Edit User/i })).toBeVisible();
      await page.getByRole('button', { name: 'Set Role', exact: true }).click();
      await expect(page.getByRole('heading', { name: /Set Role for/i })).toBeVisible();
      await page.getByRole('combobox', { name: /New Role/i }).selectOption('teacher');
      await page.getByRole('button', { name: 'Set Role', exact: true }).click();

      await row.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.getByRole('button', { name: /Force Password/i }).click();
      await page.getByRole('button', { name: 'Force Reset', exact: true }).click();

      await row.getByRole('button', { name: 'Delete', exact: true }).click();
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(page.getByText(email, { exact: false })).toHaveCount(0);
      cleaned = true;
    } finally {
      if (!cleaned) {
        try {
          await deleteUserViaApi(page, created.id);
        } catch {
          // best-effort cleanup
        }
      }
    }
  });

  test('administrator can apply API role and reset helpers to a created user if the UI path is blocked', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.admin.email, TEST_USERS.admin.password);

    const email = uniqueEmail('e2e-admin-api-user');
    const created = await createUserViaApi(page, {
      firstName: 'Api',
      lastName: 'User',
      email,
      role: 'applicant',
      status: 'Active',
      password: 'ApiUser123!',
    });

    try {
      await setUserRoleViaApi(page, created.id, 'registrar');
      await forcePasswordResetViaApi(page, created.id);
      const fetchRes = await page.request.get(`${process.env.E2E_BASE_URL || 'https://ojt-exam-admission.vercel.app'}/api/users/by-email/${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${await page.evaluate(() => sessionStorage.getItem('gk_auth_token')) || ''}` },
      });
      expect(fetchRes.status()).toBeLessThan(400);
    } finally {
      try {
        await deleteUserViaApi(page, created.id);
      } catch {
        // ignore cleanup failure
      }
    }
  });
});
