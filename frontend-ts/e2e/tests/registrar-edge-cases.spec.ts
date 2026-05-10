import { expect, test } from '@playwright/test';
import { loginViaUi, TEST_USERS } from '../helpers/auth';
import { adminBulkDeleteAdmissions, createAdmissionViaApi, handoffAdmissionViaApi, updateAdmissionStatusViaApi } from '../helpers/mutation';

function uniqueTracking(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe('Registrar edge-case mutations (safe)', () => {
  test.setTimeout(120000);

  test('registrar can move a temporary application through status changes and handoff', async ({ page }) => {
    await loginViaUi(page, TEST_USERS.applicant.email, TEST_USERS.applicant.password);

    const payload = {
      firstName: 'E2E',
      lastName: uniqueTracking('Registrar Applicant'),
      email: TEST_USERS.applicant.email,
      phone: '091234567890',
      dob: '2010-01-01',
      gender: 'Male',
      addressStreet: '123 Test Street',
      addressCityMunicipality: 'Test City',
      addressProvince: 'Test Province',
      addressZipCode: '1000',
      address: '123 Test Street, Test City, Test Province, 1000',
      gradeLevel: 'Grade 7',
      schoolYear: '2026',
      guardian: 'Guardian Name',
      guardianRelation: 'Parent',
      guardianPhone: '091234567890',
      guardianEmail: TEST_USERS.applicant.email,
    } as Record<string, any>;

    const admission = await createAdmissionViaApi(page, payload);
    expect(admission?.id).toBeTruthy();

    let cleaned = false;
    const registrarPage = await page.context().newPage();
    const adminPage = await page.context().newPage();
    try {
      await loginViaUi(registrarPage, TEST_USERS.registrar.email, TEST_USERS.registrar.password);
      await updateAdmissionStatusViaApi(registrarPage, admission.id, 'Under Screening', 'Initial screening complete.');
      await updateAdmissionStatusViaApi(registrarPage, admission.id, 'Under Evaluation', 'Evaluation in progress.');
      await updateAdmissionStatusViaApi(registrarPage, admission.id, 'Accepted', 'Accepted for enrollment handoff.');
      await handoffAdmissionViaApi(registrarPage, admission.id);

      await registrarPage.goto('/#/employee/admissions');
      const searchBox = registrarPage.getByRole('textbox', { name: /Search applications/i });
      await expect(searchBox).toBeVisible({ timeout: 20000 });
      await searchBox.fill(TEST_USERS.applicant.email);
      const row = registrarPage.locator('tr').filter({ hasText: TEST_USERS.applicant.email }).first();
      await expect(row).toBeVisible({ timeout: 20000 });
      await expect(row.getByText('Accepted', { exact: true })).toBeVisible();
      await row.getByRole('button', { name: 'View', exact: true }).click();
      const auditToken = await adminPage.evaluate(() => {
        try {
          return sessionStorage.getItem('gk_auth_token');
        } catch {
          return null;
        }
      });
      const auditRes = await adminPage.request.get(`${process.env.E2E_BASE_URL || 'https://ojt-exam-admission.vercel.app'}/api/audit-logs?entity=admission&entityId=${admission.id}&action=admission.handoff`, {
        headers: { Authorization: auditToken ? `Bearer ${auditToken}` : '' },
      });
      expect(auditRes.status()).toBeLessThan(400);
      const auditBody = await auditRes.json();
      expect((auditBody?.data || auditBody?.items || []).length).toBeGreaterThan(0);
      cleaned = true;
    } finally {
      await loginViaUi(adminPage, TEST_USERS.admin.email, TEST_USERS.admin.password);
      try {
        await adminBulkDeleteAdmissions(adminPage, [admission.id]);
      } catch {
        // best-effort cleanup
      }
      if (!cleaned) {
        // keep the assertion path visible in the report if the flow breaks before handoff
      }
    }
  });
});
