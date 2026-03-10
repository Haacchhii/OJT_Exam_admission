import { client } from './client';
import type { AcademicYear, Semester } from '../types';

export const getAcademicYears = () => client.get<AcademicYear[]>('/academic-years');
export const getActivePeriod = () => client.get<{ academicYear: AcademicYear; semester: Semester }>('/academic-years/active');
export const getSemesters = (yearId?: number) =>
  client.get<Semester[]>('/academic-years/semesters' + (yearId ? `?yearId=${yearId}` : ''));

export const createAcademicYear = (data: Partial<AcademicYear>) => client.post<AcademicYear>('/academic-years', data);
export const updateAcademicYear = (id: number, data: Partial<AcademicYear>) => client.put<AcademicYear>(`/academic-years/${id}`, data);
export const deleteAcademicYear = (id: number) => client.delete<void>(`/academic-years/${id}`);

export const createSemester = (data: Partial<Semester>) => client.post<Semester>('/academic-years/semesters', data);
export const updateSemester = (id: number, data: Partial<Semester>) => client.put<Semester>(`/academic-years/semesters/${id}`, data);
export const deleteSemester = (id: number) => client.delete<void>(`/academic-years/semesters/${id}`);
