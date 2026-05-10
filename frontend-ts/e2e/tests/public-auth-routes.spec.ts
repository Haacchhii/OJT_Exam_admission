import { expect, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

test.describe('Public Authentication Routes', () => {
  test('login page loads and exposes sign-in controls', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/login`);

    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('registration page loads and shows applicant onboarding copy', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/register`);

    await expect(page).toHaveURL(/#\/register/);
    await expect(page.getByRole('heading', { name: /Start Your Journey Today/i })).toBeVisible();
    await expect(page.getByText(/Create your account/i)).toBeVisible();
    await expect(page.getByText(/Book & take the entrance exam/i)).toBeVisible();
  });

  test('forgot password page loads and can submit an email', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/forgot-password`);

    await expect(page).toHaveURL(/#\/forgot-password/);
    await expect(page.getByRole('heading', { name: /Forgot Password|Reset Password/i })).toBeVisible();

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('test@example.com');

    const submitButton = page.getByRole('button', { name: /Send|Reset|Continue/i }).first();
    await expect(submitButton).toBeVisible();
  });

  test('reset password page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/reset-password`);

    await expect(page).toHaveURL(/#\/forgot-password/);
    await expect(page.getByRole('heading', { name: /Forgot Password|Reset Password/i })).toBeVisible();
  });

  test('verify email page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/verify-email`);

    await expect(page).toHaveURL(/#\/verify-email/);
    await expect(page.locator('body')).toContainText(/verify|email/i);
  });

  test('change password page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/change-password`);

    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
  });
});
