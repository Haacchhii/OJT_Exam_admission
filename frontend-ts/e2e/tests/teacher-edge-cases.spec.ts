import { expect, test } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';
import { createExamViaApi, deleteExamViaApi } from '../helpers/mutation';

function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe('Teacher edge-case mutations (safe)', () => {
  test('teacher can create, toggle, preview, and delete a temporary exam', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.teacher.email, TEST_USERS.teacher.password);

    const token = await page.evaluate(() => {
      try {
        return sessionStorage.getItem('gk_auth_token');
      } catch {
        return null;
      }
    });
    const base = process.env.E2E_BASE_URL || 'https://ojt-exam-admission.vercel.app';
    const activePeriodRes = await page.request.get(`${base}/api/academic-years/active`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    const activePeriod = activePeriodRes.ok() ? await activePeriodRes.json() : null;

    const title = uniqueTitle('E2E Teacher Edge Exam');
    const payload = {
      title,
      gradeLevel: 'Grade 7',
      durationMinutes: 45,
      passingScore: 75,
      academicYearId: activePeriod?.id,
      semesterId: activePeriod?.semesters?.find((semester: any) => semester.isActive)?.id,
      questions: [
        {
          id: 1,
          questionText: 'What is 2 + 2?',
          questionType: 'mc',
          points: 1,
          orderNum: 1,
          choices: [
            { id: 11, choiceText: '3', isCorrect: false },
            { id: 12, choiceText: '4', isCorrect: true },
            { id: 13, choiceText: '5', isCorrect: false },
            { id: 14, choiceText: '6', isCorrect: false },
          ],
        },
      ],
    };

    const created = await createExamViaApi(page, payload);
    expect(created?.id).toBeTruthy();

    let cleaned = false;
    try {
      await page.goto('/#/employee/exams');
      await expect(page.getByRole('heading', { name: /All Exams/i })).toBeVisible();
      await expect(page.getByText(title, { exact: false })).toBeVisible({ timeout: 20000 });

      const row = page.locator('tr').filter({ hasText: title }).first();
      await row.getByRole('button', { name: 'View', exact: true }).click();
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.getByText(/Questions \(1\)/i)).toBeVisible();

      await page.getByRole('button', { name: /Back to Exam List/i }).click();

      const deactivateButton = row.getByRole('button', { name: 'Deactivate', exact: true });
      const activateButton = row.getByRole('button', { name: 'Activate', exact: true });
      const actionButton = (await deactivateButton.count()) > 0 ? deactivateButton : activateButton;
      const actionLabel = (await deactivateButton.count()) > 0 ? 'Deactivate' : 'Activate';
      await actionButton.click();
      await page.getByRole('alertdialog').getByRole('button', { name: actionLabel, exact: true }).click();

      await row.getByRole('button', { name: 'Delete', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
      await deleteExamViaApi(page, created.id);
      const verifyRes = await page.request.get(`${base}/api/exams/${created.id}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      expect(verifyRes.status()).toBe(404);
      cleaned = true;
    } finally {
      if (!cleaned) {
        try {
          await deleteExamViaApi(page, created.id);
        } catch {
          // best-effort cleanup
        }
      }
    }
  });
});
