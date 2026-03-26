import { expect, test } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';

test.describe('Critical Journey: Student Exam Access', () => {
  test('student can access exam page and see booking/scheduled/completed state', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.applicant.email, TEST_USERS.applicant.password);
    await page.goto('/#/student/exam');
    await expect(page).toHaveURL(/#\/student\/exam/);

    await expect(
      page.getByRole('heading', { name: 'Entrance Examination' })
        .or(page.getByRole('heading', { name: 'Ready to Begin' }))
    ).toBeVisible();

    const booking = page.getByRole('heading', { name: 'Available Exam Slots' });
    const scheduled = page.getByRole('heading', { name: 'Exam Scheduled' });
    const completed = page.getByRole('heading', { name: 'Exam Completed' });

    await expect(booking.or(scheduled).or(completed)).toBeVisible();
  });
});
