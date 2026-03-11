import { useState } from 'react';
import { trackApplication } from '../../api/admissions';
import { Badge } from '../../components/UI';
import Icon from '../../components/Icons';
import { formatDate, badgeClass } from '../../utils/helpers';
import { ADMISSION_PROGRESS_STEPS } from '../../utils/constants';

interface TrackResult {
  type: 'admission' | 'exam';
  trackingId: string;
  data: Record<string, any>;
}

interface FieldProps {
  label: string;
  value: string;
  className?: string;
}

export default function ApplicationTracker() {
  const [trackingId, setTrackingId] = useState('');
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = trackingId.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await trackApplication(id);
      setResult(res as TrackResult);
    } catch (err: any) {
      setError(err.message || 'No record found with this tracking ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="gk-card p-6 mb-6">
        <h3 className="text-lg font-bold text-forest-500 mb-2 flex items-center gap-1.5"><Icon name="search" className="w-5 h-5" /> Track Application</h3>
        <p className="text-gray-500 text-sm mb-4">
          Enter the tracking ID to look up the status of an admission application or exam registration.
          <br />
          <span className="text-xs text-gray-400">Format: GK-ADM-YYYY-XXXXX (admission) or GK-EXM-YYYY-XXXXX (exam)</span>
        </p>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            value={trackingId}
            onChange={e => setTrackingId(e.target.value.toUpperCase())}
            placeholder="e.g. GK-ADM-2026-00001"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm font-mono tracking-wider uppercase"
          />
          <button
            type="submit"
            disabled={loading || !trackingId.trim()}
            className="bg-forest-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center gap-1.5"
          >
            {loading ? <><Icon name="spinner" className="w-4 h-4 animate-spin" /> Searching…</> : <><Icon name="search" className="w-4 h-4" /> Search</>}
          </button>
        </form>
      </div>

      {error && (
        <div className="gk-card p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3"><Icon name="search" className="w-7 h-7 text-gray-400" /></div>
          <h3 className="font-bold text-red-500 mb-1">Not Found</h3>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      )}

      {result?.type === 'admission' && <AdmissionResult data={result.data} trackingId={result.trackingId} />}
      {result?.type === 'exam' && <ExamResult data={result.data} trackingId={result.trackingId} />}
    </div>
  );
}

function AdmissionResult({ data, trackingId }: { data: Record<string, any>; trackingId: string }) {
  const statusOrder: Record<string, number> = { 'Submitted': 0, 'Under Screening': 1, 'Under Evaluation': 2, 'Accepted': 3, 'Rejected': -1 };

  return (
    <div className="gk-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-forest-500">Admission Application</h3>
          <p className="text-sm text-gray-400 font-mono">{trackingId}</p>
        </div>
        <Badge className={badgeClass(data.status)}>{data.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Field label="Full Name" value={`${data.firstName} ${data.lastName}`} />
        <Field label="Email" value={data.email} />
        <Field label="Grade Level" value={data.gradeLevel} />
        <Field label="School Year" value={data.schoolYear} />
        <Field label="Gender" value={data.gender} />
        <Field label="Date of Birth" value={data.dob} />
        <Field label="Applicant Type" value={data.applicantType} />
        <Field label="Guardian" value={`${data.guardian} (${data.guardianRelation})`} />
        <Field label="Submitted" value={formatDate(data.submittedAt)} />
        {data.notes && <Field label="Notes" value={data.notes} className="md:col-span-2" />}
      </div>

      <h4 className="text-sm font-bold text-forest-500 mt-4 mb-2">Status Progression</h4>
      <div className="flex items-center gap-2 flex-wrap">
        {ADMISSION_PROGRESS_STEPS.map((step, i) => {
          const current = statusOrder[data.status] ?? -1;
          const stepIdx = statusOrder[step];
          const isActive = current >= stepIdx;
          const isRejected = data.status === 'Rejected';
          return (
            <div key={step} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-0.5 ${isActive && !isRejected ? 'bg-forest-500' : 'bg-gray-200'}`} />}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                isRejected && step === data.status ? 'bg-red-100 text-red-700' :
                isActive && !isRejected ? 'bg-forest-100 text-forest-700' : 'bg-gray-100 text-gray-400'
              }`}>
                {isActive && !isRejected ? <Icon name="checkCircle" className="w-3.5 h-3.5 inline" /> : isRejected && i === 0 ? <Icon name="xCircle" className="w-3.5 h-3.5 inline" /> : '○'} {step}
              </div>
            </div>
          );
        })}
        {data.status === 'Rejected' && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-red-200" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <Icon name="xCircle" className="w-3.5 h-3.5 inline" /> Rejected
            </div>
          </div>
        )}
      </div>

      {data.documents?.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-bold text-forest-500 mb-2">Documents</h4>
          <div className="flex flex-wrap gap-2">
            {data.documents.map((doc: string, i: number) => (
              <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-lg">{doc}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExamResult({ data, trackingId }: { data: Record<string, any>; trackingId: string }) {
  const schedule = data.schedule;
  const exam = schedule?.exam;
  const result = data.result;

  return (
    <div className="gk-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-forest-500">Exam Registration</h3>
          <p className="text-sm text-gray-400 font-mono">{trackingId}</p>
        </div>
        <Badge className={badgeClass(data.status)}>{data.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Field label="Student Email" value={data.userEmail} />
        <Field label="Exam" value={exam?.title || 'N/A'} />
        <Field label="Grade Level" value={exam?.gradeLevel || 'N/A'} />
        <Field label="Schedule" value={schedule ? `${schedule.scheduledDate} ${schedule.startTime} - ${schedule.endTime}` : 'N/A'} />
        <Field label="Registration Status" value={data.status} />
        {data.startedAt && <Field label="Started At" value={formatDate(data.startedAt)} />}
        {data.submittedAt && <Field label="Submitted At" value={formatDate(data.submittedAt)} />}
      </div>

      {result && (
        <div className="mt-4 p-4 rounded-lg bg-gray-50">
          <h4 className="text-sm font-bold text-forest-500 mb-3">Exam Results</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${result.passed ? 'text-forest-600' : 'text-red-600'}`}>{result.percentage.toFixed(1)}%</div>
              <div className="text-xs text-gray-400">Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-forest-600">{result.totalScore}/{result.maxPossible}</div>
              <div className="text-xs text-gray-400">Points</div>
            </div>
            <div className="text-center">
              <Badge className={result.passed ? 'gk-badge gk-badge-passed text-lg' : 'gk-badge gk-badge-failed text-lg'}>
                {result.passed ? <><Icon name="checkCircle" className="w-5 h-5 inline" /> PASSED</> : <><Icon name="xCircle" className="w-5 h-5 inline" /> FAILED</>}
              </Badge>
            </div>
            <div className="text-center">
              <Badge className={result.essayReviewed ? 'gk-badge gk-badge-reviewed' : 'gk-badge gk-badge-pending'}>
                {result.essayReviewed ? 'Essays Reviewed' : 'Essay Pending'}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {!result && data.status !== 'done' && (
        <div className="mt-4 p-4 rounded-lg bg-gold-50 text-gold-700 text-sm">
          <Icon name="clock" className="w-4 h-4 inline" /> This exam has not been completed yet. Results will be available after submission.
        </div>
      )}
    </div>
  );
}

function Field({ label, value, className = '' }: FieldProps) {
  return (
    <div className={className}>
      <span className="block text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-forest-500 font-medium">{value}</span>
    </div>
  );
}
