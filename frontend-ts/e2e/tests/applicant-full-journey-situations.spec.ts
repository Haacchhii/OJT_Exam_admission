import { expect, test, type Locator, type Page } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';

async function assertPageHealthy(page: Page) {
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Something Went Wrong/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Page Error/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Access Restricted/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Error in /i })).toHaveCount(0);
}

function mainNav(page: Page) {
  return page.getByRole('navigation', { name: 'Main navigation' });
}

async function visibleAmong(...locators: Locator[]) {
  for (const locator of locators) {
    if (await locator.count() > 0 && await locator.first().isVisible()) {
      return locator.first();
    }
  }
  return null;
}

test.describe('Applicant Full Journey - Situational Coverage', () => {
  test('applicant can complete end-to-end portal journey across all student features', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.applicant.email, TEST_USERS.applicant.password);

    // Dashboard
    await expect(page).toHaveURL(/#\/student/);
    await expect(page.getByRole('heading', { name: /Your Application Journey/i })).toBeVisible();
    await assertPageHealthy(page);

    // Quick action links are part of the real student journey hub.
    await expect(page.getByRole('link', { name: 'Go to Exam', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Admission', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View Results', exact: true })).toBeVisible();

    // Online Exam
    await mainNav(page).getByRole('link', { name: 'Online Exam', exact: true }).click();
    await expect(page).toHaveURL(/#\/student\/exam/);
    await expect(
      page.getByRole('heading', { name: /Entrance Examination|Ready to Begin/i })
    ).toBeVisible();
    await assertPageHealthy(page);

    // Validate exam situations that may vary by user state.
    const availableSlots = page.getByRole('heading', { name: 'Available Exam Slots' });
    const scheduled = page.getByRole('heading', { name: 'Exam Scheduled' });
    const completed = page.getByRole('heading', { name: 'Exam Completed' });
    const examStateHeading = await visibleAmong(availableSlots, scheduled, completed);
    expect(examStateHeading).not.toBeNull();

    // Admission
    await mainNav(page).getByRole('link', { name: 'My Admission', exact: true }).click();
    await expect(page).toHaveURL(/#\/student\/admission/);
    await assertPageHealthy(page);

    // Admission can be in one of several legitimate states.
    const admissionPage = await visibleAmong(
      page.getByRole('heading', { name: /Admission Application/i }),
      page.getByRole('heading', { name: /Entrance Exam Completion Required/i }),
      page.getByRole('heading', { name: /Application Period Is Currently Closed/i }),
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByText(/Admission/i)
    );
    expect(admissionPage).not.toBeNull();

    // Results
    await mainNav(page).getByRole('link', { name: 'My Results', exact: true }).click();
    await expect(page).toHaveURL(/#\/student\/results/);
    await expect(page.getByRole('heading', { name: /Exam Results/i })).toBeVisible();
    await assertPageHealthy(page);

    // Tracker route should load and allow lookup interaction.
    await page.goto('/#/student/track');
    await expect(page).toHaveURL(/#\/student\/track/);
    await expect(page.getByRole('heading', { name: /Track Application/i })).toBeVisible();
    await page.getByRole('textbox', { name: /Search tracking ID/i }).fill('GK-ADM-2099-99999');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText(/Tracking ID Not Found|No record found/i)).toBeVisible();

    // Profile route should load editable account features.
    await page.goto('/#/student/profile');
    await expect(page).toHaveURL(/#\/student\/profile/);
    await expect(page.getByRole('heading', { name: /My Profile/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Edit Profile/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Change Password/i })).toBeVisible();
    await assertPageHealthy(page);
  });

  test('applicant is blocked from employee area and redirected to student portal', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.applicant.email, TEST_USERS.applicant.password);

    await page.goto('/#/employee');
    await expect(page).toHaveURL(/#\/student/);
    await expect(page.getByRole('heading', { name: /Your Application Journey/i })).toBeVisible();

    await page.goto('/#/employee/users');
    await expect(page).toHaveURL(/#\/student/);
    await expect(mainNav(page).getByRole('link', { name: 'Online Exam', exact: true })).toBeVisible();
  });

  test('applicant can log out and protected student route requires re-authentication', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.applicant.email, TEST_USERS.applicant.password);

    await mainNav(page).getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('button', { name: 'Log Out', exact: true }).click();

    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();

    await page.goto('/#/student/results');
    await expect(page).toHaveURL(/#\/login/);
  });
});
