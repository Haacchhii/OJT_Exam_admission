import { client } from './client.js';

export const getAcademicYears = () => client.get('/academic-years');
export const getActivePeriod = () => client.get('/academic-years/active');
export const getSemesters = (yearId) =>
  client.get('/academic-years/semesters' + (yearId ? `?yearId=${yearId}` : ''));

export const createAcademicYear = (data) => client.post('/academic-years', data);
export const updateAcademicYear = (id, data) => client.put(`/academic-years/${id}`, data);
export const deleteAcademicYear = (id) => client.delete(`/academic-years/${id}`);

export const createSemester = (data) => client.post('/academic-years/semesters', data);
export const updateSemester = (id, data) => client.put(`/academic-years/semesters/${id}`, data);
export const deleteSemester = (id) => client.delete(`/academic-years/semesters/${id}`);
