import { uid } from '../../../utils/helpers';
import type { ParsedQuestion } from './types';

function parseQuestionType(raw: unknown): ParsedQuestion['questionType'] | null {
  const type = String(raw || '').trim().toLowerCase();
  if (type === 'mc' || type === 'multiple choice' || type === 'multiple_choice') return 'mc';
  if (type === 'essay') return 'essay';
  if (type === 'identification' || type === 'id') return 'identification';
  if (type === 'true_false' || type === 'truefalse' || type === 'true/false' || type === 'true false' || type === 'tf') return 'true_false';
  return null;
}

function parseCorrectIndex(raw: unknown): number {
  const correctRaw = String(raw || '').trim().toUpperCase();
  return correctRaw === 'A' ? 0 : correctRaw === 'B' ? 1 : correctRaw === 'C' ? 2 : correctRaw === 'D' ? 3 : correctRaw === '1' ? 0 : correctRaw === '2' ? 1 : correctRaw === '3' ? 2 : correctRaw === '4' ? 3 : 0;
}

function parseTrueFalseCorrect(raw: unknown): 'true' | 'false' {
  const token = String(raw || '').trim().toLowerCase();
  if (['false', 'f', 'no', 'n', '0', 'b', '2'].includes(token)) return 'false';
  return 'true';
}

function normalizeMatchMode(raw: unknown): 'exact' | 'partial' {
  return String(raw || '').trim().toLowerCase() === 'partial' ? 'partial' : 'exact';
}

function trueFalseChoices(correct: 'true' | 'false') {
  return [
    { id: uid(), choiceText: 'True', isCorrect: correct === 'true' },
    { id: uid(), choiceText: 'False', isCorrect: correct === 'false' },
  ];
}

export function parseCSVQuestions(text: string): { parsed: ParsedQuestion[]; errs: number } {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.toLowerCase().startsWith('type'));
  const parsed: ParsedQuestion[] = [];
  let errs = 0;
  for (const line of lines) {
    const cols: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());

    const type = parseQuestionType(cols[0]);
    const qText = cols[1] || '';
    const pts = parseInt(cols[2]) || 1;
    const matchMode = normalizeMatchMode(cols[8]);

    if (!qText || !type) { errs++; continue; }

    if (type === 'essay') {
      parsed.push({ id: uid(), questionText: qText, questionType: 'essay', points: pts, orderNum: parsed.length + 1, choices: [] });
    } else if (type === 'identification') {
      const answer = String(cols[7] || '').trim();
      if (!answer) { errs++; continue; }
      parsed.push({ id: uid(), questionText: qText, questionType: 'identification', points: pts, orderNum: parsed.length + 1, choices: [], identificationAnswer: answer, identificationMatchMode: matchMode });
    } else if (type === 'true_false') {
      const correct = parseTrueFalseCorrect(cols[7]);
      parsed.push({
        id: uid(),
        questionText: qText,
        questionType: 'true_false',
        points: pts,
        orderNum: parsed.length + 1,
        choices: trueFalseChoices(correct),
      });
    } else if (type === 'mc') {
      const choiceTexts = [cols[3], cols[4], cols[5], cols[6]].filter(Boolean);
      const correctIdx = parseCorrectIndex(cols[7]);
      if (choiceTexts.length < 2) { errs++; continue; }
      parsed.push({
        id: uid(),
        questionText: qText,
        questionType: 'mc',
        points: pts,
        orderNum: parsed.length + 1,
        choices: choiceTexts.map((t, i) => ({ id: uid(), choiceText: t, isCorrect: i === correctIdx })),
      });
    } else { errs++; }
  }
  return { parsed, errs };
}

export function parseJSONQuestions(text: string): { parsed: ParsedQuestion[]; errs: number } {
  const raw = JSON.parse(text);
  const items: any[] = Array.isArray(raw) ? raw : raw.questions || [];
  const parsed: ParsedQuestion[] = [];
  let errs = 0;
  for (const item of items) {
    const type = parseQuestionType(item.type || item.questionType);
    const qText = item.question || item.questionText || '';
    const pts = parseInt(item.points) || 1;
    if (!qText || !type) { errs++; continue; }
    if (type === 'essay') {
      parsed.push({ id: uid(), questionText: qText, questionType: 'essay', points: pts, orderNum: parsed.length + 1, choices: [] });
    } else if (type === 'identification') {
      const answer = String(item.answer ?? item.correct ?? item.identificationAnswer ?? '').trim();
      if (!answer) { errs++; continue; }
      parsed.push({
        id: uid(),
        questionText: qText,
        questionType: 'identification',
        points: pts,
        orderNum: parsed.length + 1,
        choices: [],
        identificationAnswer: answer,
        identificationMatchMode: normalizeMatchMode(item.matchMode ?? item.identificationMatchMode),
      });
    } else if (type === 'true_false') {
      const correct = parseTrueFalseCorrect(item.correct ?? item.answer);
      parsed.push({
        id: uid(),
        questionText: qText,
        questionType: 'true_false',
        points: pts,
        orderNum: parsed.length + 1,
        choices: trueFalseChoices(correct),
      });
    } else if (type === 'mc') {
      const rawChoices: any[] = item.choices || item.options || [];
      if (rawChoices.length < 2) { errs++; continue; }
      const correctVal = item.correct ?? item.answer ?? 0;
      const choices = rawChoices.map((c: any, i: number) => {
        const text = typeof c === 'string' ? c : (c.text || c.choiceText || '');
        const isCorrect = typeof c === 'object' ? !!c.isCorrect : (typeof correctVal === 'number' ? i === correctVal : String(correctVal).toUpperCase() === String.fromCharCode(65 + i));
        return { id: uid(), choiceText: text, isCorrect };
      });
      parsed.push({ id: uid(), questionText: qText, questionType: 'mc', points: pts, orderNum: parsed.length + 1, choices });
    } else { errs++; }
  }
  return { parsed, errs };
}

export function downloadTemplate(format: 'csv' | 'json') {
  if (format === 'csv') {
    const content = [
      'type,question,points,choiceA,choiceB,choiceC,choiceD,correct,matchMode',
      'mc,What is the capital of the Philippines?,2,Cebu,Manila,Davao,Quezon City,B,',
      'true_false,The Pacific Ocean is the largest ocean.,1,True,False,,,True,',
      'identification,What planet is known as the Red Planet?,2,,,,,Mars,exact',
      'mc,What is 15 x 8?,2,110,120,132,140,C,',
      'essay,Explain why education is important in society.,5,,,,,,',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'exam_template.csv'; a.click();
    URL.revokeObjectURL(url);
  } else if (format === 'json') {
    const content = JSON.stringify([
      { type: 'mc', question: 'What is the capital of the Philippines?', points: 2, choices: ['Cebu', 'Manila', 'Davao', 'Quezon City'], correct: 1 },
      { type: 'true_false', question: 'The Pacific Ocean is the largest ocean.', points: 1, correct: true },
      { type: 'identification', question: 'What planet is known as the Red Planet?', points: 2, answer: 'Mars', matchMode: 'exact' },
      { type: 'mc', question: 'Which planet is known as the Red Planet?', points: 3, choices: [{ text: 'Venus', isCorrect: false }, { text: 'Jupiter', isCorrect: false }, { text: 'Mars', isCorrect: true }, { text: 'Saturn', isCorrect: false }] },
      { type: 'mc', question: 'What is 15 × 8?', points: 2, choices: ['110', '120', '132', '140'], correct: 2 },
      { type: 'essay', question: 'Explain why education is important in society.', points: 5 },
    ], null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'exam_template.json'; a.click();
    URL.revokeObjectURL(url);
  }
}
