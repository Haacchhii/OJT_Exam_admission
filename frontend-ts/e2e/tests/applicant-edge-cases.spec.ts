import { test, expect } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';
import { createAdmissionViaApi, adminBulkDeleteAdmissions } from '../helpers/mutation';

test.describe('Applicant edge-case mutations (safe)', () => {
  test('create admission via API, verify, then delete as admin', async ({ page }) => {
    // login as applicant to create admission
    await loginViaUi(page, TEST_USERS.applicant.email, TEST_USERS.applicant.password);

    const payload = {
      firstName: 'E2E',
      lastName: `Applicant-${Date.now()}`,
      email: TEST_USERS.applicant.email,
      phone: '091234567890',
      dob: '2010-01-01',
      gender: 'Male',
      addressStreet: '123 Test St',
      addressCityMunicipality: 'Testville',
      address: '123 Test St, Testville, Test Province, 1000',
      gradeLevel: 'Grade 7',
      schoolYear: '2026',
    } as Record<string, any>;

    const admission = await createAdmissionViaApi(page, payload);
    expect(admission).toBeTruthy();
    expect(admission.id).toBeGreaterThan(0);

    // ensure server has the record (GET)
    const base = process.env.E2E_BASE_URL || 'https://ojt-exam-admission.vercel.app';
    const token = await page.evaluate(() => sessionStorage.getItem('gk_auth_token'));
    const getRes = await page.request.get(`${base}/api/admissions/${admission.id}`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    expect(getRes.status()).toBeLessThan(400);

    // cleanup: clear existing token, then login as admin and delete the admission created
    await page.evaluate(() => { try { sessionStorage.removeItem('gk_auth_token'); } catch {} });
    await page.goto('/#/login');
    await loginViaUi(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    const deleted = await adminBulkDeleteAdmissions(page, [admission.id]);
    expect(deleted).toBeTruthy();
  });
});
