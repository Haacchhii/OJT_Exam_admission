import { expect, test, type Page } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';

type NavStep = {
  label: string;
  urlPattern: RegExp;
  marker?: { role: 'heading' | 'tab' | 'link' | 'button'; name: string | RegExp };
};

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

async function navigateViaSidebar(page: Page, step: NavStep) {
  await expect(mainNav(page).getByRole('link', { name: step.label, exact: true })).toBeVisible();
  await mainNav(page).getByRole('link', { name: step.label, exact: true }).click();
  await expect(page).toHaveURL(step.urlPattern);
  await assertPageHealthy(page);

  if (!step.marker) return;

  if (step.marker.role === 'heading') {
    await expect(page.getByRole('heading', { name: step.marker.name })).toBeVisible();
  }
  if (step.marker.role === 'tab') {
    await expect(page.getByRole('tab', { name: step.marker.name })).toBeVisible();
  }
  if (step.marker.role === 'link') {
    await expect(page.getByRole('link', { name: step.marker.name })).toBeVisible();
  }
  if (step.marker.role === 'button') {
    await expect(page.getByRole('button', { name: step.marker.name })).toBeVisible();
  }
}

test.describe('Stakeholder Navigation Coverage', () => {
  test.setTimeout(120_000);

  test('applicant can navigate key student pages without page errors', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.applicant.email, TEST_USERS.applicant.password);

    const steps: NavStep[] = [
      {
        label: 'Dashboard',
        urlPattern: /#\/student(\/dashboard)?$/,
        marker: { role: 'heading', name: /Your Application Journey/i },
      },
      {
        label: 'Online Exam',
        urlPattern: /#\/student\/exam/,
        marker: { role: 'heading', name: /Entrance Examination|Ready to Begin/i },
      },
      {
        label: 'My Admission',
        urlPattern: /#\/student\/admission/,
        marker: { role: 'heading', name: /Admission Application/i },
      },
      {
        label: 'My Results',
        urlPattern: /#\/student\/results/,
        marker: { role: 'heading', name: /Exam Results/i },
      },
    ];

    for (const step of steps) {
      await navigateViaSidebar(page, step);
    }
  });

  test('administrator can navigate all employee pages and open admission details', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.admin.email, TEST_USERS.admin.password);

    const steps: NavStep[] = [
      {
        label: 'Dashboard',
        urlPattern: /#\/employee(\/dashboard)?$/,
      },
      {
        label: 'Admissions',
        urlPattern: /#\/employee\/admissions/,
        marker: { role: 'heading', name: /All Admission Applications/i },
      },
      {
        label: 'Exams',
        urlPattern: /#\/employee\/exams/,
        marker: { role: 'tab', name: 'Exams' },
      },
      {
        label: 'Results',
        urlPattern: /#\/employee\/results/,
        marker: { role: 'heading', name: /Teacher Score Dashboard/i },
      },
      {
        label: 'Reports',
        urlPattern: /#\/employee\/reports/,
        marker: { role: 'heading', name: /Reports & Exports/i },
      },
      {
        label: 'Users',
        urlPattern: /#\/employee\/users/,
        marker: { role: 'heading', name: /User Management/i },
      },
      {
        label: 'Audit Log',
        urlPattern: /#\/employee\/audit/,
        marker: { role: 'heading', name: /Audit Trail/i },
      },
      {
        label: 'Settings',
        urlPattern: /#\/employee\/settings/,
        marker: { role: 'heading', name: 'Settings' },
      },
    ];

    for (const step of steps) {
      await navigateViaSidebar(page, step);
    }

    await navigateViaSidebar(page, {
      label: 'Admissions',
      urlPattern: /#\/employee\/admissions/,
      marker: { role: 'heading', name: /All Admission Applications/i },
    });

    const viewButtons = page.locator('tbody').getByRole('button', { name: 'View' });
    if (await viewButtons.count()) {
      await viewButtons.first().click();
      await expect(page.getByRole('heading', { name: /Application Details/i })).toBeVisible();
      await assertPageHealthy(page);
    }
  });

  test('registrar can navigate allowed pages and is blocked from restricted pages in sidebar', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.registrar.email, TEST_USERS.registrar.password);

    const allowed: NavStep[] = [
      {
        label: 'Dashboard',
        urlPattern: /#\/employee(\/dashboard)?$/,
      },
      {
        label: 'Admissions',
        urlPattern: /#\/employee\/admissions/,
        marker: { role: 'heading', name: /All Admission Applications/i },
      },
      {
        label: 'Results',
        urlPattern: /#\/employee\/results/,
        marker: { role: 'heading', name: /Exam Results|Essay Review|Per-Question Analytics/i },
      },
      {
        label: 'Reports',
        urlPattern: /#\/employee\/reports/,
        marker: { role: 'heading', name: /Reports & Exports/i },
      },
    ];

    for (const step of allowed) {
      await navigateViaSidebar(page, step);
    }

    await expect(mainNav(page).getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByRole('link', { name: 'Audit Log', exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByRole('link', { name: 'Settings', exact: true })).toHaveCount(1);
    await expect(mainNav(page).getByRole('link', { name: 'Exams', exact: true })).toHaveCount(0);

    await navigateViaSidebar(page, {
      label: 'Admissions',
      urlPattern: /#\/employee\/admissions/,
      marker: { role: 'heading', name: /All Admission Applications/i },
    });

    const viewButtons = page.locator('tbody').getByRole('button', { name: 'View' });
    if (await viewButtons.count()) {
      await viewButtons.first().click();
      await expect(page.getByRole('heading', { name: /Application Details/i })).toBeVisible();
      await assertPageHealthy(page);
    }
  });

  test('teacher can navigate allowed pages and is blocked from restricted pages in sidebar', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.teacher.email, TEST_USERS.teacher.password);

    const allowed: NavStep[] = [
      {
        label: 'Dashboard',
        urlPattern: /#\/employee(\/dashboard)?$/,
      },
      {
        label: 'Exams',
        urlPattern: /#\/employee\/exams/,
        marker: { role: 'tab', name: 'Exams' },
      },
      {
        label: 'Results',
        urlPattern: /#\/employee\/results/,
        marker: { role: 'heading', name: /Teacher Score Dashboard/i },
      },
      {
        label: 'Reports',
        urlPattern: /#\/employee\/reports/,
        marker: { role: 'heading', name: /Reports & Exports/i },
      },
    ];

    for (const step of allowed) {
      await navigateViaSidebar(page, step);
    }

    await expect(mainNav(page).getByRole('link', { name: 'Admissions', exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByRole('link', { name: 'Audit Log', exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByRole('link', { name: 'Settings', exact: true })).toHaveCount(1);
  });
});
