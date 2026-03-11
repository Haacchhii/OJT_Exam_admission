import * as XLSX from 'xlsx';
import { uid } from '../../../utils/helpers';
import type { ParsedQuestion } from './types';

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

    const type = (cols[0] || '').toLowerCase();
    const qText = cols[1] || '';
    const pts = parseInt(cols[2]) || 1;

    if (!qText) { errs++; continue; }

    if (type === 'essay') {
      parsed.push({ id: uid(), questionText: qText, questionType: 'essay', points: pts, orderNum: parsed.length + 1, choices: [] });
    } else if (type === 'mc' || type === 'multiple choice' || type === 'multiple_choice') {
      const choiceTexts = [cols[3], cols[4], cols[5], cols[6]].filter(Boolean);
      const correctRaw = (cols[7] || '').toUpperCase();
      const correctIdx = correctRaw === 'A' ? 0 : correctRaw === 'B' ? 1 : correctRaw === 'C' ? 2 : correctRaw === 'D' ? 3 : correctRaw === '1' ? 0 : correctRaw === '2' ? 1 : correctRaw === '3' ? 2 : correctRaw === '4' ? 3 : 0;
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
    const type = (item.type || item.questionType || '').toLowerCase();
    const qText = item.question || item.questionText || '';
    const pts = parseInt(item.points) || 1;
    if (!qText) { errs++; continue; }
    if (type === 'essay') {
      parsed.push({ id: uid(), questionText: qText, questionType: 'essay', points: pts, orderNum: parsed.length + 1, choices: [] });
    } else if (type === 'mc' || type === 'multiple choice' || type === 'multiple_choice') {
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

export function parseExcelQuestions(arrayBuffer: ArrayBuffer): { parsed: ParsedQuestion[]; errs: number } {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  const dataRows = rows.slice(1).filter((r: any[]) => r.some((c: any) => String(c).trim()));
  const parsed: ParsedQuestion[] = [];
  let errs = 0;
  for (const cols of dataRows) {
    const type = String(cols[0] || '').trim().toLowerCase();
    const qText = String(cols[1] || '').trim();
    const pts = parseInt(cols[2]) || 1;
    if (!qText) { errs++; continue; }
    if (type === 'essay') {
      parsed.push({ id: uid(), questionText: qText, questionType: 'essay', points: pts, orderNum: parsed.length + 1, choices: [] });
    } else if (type === 'mc' || type === 'multiple choice' || type === 'multiple_choice') {
      const choiceTexts = [cols[3], cols[4], cols[5], cols[6]].map((c: any) => String(c || '').trim()).filter(Boolean);
      const correctRaw = String(cols[7] || '').trim().toUpperCase();
      const correctIdx = correctRaw === 'A' ? 0 : correctRaw === 'B' ? 1 : correctRaw === 'C' ? 2 : correctRaw === 'D' ? 3 :
                         correctRaw === '1' ? 0 : correctRaw === '2' ? 1 : correctRaw === '3' ? 2 : correctRaw === '4' ? 3 : 0;
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

export function downloadTemplate(format: 'csv' | 'json' | 'excel') {
  if (format === 'csv') {
    const content = [
      'type,question,points,choiceA,choiceB,choiceC,choiceD,correct',
      'mc,What is the capital of the Philippines?,2,Cebu,Manila,Davao,Quezon City,B',
      'mc,"Which planet is known as the Red Planet?",3,Venus,Jupiter,Mars,Saturn,C',
      'mc,What is 15 × 8?,2,110,120,132,140,C',
      'essay,Explain why education is important in society.,5,,,,, ',
      'essay,"Describe the three branches of government and their roles.",10,,,,,',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'exam_template.csv'; a.click();
    URL.revokeObjectURL(url);
  } else if (format === 'json') {
    const content = JSON.stringify([
      { type: 'mc', question: 'What is the capital of the Philippines?', points: 2, choices: ['Cebu', 'Manila', 'Davao', 'Quezon City'], correct: 1 },
      { type: 'mc', question: 'Which planet is known as the Red Planet?', points: 3, choices: [{ text: 'Venus', isCorrect: false }, { text: 'Jupiter', isCorrect: false }, { text: 'Mars', isCorrect: true }, { text: 'Saturn', isCorrect: false }] },
      { type: 'mc', question: 'What is 15 × 8?', points: 2, choices: ['110', '120', '132', '140'], correct: 2 },
      { type: 'essay', question: 'Explain why education is important in society.', points: 5 },
      { type: 'essay', question: 'Describe the three branches of government and their roles.', points: 10 },
    ], null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'exam_template.json'; a.click();
    URL.revokeObjectURL(url);
  } else if (format === 'excel') {
    const rows = [
      ['type', 'question', 'points', 'choiceA', 'choiceB', 'choiceC', 'choiceD', 'correct'],
      ['mc', 'What is the capital of the Philippines?', 2, 'Cebu', 'Manila', 'Davao', 'Quezon City', 'B'],
      ['mc', 'Which planet is known as the Red Planet?', 3, 'Venus', 'Jupiter', 'Mars', 'Saturn', 'C'],
      ['mc', 'What is 15 × 8?', 2, '110', '120', '132', '140', 'C'],
      ['essay', 'Explain why education is important in society.', 5, '', '', '', '', ''],
      ['essay', 'Describe the three branches of government and their roles.', 10, '', '', '', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 55 }, { wch: 8 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 10 }];
    const noteRows = [
      ['INSTRUCTIONS'],
      ['Column', 'Description'],
      ['type', 'mc = Multiple Choice  |  essay = Essay'],
      ['question', 'The full question text'],
      ['points', 'Point value (number)'],
      ['choiceA–D', 'Answer options (MC only; leave blank for essay)'],
      ['correct', 'Correct answer: A, B, C, or D (MC only; leave blank for essay)'],
      [''],
      ['NOTES'],
      ['- You may add or remove rows freely.'],
      ['- Do NOT change column headers in row 1 of the Questions sheet.'],
      ['- For essay questions, leave choiceA–D and correct columns blank.'],
      ['- The "correct" column accepts A/B/C/D or 1/2/3/4 (1-indexed).'],
    ];
    const wsNotes = XLSX.utils.aoa_to_sheet(noteRows);
    wsNotes['!cols'] = [{ wch: 18 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');
    XLSX.utils.book_append_sheet(wb, wsNotes, 'Instructions');
    XLSX.writeFile(wb, 'exam_template.xlsx');
  }
}
