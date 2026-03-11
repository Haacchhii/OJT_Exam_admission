export interface ParsedQuestion {
  id: string;
  questionText: string;
  questionType: 'mc' | 'essay';
  points: number;
  orderNum: number;
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
