const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'entrance-exam-templates-grade7-12-40q.json');
const outputDir = path.join(__dirname, 'entrance-exam-csv');

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsvLine(values) {
  return values.map(csvEscape).join(',');
}

function parseQuestionText(rawText) {
  const match = /^\[([^\]]+)\]\s*(.*)$/.exec(String(rawText || ''));
  if (!match) return String(rawText || '').trim();
  return String(match[2] || '').trim() || String(match[1] || '').trim();
}

function parseExamGrade(gradeLevel) {
  const match = /\d+/.exec(String(gradeLevel || ''));
  return match ? Number(match[0]) : null;
}

function getCorrectLetter(choices) {
  const index = choices.findIndex((choice) => choice && choice.isCorrect);
  if (index < 0 || index > 3) return 'A';
  return String.fromCharCode(65 + index);
}

function buildQuestionRow(question) {
  if (question.questionType === 'essay') {
    return toCsvLine(['essay', parseQuestionText(question.questionText), question.points || 1, '', '', '', '', '', '']);
  }

  if (question.questionType === 'true_false') {
    const choices = question.choices || [];
    const correct = choices.find((choice) => choice && choice.isCorrect)?.choiceText || 'True';
    return toCsvLine(['true_false', parseQuestionText(question.questionText), question.points || 1, 'True', 'False', '', '', correct, '']);
  }

  if (question.questionType === 'identification') {
    return toCsvLine([
      'identification',
      parseQuestionText(question.questionText),
      question.points || 1,
      '',
      '',
      '',
      '',
      String(question.identificationAnswer || '').trim(),
      String(question.identificationMatchMode || 'exact').trim() || 'exact',
    ]);
  }

  const choices = (question.choices || []).slice(0, 4);
  const choiceTexts = [0, 1, 2, 3].map((idx) => choices[idx]?.choiceText || '');

  return toCsvLine([
    'mc',
    parseQuestionText(question.questionText),
    question.points || 1,
    choiceTexts[0],
    choiceTexts[1],
    choiceTexts[2],
    choiceTexts[3],
    getCorrectLetter(choices),
    '',
  ]);
}

function buildExamCsv(exam) {
  const lines = [];
  lines.push('type,question,points,choiceA,choiceB,choiceC,choiceD,correct,matchMode');

  const questions = exam.questions || [];
  for (const question of questions) {
    lines.push(buildQuestionRow(question));
  }

  return lines.join('\n');
}

function main() {
  const exams = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const gradeExams = exams
    .filter((exam) => {
      const grade = parseExamGrade(exam.gradeLevel);
      return grade !== null && grade >= 7 && grade <= 12;
    })
    .sort((a, b) => parseExamGrade(a.gradeLevel) - parseExamGrade(b.gradeLevel));

  fs.mkdirSync(outputDir, { recursive: true });

  for (const exam of gradeExams) {
    const fileName = `${exam.gradeLevel.replace(/\s+/g, '_')}_Entrance_Exam.csv`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, buildExamCsv(exam), 'utf8');
  }

  console.log(`Created ${gradeExams.length} CSV files in ${outputDir}`);
}

main();