const fs = require('fs');

const data = JSON.parse(fs.readFileSync('../backend/prisma/exam-templates.json', 'utf8'));

// We want one file per grade!
fs.mkdirSync('../frontend-ts/public/templates', {recursive: true});

data.forEach(exam => {
  const headers = ['title', 'gradeLevel', 'durationMinutes', 'passingScore', 'isActive'];
  for(let i=1; i<=41; i++) {
    headers.push(
      'q' + i + '_text',
      'q' + i + '_type',
      'q' + i + '_points',
      'q' + i + '_a',
      'q' + i + '_b',
      'q' + i + '_c',
      'q' + i + '_d',
      'q' + i + '_ans'
    );
  }

  const row = [
    exam.title,
    exam.gradeLevel, 
    exam.durationMinutes, 
    exam.passingScore, 
    exam.isActive ? 'yes' : 'no'
  ];

  exam.questions.forEach((q, i) => {
    row.push(
      q.questionText || '', 
      q.questionType || 'mc', 
      q.points || 1
    );
    const choices = q.choices || [];
    row.push(
      choices[0]?.choiceText || '', 
      choices[1]?.choiceText || '', 
      choices[2]?.choiceText || '', 
      choices[3]?.choiceText || ''
    );
    const ansIndex = choices.findIndex(c => c.isCorrect);
    row.push(ansIndex >= 0 ? ['a','b','c','d'][ansIndex] : 'a');
  });

  const csv = headers.join(',') + '\n' + 
              row.map(c => typeof c === 'string' ? '"' + c.replace(/"/g, '""') + '"' : c).join(',');

  const filename = 'Template_' + exam.gradeLevel.replace(/\s+/g, '_') + '_Exam.csv';
  fs.writeFileSync('../frontend-ts/public/templates/' + filename, csv);
});

console.log('Templates generated.');
