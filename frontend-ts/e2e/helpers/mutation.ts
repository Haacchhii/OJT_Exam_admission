import { type Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://ojt-exam-admission.vercel.app';

async function getAuthToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      // sessionStorage key used by the app
      return sessionStorage.getItem('gk_auth_token');
    } catch {
      return null;
    }
  });
}

export async function createAdmissionViaApi(page: Page, admissionPayload: Record<string, any>) {
  const token = await getAuthToken(page);
  const res = await page.request.post(`${BASE}/api/admissions`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    data: admissionPayload,
  });
  const status = res.status();
  const body = await res.json().catch(() => null);
  if (status >= 400) throw new Error(`createAdmission failed ${status} ${JSON.stringify(body)}`);
  return body;
}

export async function uploadAdmissionDocument(page: Page, admissionId: number, filePath: string) {
  const token = await getAuthToken(page);
  const form = new FormData();
  // Playwright's request.post supports multipart by providing 'multipart'
  // But here we'll use page.request.post with 'multipart' field.
  return await page.request.post(`${BASE}/api/admissions/${admissionId}/documents`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
    multipart: [{ name: 'file', file: filePath }],
  }).then(async (res) => {
    const status = res.status();
    const body = await res.json().catch(() => null);
    if (status >= 400) throw new Error(`uploadAdmissionDocument failed ${status} ${JSON.stringify(body)}`);
    return body;
  });
}

export async function adminBulkDeleteAdmissions(page: Page, ids: number[]) {
  const token = await getAuthToken(page);
  const res = await page.request.post(`${BASE}/api/admissions/bulk-delete`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    data: { ids },
  });
  const status = res.status();
  const body = await res.json().catch(() => null);
  if (status >= 400) throw new Error(`adminBulkDeleteAdmissions failed ${status} ${JSON.stringify(body)}`);
  return body;
}

export async function createExamViaApi(page: Page, examPayload: Record<string, any>) {
  const token = await getAuthToken(page);
  const res = await page.request.post(`${BASE}/api/exams`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    data: examPayload,
  });
  const status = res.status();
  const body = await res.json().catch(() => null);
  if (status >= 400) throw new Error(`createExam failed ${status} ${JSON.stringify(body)}`);
  return body;
}

export async function deleteExamViaApi(page: Page, examId: number) {
  const token = await getAuthToken(page);
  const res = await page.request.delete(`${BASE}/api/exams/${examId}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  const status = res.status();
  if (status >= 400) {
    const body = await res.json().catch(() => null);
    throw new Error(`deleteExam failed ${status} ${JSON.stringify(body)}`);
  }
  return { deleted: true };
}

export async function createUserViaApi(page: Page, userPayload: Record<string, any>) {
  const token = await getAuthToken(page);
  const res = await page.request.post(`${BASE}/api/users`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    data: userPayload,
  });
  const status = res.status();
  const body = await res.json().catch(() => null);
  if (status >= 400) throw new Error(`createUser failed ${status} ${JSON.stringify(body)}`);
  return body;
}

export async function deleteUserViaApi(page: Page, userId: number) {
  const token = await getAuthToken(page);
  const res = await page.request.delete(`${BASE}/api/users/${userId}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  const status = res.status();
  const body = await res.json().catch(() => null);
  if (status >= 400) throw new Error(`deleteUser failed ${status} ${JSON.stringify(body)}`);
  return body;
}

export async function setUserRoleViaApi(page: Page, userId: number, role: string) {
  const token = await getAuthToken(page);
  const res = await page.request.post(`${BASE}/api/users/${userId}/set-role`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    data: { role },
  });
  const status = res.status();
  const body = await res.json().catch(() => null);
  if (status >= 400) throw new Error(`setUserRole failed ${status} ${JSON.stringify(body)}`);
  return body;
}

export async function forcePasswordResetViaApi(page: Page, userId: number) {
  const token = await getAuthToken(page);
  const res = await page.request.post(`${BASE}/api/users/${userId}/force-password-reset`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  const status = res.status();
  const body = await res.json().catch(() => null);
  if (status >= 400) throw new Error(`forcePasswordReset failed ${status} ${JSON.stringify(body)}`);
  return body;
}

export async function updateAdmissionStatusViaApi(page: Page, admissionId: number, statusValue: string, notes?: string) {
  const token = await getAuthToken(page);
  const res = await page.request.patch(`${BASE}/api/admissions/${admissionId}/status`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    data: { status: statusValue, notes },
  });
  const status = res.status();
  const body = await res.json().catch(() => null);
  if (status >= 400) throw new Error(`updateAdmissionStatus failed ${status} ${JSON.stringify(body)}`);
  return body;
}

export async function handoffAdmissionViaApi(page: Page, admissionId: number) {
  const token = await getAuthToken(page);
  const res = await page.request.post(`${BASE}/api/admissions/${admissionId}/handoff`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    data: {},
  });
  const status = res.status();
  const body = await res.json().catch(() => null);
  if (status >= 400) throw new Error(`handoffAdmission failed ${status} ${JSON.stringify(body)}`);
  return body;
}

export default {};
