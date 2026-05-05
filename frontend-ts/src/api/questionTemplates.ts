import { client } from './client';
import type { ExamQuestion, QuestionChoice } from '../types';

export interface QuestionTemplate extends Omit<ExamQuestion, 'examId' | 'orderNum' | 'identificationAnswer' | 'identificationMatchMode'> {
  id: number;
  title: string;
  description?: string;
  isPublic: boolean;
  createdAt: string;
  choices: QuestionChoice[];
}

/**
 * Fetch all question templates created by current teacher
 */
export const getQuestionTemplates = async (): Promise<QuestionTemplate[]> => {
  return client.get<QuestionTemplate[]>('/question-templates');
};

/**
 * Save a question as a reusable template
 */
export const saveQuestionTemplate = async (
  title: string,
  questionText: string,
  questionType: string,
  points: number,
  choices: QuestionChoice[],
  identificationAnswer?: string,
  identificationMatchMode?: string,
  description?: string
): Promise<QuestionTemplate> => {
  return client.post<QuestionTemplate>('/question-templates', {
    title,
    questionText,
    questionType,
    points,
    choices,
    identificationAnswer,
    identificationMatchMode,
    description,
  });
};

/**
 * Delete a question template
 */
export const deleteQuestionTemplate = async (templateId: number): Promise<{ success: boolean; message: string }> => {
  return client.delete<{ success: boolean; message: string }>(`/question-templates/${templateId}`);
};
