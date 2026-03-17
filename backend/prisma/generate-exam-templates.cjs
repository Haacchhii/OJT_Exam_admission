const fs = require('fs');

const grades = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
];

const subjects = ['Mathematics', 'Science', 'English', 'General Knowledge'];

function getQuestionForGrade(gradeIndex, subject, itemNumber) {
  // gradeIndex goes 0 to 11
  const level = gradeIndex + 1;
  let qText = '';
  let choices = [];
  
  if (subject === 'Mathematics') {
    if (level <= 3) {
      const a = Math.floor(Math.random() * (level * 5)) + 1;
      const b = Math.floor(Math.random() * (level * 5)) + 1;
      qText = `What is ${a} + ${b}?`;
      const ans = a + b;
      choices = [
        { choiceText: `${ans}`, isCorrect: true },
        { choiceText: `${ans + 1}`, isCorrect: false },
        { choiceText: `${ans - 1}`, isCorrect: false },
        { choiceText: `${ans + 2}`, isCorrect: false }
      ];
    } else if (level <= 6) {
      const a = Math.floor(Math.random() * 10) + 2;
      const b = Math.floor(Math.random() * 10) + 2;
      qText = `What is ${a} x ${b}?`;
      const ans = a * b;
      choices = [
        { choiceText: `${ans}`, isCorrect: true },
        { choiceText: `${ans + 10}`, isCorrect: false },
        { choiceText: `${ans - (a)}`, isCorrect: false },
        { choiceText: `${ans + 2}`, isCorrect: false }
      ];
    } else if (level <= 9) {
      const a = Math.floor(Math.random() * 5) + 2;
      const b = Math.floor(Math.random() * 10) + 10;
      qText = `Solve for x: ${a}x = ${a * b}`;
      choices = [
        { choiceText: `${b}`, isCorrect: true },
        { choiceText: `${b + 2}`, isCorrect: false },
        { choiceText: `${b - 2}`, isCorrect: false },
        { choiceText: `${b * 2}`, isCorrect: false }
      ];
    } else {
      qText = `Evaluate the limit: lim (x->0) (sin(${level}x) / x)`;
      choices = [
        { choiceText: `${level}`, isCorrect: true },
        { choiceText: `0`, isCorrect: false },
        { choiceText: `1`, isCorrect: false },
        { choiceText: `Infinity`, isCorrect: false }
      ];
    }
  } else if (subject === 'Science') {
    if (level <= 3) {
      qText = `Which of these is ${['an animal', 'a plant', 'a color', 'a planet'][itemNumber % 4]}?`;
    } else if (level <= 6) {
      qText = `What is the primary function of ${['the heart', 'leaves', 'gravity', 'the lungs'][itemNumber % 4]}?`;
    } else if (level <= 9) {
      qText = `What is the atomic number of ${['Oxygen', 'Carbon', 'Hydrogen', 'Helium'][itemNumber % 4]}?`;
    } else {
      qText = `Explain the mechanism behind ${['cellular respiration', 'photosynthesis', 'mitosis', 'meiosis'][itemNumber % 4]} in biological systems.`;
    }
    choices = [
       { choiceText: `Correct Fact`, isCorrect: true },
       { choiceText: `Incorrect Fact A`, isCorrect: false },
       { choiceText: `Incorrect Fact B`, isCorrect: false },
       { choiceText: `Doesn't make sense`, isCorrect: false }
    ];
  } else if (subject === 'English') {
    if (level <= 4) {
      qText = `Which word is a noun in this sentence: "The fast dog ran."?`;
      choices = [
         { choiceText: `dog`, isCorrect: true },
         { choiceText: `fast`, isCorrect: false },
         { choiceText: `ran`, isCorrect: false },
         { choiceText: `The`, isCorrect: false }
      ];
    } else if (level <= 8) {
      qText = `Identify the correct synonym for "Benevolent".`;
      choices = [
         { choiceText: `Kind`, isCorrect: true },
         { choiceText: `Cruel`, isCorrect: false },
         { choiceText: `Angry`, isCorrect: false },
         { choiceText: `Fast`, isCorrect: false }
      ];
    } else {
      qText = `Which literary device is used in the phrase: "The world is a stage"?`;
      choices = [
         { choiceText: `Metaphor`, isCorrect: true },
         { choiceText: `Simile`, isCorrect: false },
         { choiceText: `Personification`, isCorrect: false },
         { choiceText: `Hyperbole`, isCorrect: false }
      ];
    }
  } else {
    qText = `Grade ${level} Logic/Analogy: Find the missing pattern for sequence #${itemNumber}.`;
    choices = [
       { choiceText: `Correct Pattern`, isCorrect: true },
       { choiceText: `Pattern A`, isCorrect: false },
       { choiceText: `Pattern B`, isCorrect: false },
       { choiceText: `Pattern C`, isCorrect: false }
    ];
  }

  choices = choices.sort(() => Math.random() - 0.5);
  return { qText, choices };
}

function getEssayForGrade(gradeIndex) {
  const level = gradeIndex + 1;
  if (level <= 3) return `Write 3 to 5 sentences describing your favorite animal. Why do you like it, and where does it live?`;
  if (level <= 6) return `Write a short paragraph about the water cycle. Why is water important for the Earth?`;
  if (level <= 9) return `Discuss a major historical event that shaped our country. Provide at least three supporting arguments on its impact.`;
  return `Write a comprehensive essay analyzing the impact of Artificial Intelligence on modern society. Include ethical, economic, and social perspectives, and provide specific examples.`;
}

const allExams = [];

grades.forEach((grade, index) => {
  const exam = {
    title: `${grade} Placement & Admission Exam`,
    gradeLevel: grade,
    durationMinutes: 120,
    passingScore: 60,
    isActive: true,
    questions: []
  };

  let orderNum = 1;

  for (let i = 0; i < 40; i++) {
    const subject = subjects[i % subjects.length];
    const qData = getQuestionForGrade(index, subject, i + 1);
    
    exam.questions.push({
      questionText: `[${subject}] ${qData.qText}`,
      questionType: 'mc',
      points: 1,
      orderNum: orderNum++,
      choices: qData.choices.map((c, i) => ({ ...c, orderNum: i + 1 }))
    });
  }

  // 1 essay question
  exam.questions.push({
    questionText: `[Essay] ${getEssayForGrade(index)}`,
    questionType: 'essay',
    points: 10,
    orderNum: orderNum++,
    choices: [] 
  });

  allExams.push(exam);
});

fs.writeFileSync('prisma/exam-templates.json', JSON.stringify(allExams, null, 2));
console.log(`Successfully generated ${allExams.length} exams. Each has 40 MCQs and 1 Essay.`);
