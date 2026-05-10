import { expect, type Page } from '@playwright/test';

function requiredEnv(name: string): string {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const TEST_USERS = {
  admin: {
    email: requiredEnv('E2E_ADMIN_EMAIL'),
    password: requiredEnv('E2E_ADMIN_PASSWORD'),
  },
  registrar: {
    email: requiredEnv('E2E_REGISTRAR_EMAIL'),
    password: requiredEnv('E2E_REGISTRAR_PASSWORD'),
  },
  teacher: {
    email: requiredEnv('E2E_TEACHER_EMAIL'),
    password: requiredEnv('E2E_TEACHER_PASSWORD'),
  },
  applicant: {
    email: requiredEnv('E2E_APPLICANT_EMAIL'),
    password: requiredEnv('E2E_APPLICANT_PASSWORD'),
  },
} as const;

export async function loginViaUi(page: Page, email: string, password: string) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await page.goto('/#/login');

    // Wait briefly for the login form to appear. If the user is already
    // authenticated (redirected to employee/student), treat as success.
    const emailHandle = await page.waitForSelector('[data-testid="login-email"]', { state: 'visible', timeout: 5000 }).catch(() => null);
    if (!emailHandle) {
      const current = page.url();
      if (/#\/\/(student|employee|change-password)/.test(current) || /#\/(student|employee|change-password)/.test(current)) {
        return;
      }
      // allow retry attempts
      if (attempt < maxAttempts) {
        await page.waitForTimeout(1000 * attempt);
        continue;
      }
      throw new Error('Login form not visible');
    }

    await page.getByTestId('login-email').fill(email);
    await page.getByTestId('login-password').fill(password);

    const loginResponsePromise = page.waitForResponse(response => response.url().includes('/auth/login'));
    await page.getByTestId('login-submit').click();

    try {
      const loginResponse = await loginResponsePromise;
      if (loginResponse.status() >= 400) {
        if (attempt < maxAttempts) {
          await page.waitForTimeout(1000 * attempt);
          continue;
        }
        throw new Error(`Login API returned ${loginResponse.status()}`);
      }
    } catch {
      // If the response is not observable, fall back to the redirect check below.
    }

    const redirected = await page.waitForURL(/#\/(student|employee|change-password)/, { timeout: 15000 }).then(() => true).catch(() => false);
    if (redirected) return;

    if (attempt < maxAttempts) {
      await page.waitForTimeout(1000 * attempt);
      continue;
    }

    await expect(page).toHaveURL(/#\/(student|employee|change-password)/);
  }
}
