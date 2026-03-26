import { expect, test } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';

test.describe('Critical Journey: Teacher Bulk Import Exams Modal Safety', () => {
  test('bulk import modal can be closed via X and Cancel', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.teacher.email, TEST_USERS.teacher.password);
    await page.goto('/#/employee/exams');
    await expect(page).toHaveURL(/#\/employee\/exams/);
    await expect(page.getByRole('tab', { name: 'Exams' })).toBeVisible();

    await page.getByRole('button', { name: /Import Exams/i }).click();
    await expect(page.getByRole('dialog', { name: 'Bulk Import Exams' })).toBeVisible();

    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(page.getByRole('dialog', { name: 'Bulk Import Exams' })).toBeHidden();

    await page.getByRole('button', { name: /Import Exams/i }).click();
    await expect(page.getByRole('dialog', { name: 'Bulk Import Exams' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog', { name: 'Bulk Import Exams' })).toBeHidden();
  });
});
