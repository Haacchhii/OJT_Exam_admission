import { load, save } from '../data/store.js';
import { USE_API, client } from './client.js';

export async function getUsers() {
  if (USE_API) return client.get('/users');
  return load().users;
}
export async function getUser(id) {
  if (USE_API) return client.get(`/users/${id}`);
  return load().users.find(u => u.id === id) || null;
}
export async function getUserByEmail(email) {
  if (USE_API) return client.get(`/users/by-email/${encodeURIComponent(email)}`);
  return load().users.find(u => u.email === email) || null;
}

export async function addUser(user) {
  if (USE_API) return client.post('/users', user);
  const data = load();
  // Check email uniqueness
  if (user.email && data.users.some(u => u.email === user.email)) {
    return { error: 'A user with this email already exists.' };
  }
  user.id = data.nextUserId++;
  user.isActive = user.status !== 'Inactive';
  user.status = user.status || 'Active';
  user.createdAt = new Date().toISOString();
  data.users.push(user);
  save(data);
  return user;
}

export async function updateUser(id, updates) {
  if (USE_API) return client.put(`/users/${id}`, updates);
  const data = load();
  const user = data.users.find(u => u.id === id);
  if (user) { Object.assign(user, updates); save(data); }
  return user;
}

export async function deleteUser(id) {
  if (USE_API) return client.delete(`/users/${id}`);
  const data = load();
  const user = data.users.find(u => u.id === id);
  if (user) {
    const email = user.email;
    // Cascade: remove admissions
    data.admissions = data.admissions.filter(a => a.email !== email);
    // Cascade: remove exam registrations, results, essays, answers
    const regIds = data.examRegistrations.filter(r => r.userEmail === email).map(r => r.id);
    data.examResults = data.examResults.filter(r => !regIds.includes(r.registrationId));
    data.essayAnswers = data.essayAnswers.filter(a => !regIds.includes(a.registrationId));
    data.submittedAnswers = data.submittedAnswers.filter(a => !regIds.includes(a.registrationId));
    data.examRegistrations = data.examRegistrations.filter(r => r.userEmail !== email);
    // Cascade: remove notifications
    data.notifications = data.notifications.filter(n => n.userId !== `student_${id}` && n.userId !== `employee_${id}`);
    // Remove user
    data.users = data.users.filter(u => u.id !== id);
    save(data);
  }
}
