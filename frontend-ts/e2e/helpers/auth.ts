import { expect, type Page } from '@playwright/test';

export const TEST_USERS = {
  admin: { email: 'admin@goldenkey.edu', password: 'admin123' },
  registrar: { email: 'registrar@goldenkey.edu', password: 'registrar123' },
  teacher: { email: 'teacher@goldenkey.edu', password: 'teacher123' },
  applicant: { email: 'ana.reyes@email.com', password: 'student123' },
} as const;

export async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto('/#/login');
  await expect(page.getByTestId('login-email')).toBeVisible();
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();

  // Wait for the auth context + redirect to settle before downstream assertions.
  await expect(page).toHaveURL(/#\/(student|employee)/);
}
