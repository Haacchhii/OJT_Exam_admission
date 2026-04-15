export interface ParsedQuestion {
  id: string;
  questionText: string;
  questionType: 'mc' | 'essay' | 'identification' | 'true_false';
  points: number;
  orderNum: number;
  identificationAnswer?: string;
  identificationMatchMode?: 'exact' | 'partial';
  choices: { id: string; choiceText: string; isCorrect: boolean }[];
}

export interface UploadPreview {
  parsed: ParsedQuestion[];
  errs: number;
  fileName: string;
}

export interface ChoiceState {
  text: string;
  correct?: boolean;
}
