import { expect, test } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';

test.describe('Critical Journey: Teacher Bulk Import Exams Modal Safety', () => {
  test('bulk import modal can be closed via X and Cancel', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.teacher.email, TEST_USERS.teacher.password);
    await page.goto('/#/employee/exams');
    await expect(page).toHaveURL(/#\/employee\/exams/);
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: 'Create Exam' }).click();
    await expect(page.getByRole('heading', { name: 'Upload Questionnaire' })).toBeVisible({ timeout: 20000 });

    await page.locator('#questionnaire-upload').setInputFiles('e2e/fixtures/exam-import-sample.json');

    await expect(page.getByRole('dialog', { name: 'Import Preview' })).toBeVisible();

    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(page.getByRole('dialog', { name: 'Import Preview' })).toBeHidden();

    await page.getByRole('tab', { name: 'Create Exam' }).click();
    await page.locator('#questionnaire-upload').setInputFiles('e2e/fixtures/exam-import-sample.json');

    await expect(page.getByRole('dialog', { name: 'Import Preview' })).toBeVisible();

    await page.getByRole('dialog', { name: 'Import Preview' }).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog', { name: 'Import Preview' })).toBeHidden();
  });
});