import { Link } from 'react-router-dom';
import { getMyRegistrationSummary, getExamForReview } from '../../api/exams.js';
import { getMyResult, getSubmittedAnswers } from '../../api/results.js';
import { PageHeader, SkeletonPage, ErrorAlert } from '../../components/UI.jsx';
import Icon from '../../components/Icons.jsx';
import { formatDate } from '../../utils/helpers.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { showToast } from '../../components/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { SCHOOL_NAME_SHORT, SCHOOL_NAME_SUBTITLE, SCHOOL_NAME, SCHOOL_ADDRESS, SCHOOL_PHONE, PRINT_DELAY_MS } from '../../utils/constants.js';

export default function StudentResults() {
  const { user } = useAuth();

  const { data: rawData, loading, error, refetch } = useAsync(async () => {
    const [regSummary, myResult] = await Promise.all([
      getMyRegistrationSummary(),
      getMyResult()
    ]);
    const myReg = regSummary?.latest || null;
    const examId = myReg?.schedule?.examId;
    let exam = null;
    let storedAnswers = [];

    if (myReg) {
      const [loadedExam, loadedAnswers] = await Promise.all([
        (async () => {
          if (!examId) return null;
          try {
            return await getExamForReview(examId);
          } catch (err) {
            showToast('Could not load exam review. Question breakdown may be incomplete.', 'error');
            console.error('getExamForReview failed:', err);
            return null;
          }
        })(),
        (async () => {
          try {
            return await getSubmittedAnswers(myReg.id);
          } catch (err) {
            showToast('Could not load your submitted answers.', 'error');
            console.error('getSubmittedAnswers failed:', err);
            return [];
          }
        })(),
      ]);
      exam = loadedExam;
      storedAnswers = loadedAnswers;
    }
    // Derive essay answers from submitted answers (student cannot call getEssayAnswers)
    const essayAnswers = storedAnswers.filter(a => a.question?.questionType === 'essay').map(a => ({
      registrationId: a.registrationId,
      questionId: a.questionId,
      essayResponse: a.essayText || '',
      maxPoints: a.question?.points || 0,
      scored: a.pointsAwarded != null, // true if teacher has scored this essay
      pointsAwarded: a.pointsAwarded ?? null,
    }));
    return { myResult, myReg, exam, essayAnswers, storedAnswers };
  }, [user]);

  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  const myResult = rawData?.myResult || null;
  const myReg = rawData?.myReg || null;
  const exam = rawData?.exam || null;
  const essayAnswers = rawData?.essayAnswers || [];
  const storedAnswers = rawData?.storedAnswers || [];

  if (!myResult) {
    return (
      <div>
        <PageHeader title="Exam Results" subtitle="View your entrance examination score and results." />
        <div className="gk-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-3"><Icon name="chartBar" className="w-7 h-7 text-forest-500" /></div>
          <h3 className="font-bold text-forest-500 mb-1">No Results Yet</h3>
          <p className="text-gray-500 text-sm mb-4">{!myReg ? "You haven't registered for an exam yet." : 'Your exam results are not yet available.'}</p>
          <Link to="/student/exam" className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg inline-block hover:bg-gray-50">Go to Exam Page</Link>
        </div>
      </div>
    );
  }

  const passed = myResult.passed;

  const handlePrint = () => {
    const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const printWin = window.open('', '_blank');
    if (!printWin || printWin.closed) {
      showToast('Popup blocked — please allow popups for this site and try again.', 'error');
      return;
    }
    const studentName = user ? `${esc(user.firstName)} ${esc(user.lastName)}` : 'Student';
    printWin.document.write(`<!DOCTYPE html><html><head><title>My Exam Result</title>
      <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        h1 { color: #166534; font-size: 24px; margin-bottom: 4px; }
        h2 { color: #166534; font-size: 16px; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #ffd700; }
        .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .field label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 2px; }
        .field span { font-size: 14px; font-weight: 500; }
        .result-badge { display: inline-block; padding: 6px 16px; border-radius: 99px; font-size: 14px; font-weight: 700; }
        .result-badge.passed { background: #dcfce7; color: #166534; }
        .result-badge.failed { background: #fee2e2; color: #991b1b; }
        .score-circle { text-align: center; margin: 20px 0; }
        .score-circle .pct { font-size: 48px; font-weight: 800; }
        .score-circle .pct.passed { color: #166534; }
        .score-circle .pct.failed { color: #991b1b; }
        .logo { text-align: center; margin-bottom: 20px; } .logo span { font-size: 32px; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>
      <div class="logo"><span>🔑</span><h1><span style="color:#fbbf24">${SCHOOL_NAME_SHORT}</span><br/><span style="color:#166534">${SCHOOL_NAME_SUBTITLE}</span></h1><p class="subtitle">${SCHOOL_ADDRESS} &bull; Tel: ${SCHOOL_PHONE}<br/>Entrance Examination Result</p></div>
      <h2>Student: ${studentName}</h2>
      <h2>Exam Results</h2>
      <div class="score-circle"><div class="pct ${passed ? 'passed' : 'failed'}">${myResult.percentage.toFixed(1)}%</div><p style="color:#888;font-size:13px">Overall Score</p></div>
      <div class="grid">
        <div class="field"><label>Exam</label><span>${esc(exam?.title || 'Entrance Exam')}</span></div>
        <div class="field"><label>Total Score</label><span>${myResult.totalScore} / ${myResult.maxPossible}</span></div>
        <div class="field"><label>Passing Score</label><span>${exam?.passingScore || '—'}%</span></div>
        <div class="field"><label>Result</label><span class="result-badge ${passed ? 'passed' : 'failed'}">${passed ? 'PASSED' : 'FAILED'}</span></div>
        <div class="field"><label>Essay Review</label><span>${myResult.essayReviewed ? 'Reviewed' : 'Pending'}</span></div>
        <div class="field"><label>Date Taken</label><span>${myResult.createdAt ? new Date(myResult.createdAt).toLocaleDateString() : 'N/A'}</span></div>
      </div>
      <p style="margin-top:40px;font-size:11px;color:#aaa;text-align:center">Printed on ${new Date().toLocaleDateString()} — ${SCHOOL_NAME} &copy; ${new Date().getFullYear()}</p>
    </body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), PRINT_DELAY_MS);
  };

  return (
    <div>
      <PageHeader title="Exam Results" subtitle="View your entrance examination score and results.">
        <button onClick={handlePrint} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm inline-flex items-center gap-1.5" aria-label="Print exam result"><Icon name="document" className="w-4 h-4" /> Print / Export PDF</button>
      </PageHeader>

      {/* Score Summary */}
      <div className={`rounded-xl border-2 p-6 mb-6 ${passed ? 'bg-forest-50 border-forest-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-5xl">{passed ? <Icon name="trophy" className="w-12 h-12 text-gold-500" /> : <Icon name="xCircle" className="w-12 h-12 text-red-400" />}</span>
          <div>
            <h3 className={`text-2xl font-bold ${passed ? 'text-forest-700' : 'text-red-700'}`}>{passed ? 'PASSED' : 'FAILED'}</h3>
            <p className="text-gray-500">{exam?.title || 'Entrance Exam'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 items-center">
          <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 ${passed ? 'border-forest-400' : 'border-red-400'}`}>
            <span className="text-2xl font-bold">{myResult.percentage.toFixed(0)}%</span>
            <span className="text-xs text-gray-500">Score</span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <span className="text-gray-500">Total Score</span><span className="font-semibold">{myResult.totalScore} / {myResult.maxPossible}</span>
            <span className="text-gray-500">Passing Score</span><span className="font-semibold">{exam?.passingScore || '—'}%</span>
            <span className="text-gray-500">Date Taken</span><span className="font-semibold">{formatDate(myResult.createdAt)}</span>
            <span className="text-gray-500">Essay Review</span>
            <span>{myResult.essayReviewed
              ? <span className="bg-forest-100 text-forest-700 px-2 py-0.5 rounded-full text-xs font-medium">Reviewed</span>
              : <span className="bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full text-xs font-medium">Pending</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Question Breakdown */}
      {exam && (
        <div className="gk-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-4">Question Breakdown</h3>
          <div className="space-y-4">
            {exam.questions.map((q, i) => {
              if (q.questionType === 'mc') {
                const stored = storedAnswers.find(a => a.questionId === q.id);
                const selectedId = stored?.selectedChoiceId ?? null;
                const correct = q.choices.find(c => c.isCorrect);
                const isCorrect = selectedId != null && correct && selectedId === correct.id;
                const selected = q.choices.find(c => c.id === selectedId);

                return (
                  <div key={q.id} className={`border rounded-lg p-4 ${isCorrect ? 'border-forest-200 bg-forest-50/50' : 'border-red-200 bg-red-50/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-gray-400">Q{i + 1}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span>{isCorrect ? <><Icon name="checkCircle" className="w-4 h-4 inline text-forest-500" /> Correct</> : <><Icon name="xCircle" className="w-4 h-4 inline text-red-500" /> Incorrect</>}</span>
                        <span className="text-gray-400">{isCorrect ? q.points : 0} / {q.points} pts</span>
                      </div>
                    </div>
                    <p className="text-forest-500 font-medium mb-3">{q.questionText}</p>
                    <div className="space-y-1.5">
                      {q.choices.map(c => {
                        const isSel = c.id === selectedId;
                        return (
                          <div key={c.id} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${c.isCorrect ? 'bg-forest-100 text-forest-700 font-medium' : isSel && !c.isCorrect ? 'bg-red-100 text-red-700' : 'text-gray-600'}`}>
                            {c.isCorrect ? '✓' : isSel ? '✗' : '○'} {c.choiceText}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs mt-2 text-gray-400">{selected ? `Your answer: ${selected.choiceText}` : 'No answer selected'}</p>
                  </div>
                );
              } else {
                const essay = essayAnswers.find(a => a.questionId === q.id);
                return (
                  <div key={q.id} className="border border-gold-200 bg-gold-50/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-gray-400">Q{i + 1}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span>{essay?.scored ? <><Icon name="documentText" className="w-4 h-4 inline" /> Scored</> : <><Icon name="clock" className="w-4 h-4 inline" /> Pending Review</>}</span>
                        <span className="text-gray-400">{essay?.scored ? essay.pointsAwarded : '—'} / {q.points} pts</span>
                      </div>
                    </div>
                    <p className="text-forest-500 font-medium mb-3">{q.questionText}</p>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-400 mb-1 font-medium">Your Answer:</p>
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{essay?.essayResponse || 'No response submitted.'}</p>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}
    </div>
  );
}
