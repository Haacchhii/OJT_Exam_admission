
const fs = require('fs');
let c = fs.readFileSync('src/pages/employee/exams/ExamsList.tsx', 'utf8');

const newCode = "  const handleBulkImportExams = async (data: any[]) => {
    let successCount = 0;
    setSaving(true);
    try {
      for (const row of data) {
        try {
          const questions = [];
          for (let i = 1; i <= 200; i++) {
            const qtext = row['q' + i + '_text'];
            if (!qtext) continue;
            
            const qType = row['q' + i + '_type'] || 'mc';
            const qPoints = parseInt(row['q' + i + '_points']) || 1;
            
            const choices = [];
            const correctAns = (row['q' + i + '_ans'] || 'a').toLowerCase();
            const optionMap = ['a', 'b', 'c', 'd'];
            
            for (let j = 0; j < 4; j++) {
              const choiceText = row['q' + i + '_' + optionMap[j]];
              if (choiceText) {
                choices.push({
                  choiceText,
                  isCorrect: correctAns === optionMap[j],
                  orderNum: j + 1
                });
              }
            }
            
            questions.push({
              questionText: qtext,
              questionType: qType,
              points: qPoints,
              orderNum: questions.length + 1,
              choices
            });
          }

          await addExam({
            title: row.title || 'Untitled Exam',
            gradeLevel: row.gradeLevel || 'Grade 10',
            durationMinutes: parseInt(row.durationMinutes) || 60,
            passingScore: parseInt(row.passingScore) || 50,
            isActive: row.isActive === 'true' || row.isActive === '1' || row.isActive?.toLowerCase() === 'yes',
            questions
          });
          successCount++;
        } catch (e) {}
      }
      showToast('Successfully imported ' + successCount + ' exams!', 'success');
      refetch();
    } finally {
      setSaving(false);
    }
  };\n;

const parts = c.split('const handleBulkImportExams = async (data: any[]) => {');
if (parts.length > 1) {
  const rest = parts[1].split('const handleBulkDelete = async () => {');
  if(rest.length > 1) {
    c = parts[0] + newCode + '  const handleBulkDelete = async () => {' + rest[1];
    fs.writeFileSync('src/pages/employee/exams/ExamsList.tsx', c);
    console.log('updated');
  }
}

