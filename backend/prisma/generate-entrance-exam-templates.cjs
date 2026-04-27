const fs = require('fs');
const path = require('path');

const outputJsonPath = path.join(__dirname, 'entrance-exam-templates-grade7-12-40q.json');
const outputCsvDir = path.join(__dirname, 'entrance-exam-csv');

const gradeProfiles = [
  { gradeLevel: 'Grade 7', band: 'jhs' },
  { gradeLevel: 'Grade 8', band: 'jhs' },
  { gradeLevel: 'Grade 9', band: 'jhs' },
  { gradeLevel: 'Grade 10', band: 'jhs' },
  { gradeLevel: 'Grade 11 — ABM', band: 'shs', strand: 'ABM' },
  { gradeLevel: 'Grade 11 — STEM', band: 'shs', strand: 'STEM' },
  { gradeLevel: 'Grade 11 — HUMSS', band: 'shs', strand: 'HUMSS' },
  { gradeLevel: 'Grade 12 — ABM', band: 'shs', strand: 'ABM' },
  { gradeLevel: 'Grade 12 — STEM', band: 'shs', strand: 'STEM' },
  { gradeLevel: 'Grade 12 — HUMSS', band: 'shs', strand: 'HUMSS' },
];

function q(text, choices, correctIndex, points = 1) {
  return { text, choices, correctIndex, points };
}

const banks = {
  jhs: {
    math: [
      q('What is 3/4 + 1/8?', ['7/8', '1/2', '5/8', '3/8'], 0),
      q('Solve: 5x - 7 = 18', ['x = 5', 'x = 4', 'x = 3', 'x = 6'], 0),
      q('What is 15% of 240?', ['24', '30', '36', '40'], 2),
      q('Simplify: (2^3)(2^4)', ['2^7', '2^12', '2^1', '2^8'], 0),
      q('A triangle has angles 35° and 65°. What is the third angle?', ['80°', '85°', '90°', '70°'], 0),
      q('What is the slope of the line through (2,3) and (6,11)?', ['1', '2', '3', '4'], 1),
      q('Which is equivalent to 0.375?', ['3/5', '3/8', '5/8', '7/8'], 1),
      q('If a = 4 and b = 9, what is sqrt(a+b)?', ['sqrt(13)', '3', '4', '5'], 0),
      q('What is the median of 4, 9, 2, 7, 6?', ['6', '5', '7', '4'], 0),
      q('Solve: |x - 5| = 3', ['x = 8 or x = 2', 'x = 3 or x = -3', 'x = 5 only', 'x = -8 or x = -2'], 0),
      q('Factor: x^2 - 9', ['(x-9)(x+1)', '(x-3)(x+3)', '(x-1)(x-9)', '(x+9)(x+1)'], 1),
      q('What is the circumference of a circle with radius 7? (Use pi=22/7)', ['22', '44', '49', '154'], 1),
    ],
    science: [
      q('Which organelle is known as the “powerhouse of the cell”?', ['Nucleus', 'Mitochondrion', 'Ribosome', 'Lysosome'], 1),
      q('What is the chemical symbol for sodium?', ['Na', 'S', 'So', 'Sn'], 0),
      q('Which layer of Earth is liquid and made mostly of iron and nickel?', ['Inner core', 'Outer core', 'Mantle', 'Crust'], 1),
      q('What process do plants use to make food?', ['Respiration', 'Photosynthesis', 'Transpiration', 'Fermentation'], 1),
      q('Which type of energy is stored in food?', ['Kinetic', 'Electrical', 'Chemical', 'Nuclear'], 2),
      q('Which blood cells help fight infection?', ['Red blood cells', 'Platelets', 'White blood cells', 'Plasma'], 2),
      q('What is the unit of force?', ['Joule', 'Newton', 'Watt', 'Pascal'], 1),
      q('What happens to particles when a substance is heated?', ['They stop moving', 'They move faster', 'They disappear', 'They become heavier'], 1),
      q('Which is a renewable resource?', ['Coal', 'Natural gas', 'Wind', 'Petroleum'], 2),
      q('What is the pH of a neutral substance?', ['0', '5', '7', '14'], 2),
      q('Which part of the atom has a positive charge?', ['Electron', 'Proton', 'Neutron', 'Nucleus membrane'], 1),
      q('Which wave can travel through a vacuum?', ['Sound wave', 'Water wave', 'Light wave', 'Seismic wave'], 2),
    ],
    english: [
      q('Choose the sentence with correct subject-verb agreement.', ['The students studies every night.', 'The students study every night.', 'The students studying every night.', 'The students has studied every night.'], 1),
      q('What is the synonym of “generous”?', ['Selfish', 'Kind', 'Narrow', 'Harsh'], 1),
      q('Identify the adverb: “She sang beautifully.”', ['She', 'sang', 'beautifully', 'none'], 2),
      q('Which sentence is in passive voice?', ['The chef cooked the meal.', 'The meal was cooked by the chef.', 'The chef is cooking the meal.', 'The chef cooks daily.'], 1),
      q('What is the antonym of “ancient”?', ['Old', 'Modern', 'Historic', 'Past'], 1),
      q('Choose the correctly punctuated sentence.', ['After lunch we reviewed notes.', 'After lunch, we reviewed notes.', 'After lunch we, reviewed notes.', 'After lunch; we reviewed, notes.'], 1),
      q('What is the main idea of a paragraph?', ['A supporting detail', 'The central point', 'A transition word', 'The title only'], 1),
      q('Which word is a conjunction?', ['quickly', 'because', 'teacher', 'under'], 1),
      q('Which is an example of a metaphor?', ['She is as brave as a lion.', 'The classroom was a zoo.', 'He ran quickly like wind.', 'The sun is bright.'], 1),
      q('Choose the correct pronoun: “Maria and ____ went to the library.”', ['me', 'I', 'mine', 'myself'], 1),
      q('What is the purpose of a conclusion paragraph?', ['Introduce topic', 'Summarize key points', 'Add unrelated details', 'Define vocabulary only'], 1),
      q('Which transition word shows contrast?', ['Therefore', 'Similarly', 'However', 'Furthermore'], 2),
    ],
    logic: [
      q('If all roses are flowers and some flowers fade quickly, which is true?', ['All roses fade quickly', 'Some roses may fade quickly', 'No roses are flowers', 'Flowers are roses'], 1),
      q('Find the next number: 2, 6, 12, 20, ?', ['28', '30', '32', '36'], 1),
      q('Book is to Reading as Fork is to ____.', ['Cooking', 'Eating', 'Cutting', 'Plate'], 1),
      q('If MONDAY = 6, FRIDAY = ?', ['5', '6', '7', '8'], 1),
      q('Choose the odd one out.', ['Triangle', 'Square', 'Circle', 'Length'], 3),
      q('If A > B and B > C, then ____.', ['C > A', 'A > C', 'B < C', 'A = C'], 1),
      q('Find the missing letter: A, C, F, J, __', ['L', 'M', 'N', 'O'], 3),
      q('Which pair has the same relationship as “seed : plant”?', ['egg : bird', 'book : page', 'rain : cloud', 'desk : chair'], 0),
      q('A clock shows 3:00. What is the angle between the hands?', ['0°', '45°', '90°', '120°'], 2),
      q('Find the next term: AZ, BY, CX, __', ['DW', 'EV', 'DU', 'CV'], 0),
      q('If today is Wednesday, what day is 10 days from now?', ['Friday', 'Saturday', 'Sunday', 'Monday'], 1),
      q('If 1=3, 2=3, 3=5, 4=4, 5=4 then 6=?', ['3', '4', '5', '6'], 0),
    ],
  },
  shs: {
    math: [
      q('If f(x)=2x^2-3x+1, what is f(3)?', ['8', '10', '12', '14'], 1),
      q('Solve: log10(1000)', ['2', '3', '4', '10'], 1),
      q('What is the vertex of y = (x-2)^2 + 5?', ['(2,5)', '(-2,5)', '(2,-5)', '(5,2)'], 0),
      q('If sin(theta)=3/5 and theta is acute, cos(theta)=?', ['4/5', '5/4', '2/5', '3/4'], 0),
      q('What is the derivative of x^3?', ['x^2', '2x^2', '3x^2', '3x'], 2),
      q('Find the mean of 12, 15, 18, 21, 24.', ['16', '17', '18', '19'], 2),
      q('If the common ratio is 2 and first term is 3, what is the 4th term?', ['12', '18', '24', '48'], 2),
      q('What is the value of i^2?', ['-1', '0', '1', '2'], 0),
      q('A fair coin is tossed twice. Probability of exactly one head?', ['1/4', '1/2', '3/4', '1'], 1),
      q('Solve: 2^(x+1)=16', ['2', '3', '4', '5'], 1),
      q('What is the equation of a line with slope 3 passing through (0,-2)?', ['y=3x+2', 'y=3x-2', 'y=-3x-2', 'y=2x-3'], 1),
      q('Evaluate: (5!)/(3!)', ['10', '20', '30', '60'], 1),
    ],
    science: [
      q('Which biomolecule stores genetic information?', ['Protein', 'DNA', 'Lipid', 'Carbohydrate'], 1),
      q('What is the SI unit of electric current?', ['Volt', 'Watt', 'Ampere', 'Ohm'], 2),
      q('Which law states that matter cannot be created nor destroyed?', ['Law of inertia', 'Law of conservation of mass', 'Law of acceleration', 'Law of gravitation'], 1),
      q('What is the pH range of acids?', ['Below 7', 'Exactly 7', 'Above 7', 'Above 14'], 0),
      q('Which process forms ATP in mitochondria?', ['Glycolysis', 'Electron transport chain', 'Photosystem II', 'Fermentation only'], 1),
      q('What is the acceleration due to gravity near Earth’s surface?', ['4.9 m/s^2', '8.9 m/s^2', '9.8 m/s^2', '19.6 m/s^2'], 2),
      q('Which structure controls passage in and out of the cell?', ['Cell wall', 'Cell membrane', 'Nucleolus', 'Cytoplasm'], 1),
      q('What gas is most abundant in Earth’s atmosphere?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Argon'], 1),
      q('Which particle has no charge?', ['Electron', 'Proton', 'Neutron', 'Positron'], 2),
      q('What type of bond involves sharing electrons?', ['Ionic', 'Covalent', 'Metallic', 'Hydrogen'], 1),
      q('Which organ system transports nutrients and oxygen?', ['Respiratory', 'Digestive', 'Circulatory', 'Endocrine'], 2),
      q('What is the term for resistance to change in motion?', ['Velocity', 'Inertia', 'Momentum', 'Impulse'], 1),
    ],
    english: [
      q('Which thesis statement is strongest?', ['Pollution is bad.', 'Pollution has many effects.', 'Urban air pollution harms health, productivity, and school attendance, so cities need stricter emission controls.', 'People should care about pollution.'], 2),
      q('What is the purpose of a counterargument in persuasive writing?', ['To weaken your own claim', 'To show fairness and strengthen credibility', 'To replace your thesis', 'To avoid evidence'], 1),
      q('Which citation style commonly uses author-date in text?', ['MLA only', 'APA', 'Chicago Notes only', 'None'], 1),
      q('Choose the sentence with parallel structure.', ['She likes reading, to swim, and biking.', 'She likes reading, swimming, and biking.', 'She likes to read, swimming, and to bike.', 'She likes read, swim, and biking.'], 1),
      q('What does “tone” refer to in a text?', ['Plot sequence', 'Writer’s attitude toward subject/audience', 'Sentence length', 'Title format'], 1),
      q('Which is an example of an academic source?', ['Personal blog without references', 'Peer-reviewed journal article', 'Anonymous social media post', 'Entertainment magazine quiz'], 1),
      q('In argumentation, what is a “claim”?', ['A type of punctuation', 'The central position being defended', 'Any quotation', 'Background information only'], 1),
      q('Which revision improves clarity?', ['Use more vague words', 'Shorten and specify key terms', 'Remove transitions', 'Repeat every sentence'], 1),
      q('What is plagiarism?', ['Summarizing your own notes', 'Using others’ work without proper acknowledgment', 'Citing a source', 'Paraphrasing with citation'], 1),
      q('Which transition best signals cause and effect?', ['Meanwhile', 'For example', 'As a result', 'In contrast'], 2),
      q('What is “audience awareness”?', ['Ignoring reader needs', 'Matching language and evidence to intended readers', 'Using only complex terms', 'Avoiding examples'], 1),
      q('What should a conclusion do?', ['Introduce a brand-new claim only', 'Reinforce thesis and synthesize insights', 'Repeat the title only', 'Add unrelated facts'], 1),
    ],
    logic: [
      q('If some researchers are teachers and all teachers are communicators, which follows?', ['All researchers are communicators', 'Some researchers are communicators', 'No researchers are communicators', 'All communicators are teachers'], 1),
      q('Complete the sequence: 1, 4, 9, 16, 25, ?', ['30', '32', '36', '49'], 2),
      q('Data is to Analyst as Patient is to ____.', ['Hospital', 'Nurse', 'Doctor', 'Medicine'], 2),
      q('If TRUE = 64 and FALSE = 75 by letter count and position rule, what is logic score of “FACT”?', ['40', '42', '44', '46'], 2),
      q('Which argument is valid?', ['If it rains, roads are wet. Roads are wet, so it rained.', 'If it rains, roads are wet. It rained, so roads are wet.', 'Roads are wet only when it rains.', 'Wet roads never happen without rain.'], 1),
      q('Find the odd one out.', ['Hypothesis', 'Experiment', 'Conclusion', 'Decoration'], 3),
      q('If A:B = 2:5 and B:C = 10:3, then A:C = ?', ['2:3', '4:3', '5:3', '1:3'], 1),
      q('A test has 50 items, +2 for correct, -1 for wrong, 0 blank. If score is 70 with no blanks, how many are correct?', ['35', '36', '40', '42'], 2),
      q('If today is Monday, what day is 45 days later?', ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], 1),
      q('Which strengthens a causal claim most?', ['A single anecdote', 'Randomized controlled comparison', 'Opinion survey only', 'Viral post'], 1),
      q('What is the next pair: (A,1), (C,4), (F,9), (J,16), ?', ['(N,25)', '(M,20)', '(O,25)', '(N,24)'], 0),
      q('If all policy proposals need evidence, and Proposal X lacks evidence, then X is ____.', ['approved', 'incomplete', 'automatically best', 'unchangeable'], 1),
    ],
  },
  strand: {
    ABM: [
      q('In accounting, assets are equal to ____ plus equity.', ['expenses', 'liabilities', 'revenue', 'capital gains'], 1),
      q('Which market structure has many buyers and many sellers with similar products?', ['Monopoly', 'Oligopoly', 'Perfect competition', 'Monopsony'], 2),
      q('A business’s gross profit is computed as ____.', ['Revenue - Operating Expenses', 'Revenue - Cost of Goods Sold', 'Assets - Liabilities', 'Net Income + Tax'], 1),
      q('Which document summarizes revenues and expenses for a period?', ['Balance Sheet', 'Income Statement', 'Cash Receipt', 'General Ledger only'], 1),
    ],
    STEM: [
      q('Which quantity is scalar?', ['Velocity', 'Acceleration', 'Displacement', 'Temperature'], 3),
      q('The slope of a position-time graph represents ____.', ['speed', 'acceleration', 'velocity', 'jerk'], 2),
      q('Which branch of math studies rates of change?', ['Geometry', 'Algebra', 'Calculus', 'Number theory'], 2),
      q('In scientific notation, 0.00052 is ____.', ['5.2 x 10^-4', '5.2 x 10^4', '52 x 10^-5', '0.52 x 10^-3'], 0),
    ],
    HUMSS: [
      q('Which perspective emphasizes social structures and institutions?', ['Symbolic interactionism', 'Structural functionalism', 'Postmodernism', 'Behaviorism'], 1),
      q('Primary sources in history are ____.', ['Later summaries', 'Original records from the time', 'Any textbook', 'Only documentaries'], 1),
      q('In research, an interview is typically what type of data collection?', ['Quantitative only', 'Qualitative', 'Experimental only', 'None'], 1),
      q('Which concept refers to shared beliefs, values, and practices of a group?', ['Culture', 'Policy', 'Infrastructure', 'Currency'], 0),
    ],
  },
};

const trueFalseBanks = {
  jhs: [
    { text: 'Water boils at 100C at sea level.', correct: 'true' },
    { text: 'The Sun is a planet.', correct: 'false' },
    { text: 'A triangle has three sides.', correct: 'true' },
    { text: 'Plants make food through photosynthesis.', correct: 'true' },
    { text: 'Humans can breathe normally underwater without equipment.', correct: 'false' },
    { text: 'The Philippines is in Southeast Asia.', correct: 'true' },
  ],
  shs: [
    { text: 'DNA carries genetic information.', correct: 'true' },
    { text: 'All acids have a pH above 7.', correct: 'false' },
    { text: 'A valid argument can have true premises and a false conclusion.', correct: 'false' },
    { text: 'Plagiarism is acceptable if done unintentionally.', correct: 'false' },
    { text: 'Velocity is a vector quantity.', correct: 'true' },
    { text: 'Mitochondria are involved in ATP production.', correct: 'true' },
  ],
};

const identificationBanks = {
  jhs: [
    { text: 'Name the process plants use to make their own food.', answer: 'photosynthesis' },
    { text: 'What is the largest ocean on Earth?', answer: 'Pacific Ocean' },
    { text: 'What is 12 multiplied by 8?', answer: '96' },
    { text: 'Who wrote the Noli Me Tangere?', answer: 'Jose Rizal' },
    { text: 'What is the capital city of the Philippines?', answer: 'Manila' },
    { text: 'How many sides does a hexagon have?', answer: '6' },
  ],
  shs: [
    { text: 'What is the SI unit of electric current?', answer: 'ampere' },
    { text: 'Name the branch of mathematics focused on rates of change.', answer: 'calculus' },
    { text: 'What is the document that summarizes revenues and expenses?', answer: 'Income Statement' },
    { text: 'What is the ethical issue of using another person\'s work without credit?', answer: 'plagiarism' },
    { text: 'Name the process by which cells divide to form two identical daughter cells.', answer: 'mitosis' },
    { text: 'What gas is most abundant in Earth\'s atmosphere?', answer: 'nitrogen' },
  ],
};

const essayByBand = {
  jhs: 'Write a well-organized response about one challenge students face in school and explain practical solutions. Use clear examples.',
  shs: 'Write an analytical essay on a current social issue and evaluate at least two possible solutions using evidence-based reasoning.',
};

const essayByStrand = {
  ABM: 'Write an essay about how financial literacy helps students make better personal and business decisions. Include concrete examples.',
  STEM: 'Write an essay explaining how scientific thinking can solve real-world community problems. Include method and evidence.',
  HUMSS: 'Write an essay discussing how civic engagement and critical thinking can improve community decision-making and social responsibility.',
};

function rotate(arr, offset) {
  const n = arr.length;
  if (!n) return [];
  const k = ((offset % n) + n) % n;
  return arr.slice(k).concat(arr.slice(0, k));
}

function buildSubjectItems(profile, subject, count, offsetBase) {
  const bank = banks[profile.band][subject];
  const rotated = rotate(bank, offsetBase);
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(rotated[i % rotated.length]);
  }
  return items;
}

function toChoices(item) {
  return item.choices.map((choiceText, index) => ({
    choiceText,
    isCorrect: index === item.correctIndex,
    orderNum: index + 1,
  }));
}

function buildExam(profile, examIndex) {
  const title = `${profile.gradeLevel} Entrance Exam`;
  const mcMix = [
    ...buildSubjectItems(profile, 'math', 10, examIndex),
    ...buildSubjectItems(profile, 'science', 10, examIndex + 2),
    ...buildSubjectItems(profile, 'english', 10, examIndex + 4),
    ...buildSubjectItems(profile, 'logic', 10, examIndex + 6),
  ];

  if (profile.strand) {
    const strandItems = banks.strand[profile.strand];
    for (let i = 0; i < strandItems.length; i++) {
      const replaceIndex = 36 + i;
      mcMix[replaceIndex] = strandItems[i];
    }
  }

  const tfBank = rotate(trueFalseBanks[profile.band], examIndex);
  const idBank = rotate(identificationBanks[profile.band], examIndex + 2);

  const mcQuestions = mcMix.slice(0, 30).map((item, idx) => ({
    questionText: item.text,
    questionType: 'mc',
    points: item.points || 1,
    orderNum: idx + 1,
    choices: toChoices(item),
  }));

  const tfQuestions = tfBank.slice(0, 5).map((item, idx) => ({
    questionText: item.text,
    questionType: 'true_false',
    points: 1,
    orderNum: mcQuestions.length + idx + 1,
    choices: [
      { choiceText: 'True', isCorrect: item.correct === 'true', orderNum: 1 },
      { choiceText: 'False', isCorrect: item.correct === 'false', orderNum: 2 },
    ],
  }));

  const identificationQuestions = idBank.slice(0, 5).map((item, idx) => ({
    questionText: item.text,
    questionType: 'identification',
    points: 1,
    orderNum: mcQuestions.length + tfQuestions.length + idx + 1,
    choices: [],
    identificationAnswer: item.answer,
    identificationMatchMode: 'exact',
  }));

  const questions = [...mcQuestions, ...tfQuestions, ...identificationQuestions];

  const essayText = profile.strand ? essayByStrand[profile.strand] : essayByBand[profile.band];
  questions.push({
    questionText: essayText,
    questionType: 'essay',
    points: 10,
    orderNum: questions.length + 1,
    choices: [],
  });

  return {
    title,
    gradeLevel: profile.gradeLevel,
    durationMinutes: 120,
    passingScore: 60,
    isActive: true,
    questions,
  };
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function csvLine(values) {
  return values.map(csvEscape).join(',');
}

function questionToCsvRow(question) {
  if (question.questionType === 'essay') {
    return csvLine(['essay', question.questionText, question.points, '', '', '', '', '', '']);
  }

  if (question.questionType === 'true_false') {
    const correct = (question.choices || []).find((choice) => choice.isCorrect)?.choiceText || 'True';
    return csvLine(['true_false', question.questionText, question.points || 1, 'True', 'False', '', '', correct, '']);
  }

  if (question.questionType === 'identification') {
    return csvLine([
      'identification',
      question.questionText,
      question.points || 1,
      '',
      '',
      '',
      '',
      question.identificationAnswer || '',
      question.identificationMatchMode || 'exact',
    ]);
  }

  const choices = question.choices || [];
  const correctIndex = choices.findIndex((choice) => choice.isCorrect);
  const correctLetter = correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : 'A';

  return csvLine([
    'mc',
    question.questionText,
    question.points,
    choices[0]?.choiceText || '',
    choices[1]?.choiceText || '',
    choices[2]?.choiceText || '',
    choices[3]?.choiceText || '',
    correctLetter,
    '',
  ]);
}

function examToCsv(exam) {
  const lines = ['type,question,points,choiceA,choiceB,choiceC,choiceD,correct,matchMode'];
  for (const question of exam.questions) {
    lines.push(questionToCsvRow(question));
  }
  return lines.join('\n');
}

function sanitizeFileName(name) {
  return name.replace(/[\u2013\u2014]/g, '-').replace(/[^a-zA-Z0-9\-_ ]/g, '').replace(/\s+/g, '_').trim();
}

function main() {
  const exams = gradeProfiles.map((profile, examIndex) => buildExam(profile, examIndex));

  fs.writeFileSync(outputJsonPath, JSON.stringify(exams, null, 2));
  fs.mkdirSync(outputCsvDir, { recursive: true });

  for (const exam of exams) {
    const fileName = `${sanitizeFileName(exam.gradeLevel)}_Entrance_Exam.csv`;
    const csvPath = path.join(outputCsvDir, fileName);
    fs.writeFileSync(csvPath, examToCsv(exam), 'utf8');
  }

  console.log(`Generated ${exams.length} exam templates.`);
  console.log(`JSON: ${outputJsonPath}`);
  console.log(`CSV directory: ${outputCsvDir}`);
}

main();