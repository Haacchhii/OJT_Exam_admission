// ============================================
// store.js — localStorage persistence layer
// ============================================
import { defaultData } from './seed-data.js';

const STORAGE_KEY = 'goldenkey_data';

// In-memory cache to prevent race conditions from concurrent load()+save()
let _cache = null;

export function load() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // backward compat
      if (!data.exams) data.exams = JSON.parse(JSON.stringify(defaultData.exams));
      if (!data.examSchedules) data.examSchedules = JSON.parse(JSON.stringify(defaultData.examSchedules));
      if (!data.examRegistrations) data.examRegistrations = JSON.parse(JSON.stringify(defaultData.examRegistrations));
      if (!data.examResults) data.examResults = JSON.parse(JSON.stringify(defaultData.examResults));
      if (!data.essayAnswers) data.essayAnswers = JSON.parse(JSON.stringify(defaultData.essayAnswers));
      if (!data.notifications) data.notifications = JSON.parse(JSON.stringify(defaultData.notifications));
      if (!data.users) data.users = JSON.parse(JSON.stringify(defaultData.users));
      if (!data.submittedAnswers) data.submittedAnswers = JSON.parse(JSON.stringify(defaultData.submittedAnswers));
      // Migrate old admission statuses to current admission workflow
      if (data.admissions) {
        const statusMap = { 'Pending': 'Submitted', 'Approved': 'Accepted', 'Enrolled': 'Accepted', 'Pending Payment': 'Under Screening' };
        let migrated = false;
        data.admissions.forEach(a => {
          if (statusMap[a.status]) { a.status = statusMap[a.status]; migrated = true; }
          if (!a.applicantType) { a.applicantType = a.enrollmentType || 'New'; delete a.enrollmentType; migrated = true; }
          if (a.enrollmentType) { a.applicantType = a.enrollmentType; delete a.enrollmentType; migrated = true; }
        });
        if (migrated) save(data);
      }
      _cache = data;
      return data;
    }
  } catch (e) {
    console.warn('Failed to load data, using defaults', e);
  }
  _cache = JSON.parse(JSON.stringify(defaultData));
  return _cache;
}

export function save(data) {
  _cache = data;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      console.error('localStorage quota exceeded. Data saved to memory only.');
    } else {
      throw e;
    }
  }
}

export function resetData() {
  _cache = null;
  localStorage.removeItem('gk_current_user');
  save(JSON.parse(JSON.stringify(defaultData)));
}
