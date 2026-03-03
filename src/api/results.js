import { load, save } from '../data/store.js';
import { addNotification } from './notifications.js';
import { USE_API, client } from './client.js';

export async function getExamResults() {
  if (USE_API) return client.get('/results');
  return load().examResults;
}
export async function getExamResult(registrationId) {
  if (USE_API) return client.get(`/results/${registrationId}`);
  return load().examResults.find(r => r.registrationId === registrationId) || null;
}

export async function getEssayAnswers() {
  if (USE_API) return client.get('/results/essays');
  return load().essayAnswers;
}

export async function scoreEssay(answerId, points) {
  if (USE_API) return client.patch(`/results/essays/${answerId}/score`, { points });
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
            await addNotification({
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

export async function getSubmittedAnswers(registrationId) {
  if (USE_API) return client.get(`/results/answers/${registrationId}`);
  return load().submittedAnswers.filter(a => a.registrationId === registrationId);
}

export async function submitExamAnswers(registrationId, answersObj, questions) {
  if (USE_API) return client.post('/results/submit', { registrationId, answers: answersObj, questions });
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
  // For exams with essays: calculate MC-only percentage. If MC score meets threshold, mark as pendingEssayReview (not outright failed).
  // The final pass/fail is deferred until essay scoring is complete.
  let mcTotalScore = 0, mcMaxPossible = 0;
  for (const q of questions) {
    if (q.questionType === 'mc') {
      mcMaxPossible += q.points;
      const ua = answersObj[q.id];
      const cc = q.choices.find(c => c.isCorrect);
      if (cc && ua === cc.id) mcTotalScore += q.points;
    }
  }
  const mcPercentage = mcMaxPossible > 0 ? (mcTotalScore / mcMaxPossible) * 100 : 0;
  const passed = hasEssays ? (mcPercentage >= passingScore) : (percentage >= passingScore);
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
    await addNotification({
      userId: 'employee',
      title: 'Exam Submitted',
      message: `${submittedUser.firstName} ${submittedUser.lastName} has completed an entrance examination (Score: ${percentage.toFixed(1)}%).`,
      type: 'info',
    });
  }

  return { totalScore, maxPossible, percentage, passed };
}
