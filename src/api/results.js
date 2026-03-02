import { load, save } from '../data/store.js';
import { addNotification } from './notifications.js';

export function getExamResults() { return load().examResults; }
export function getExamResult(registrationId) { return load().examResults.find(r => r.registrationId === registrationId) || null; }

export function getEssayAnswers() { return load().essayAnswers; }

export function scoreEssay(answerId, points) {
  const data = load();
  const answer = data.essayAnswers.find(a => a.id === answerId);
  if (answer) {
    // Bounds check: points must be between 0 and maxPoints
    const clampedPoints = Math.max(0, Math.min(points, answer.maxPoints));
    answer.pointsAwarded = clampedPoints;
    answer.scored = true;
    const regId = answer.registrationId;
    const result = data.examResults.find(r => r.registrationId === regId);
    if (result) {
      const regEssays = data.essayAnswers.filter(a => a.registrationId === regId);
      const allScored = regEssays.every(a => a.scored);
      const essayReg = data.examRegistrations.find(r => r.id === regId);
      const schedule = essayReg ? data.examSchedules.find(s => s.id === essayReg.scheduleId) : null;
      const exam = schedule ? data.exams.find(e => e.id === schedule.examId) : null;
      if (exam) {
        let mcScore = 0;
        const submitted = data.submittedAnswers.filter(a => a.registrationId === regId);
        for (const q of exam.questions) {
          if (q.questionType === 'mc') {
            const sa = submitted.find(a => a.questionId === q.id);
            const cc = q.choices.find(c => c.isCorrect);
            if (sa && cc && sa.selectedChoiceId === cc.id) mcScore += q.points;
          }
        }
        const essayPoints = regEssays.reduce((sum, a) => sum + (a.scored ? a.pointsAwarded : 0), 0);
        result.totalScore = mcScore + essayPoints;
        result.percentage = result.maxPossible > 0 ? parseFloat(((result.totalScore / result.maxPossible) * 100).toFixed(1)) : 0;
        result.passed = result.percentage >= (exam.passingScore || 60);
        result.essayReviewed = allScored;
        if (allScored) {
          // Notify student that all essays have been reviewed
          const essayReg2 = data.examRegistrations.find(r => r.id === regId);
          const studentUser = essayReg2 ? data.users.find(u => u.email === essayReg2.userEmail) : null;
          if (studentUser) {
            addNotification({
              userId: `student_${studentUser.id}`,
              title: 'Essay Review Complete',
              message: `All essay answers have been reviewed. Your final score is ${result.percentage.toFixed(1)}% — ${result.passed ? 'Passed' : 'Failed'}.`,
              type: result.passed ? 'success' : 'warning',
            });
          }
        }
      }
    }
    save(data);
  }
  return answer;
}

export function getSubmittedAnswers(registrationId) {
  return load().submittedAnswers.filter(a => a.registrationId === registrationId);
}

export function submitExamAnswers(registrationId, answersObj, questions) {
  const data = load();
  data.submittedAnswers = data.submittedAnswers.filter(a => a.registrationId !== registrationId);
  for (const q of questions) {
    const userAnswer = answersObj[q.id];
    const entry = { registrationId, questionId: q.id, selectedChoiceId: null, essayText: null };
    if (q.questionType === 'mc') {
      entry.selectedChoiceId = typeof userAnswer === 'number' ? userAnswer : null;
    } else {
      entry.essayText = typeof userAnswer === 'string' ? userAnswer : null;
      const existing = data.essayAnswers.find(e => e.registrationId === registrationId && e.questionId === q.id);
      if (!existing && entry.essayText) {
        const nextEssayId = data.essayAnswers.length > 0 ? Math.max(...data.essayAnswers.map(e => e.id)) + 1 : 1;
        data.essayAnswers.push({
          id: nextEssayId,
          registrationId, questionId: q.id, essayResponse: entry.essayText,
          pointsAwarded: null, maxPoints: q.points, scored: false,
        });
      }
    }
    data.submittedAnswers.push(entry);
  }
  const reg = data.examRegistrations.find(r => r.id === registrationId);
  if (reg) { reg.status = 'done'; reg.submittedAt = new Date().toISOString(); }
  let totalScore = 0, maxPossible = 0;
  for (const q of questions) {
    maxPossible += q.points;
    if (q.questionType === 'mc') {
      const ua = answersObj[q.id];
      const cc = q.choices.find(c => c.isCorrect);
      if (cc && ua === cc.id) totalScore += q.points;
    }
  }
  const percentage = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;
  const schedule = reg ? data.examSchedules.find(s => s.id === reg.scheduleId) : null;
  const exam = schedule ? data.exams.find(e => e.id === schedule.examId) : null;
  const passingScore = exam ? exam.passingScore : 60;
  const hasEssays = questions.some(q => q.questionType === 'essay');
  // If there are essay questions, defer pass/fail until essays are scored
  const passed = hasEssays ? false : percentage >= passingScore;
  const existingResult = data.examResults.find(r => r.registrationId === registrationId);
  if (existingResult) {
    Object.assign(existingResult, { totalScore, maxPossible, percentage: parseFloat(percentage.toFixed(1)), passed, essayReviewed: !hasEssays });
  } else {
    const nextId = data.examResults.length > 0 ? Math.max(...data.examResults.map(r => r.id)) + 1 : 1;
    data.examResults.push({
      id: nextId,
      registrationId, totalScore, maxPossible, percentage: parseFloat(percentage.toFixed(1)),
      passed, essayReviewed: !hasEssays, reviewedBy: null, createdAt: new Date().toISOString(),
    });
  }
  save(data);

  // Notify employee about new exam submission
  const submittedReg = data.examRegistrations.find(r => r.id === registrationId);
  const submittedUser = submittedReg ? data.users.find(u => u.email === submittedReg.userEmail) : null;
  if (submittedUser) {
    addNotification({
      userId: 'employee',
      title: 'Exam Submitted',
      message: `${submittedUser.firstName} ${submittedUser.lastName} has completed an entrance examination (Score: ${percentage.toFixed(1)}%).`,
      type: 'info',
    });
  }

  return { totalScore, maxPossible, percentage, passed };
}
