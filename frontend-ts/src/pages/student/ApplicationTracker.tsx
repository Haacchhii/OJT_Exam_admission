import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { trackApplication, getMyAdmission } from '../../api/admissions';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader, SkeletonPage, ErrorAlert, Badge } from '../../components/UI';
import Icon from '../../components/Icons';
import { showToast } from '../../components/Toast';
import { ADMISSION_PROGRESS_STEPS, SCHOOL_PHONE } from '../../utils/constants';
import { badgeClass, formatDate, formatDateRange, formatPersonName } from '../../utils/helpers';

interface TrackResult {
  type: 'admission' | 'exam';
  trackingId: string;
  data: Record<string, any>;
}

function buildSupportMessage(result: TrackResult | null, manualTrackingId: string) {
  const resolvedId = (result?.trackingId || manualTrackingId || '').trim().toUpperCase();
  const status = result?.data?.status || 'Unknown';
  const kind = result?.type === 'exam' ? 'Exam Registration' : result?.type === 'admission' ? 'Admission Application' : 'Application';
  const lines = [
    'Hello Registrar Team,',
    '',
    'I need help with my application status.',
    `Tracking ID: ${resolvedId || 'N/A'}`,
    `Type: ${kind}`,
    `Current Status: ${status}`,
    '',
    'Please advise on the next step. Thank you.',
  ];
  return lines.join('\n');
}

export default function StudentApplicationTracker() {
  const supportEmail = (import.meta.env.VITE_SUPPORT_EMAIL || '').trim();
  const [trackingId, setTrackingId] = useState('');
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: myAdmission, loading: myAdmissionLoading, error: myAdmissionError } = useAsync(
    async () => getMyAdmission(),
    [],
  );

  const suggestedId = useMemo(() => {
    if (!myAdmission || typeof myAdmission !== 'object') return '';
    const maybeId = (myAdmission as any).trackingId;
    return typeof maybeId === 'string' ? maybeId : '';
  }, [myAdmission]);

  const search = async (e: React.FormEvent) => {
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
      setError(err?.message || 'No record found with this tracking ID.');
    } finally {
      setLoading(false);
    }
  };

  const contactSupport = async () => {
    const message = buildSupportMessage(result, trackingId);
    const subjectId = (result?.trackingId || trackingId || 'N/A').trim().toUpperCase();
    const subject = `Support Request - ${subjectId}`;
    const recipient = supportEmail ? supportEmail : '';
    const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        showToast('Support details copied to clipboard. Paste it into your email or chat message.', 'success');
      }
    } catch {
      // Ignore clipboard errors; mail draft will still open.
    }
    if (!supportEmail) {
      showToast('Support email is not configured. Please send the copied details to the registrar manually.', 'error');
    }
    window.location.href = mailto;
  };

  if (myAdmissionLoading) return <SkeletonPage />;
  if (myAdmissionError) return <ErrorAlert error={myAdmissionError} />;

  return (
    <div>
      <PageHeader
        title="Track Application"
        subtitle="Check your admission or exam status using a tracking ID."
      />

      <div className="gk-section-card p-6 mb-6">
        <h3 className="text-lg font-bold text-forest-500 mb-2 flex items-center gap-1.5">
          <Icon name="search" className="w-5 h-5" /> Status Lookup
        </h3>
        <p className="text-gray-500 text-sm mb-4">
          Use your tracking ID to view the latest status without waiting for an email update.
          <br />
          <span className="text-xs text-gray-400">
            Format: GK-ADM-YYYY-XXXXX (admission) or GK-EXM-YYYY-XXXXX (exam)
          </span>
        </p>

        {suggestedId && (
          <div className="mb-4 rounded-lg border border-forest-200 bg-forest-50 px-4 py-3">
            <p className="text-xs text-gray-500">Detected from your account</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-wide text-forest-700">{suggestedId}</span>
              <button
                type="button"
                onClick={() => setTrackingId(suggestedId)}
                className="text-xs rounded-md border border-forest-200 px-2 py-1 text-forest-600 hover:bg-forest-100"
              >
                Use this ID
              </button>
            </div>
          </div>
        )}

        <form onSubmit={search} className="flex flex-col sm:flex-row gap-3">
          <input
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
            placeholder="e.g. GK-ADM-2026-00001"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm font-mono tracking-wider uppercase"
          />
          <button
            type="submit"
            disabled={loading || !trackingId.trim()}
            className="bg-forest-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <>
                <Icon name="spinner" className="w-4 h-4 animate-spin" /> Searching...
              </>
            ) : (
              <>
                <Icon name="search" className="w-4 h-4" /> Search
              </>
            )}
          </button>
        </form>
      </div>

      {error && (
        <div className="gk-section-card p-6 mb-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Icon name="search" className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="font-bold text-red-500 mb-1">Tracking ID Not Found</h3>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      )}

      {result?.type === 'admission' && <AdmissionStatusResult data={result.data} trackingId={result.trackingId} />}
      {result?.type === 'exam' && <ExamStatusResult data={result.data} trackingId={result.trackingId} />}

      {(result || trackingId.trim()) && (
        <div className="gk-section-card p-6 mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Need help with this status?</h4>
          <p className="text-sm text-gray-500 mb-3">
            Use this to create a prefilled support request with your tracking details.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={contactSupport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Icon name="mail" className="w-4 h-4" /> I Need Help
            </button>
            <span className="text-xs text-gray-400">
              Registrar contact: {SCHOOL_PHONE}
              {supportEmail ? ` | ${supportEmail}` : ' | support email not configured'}
            </span>
          </div>
        </div>
      )}

      {!result && !error && (
        <div className="gk-section-card p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">What to expect</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="font-semibold text-gray-700">Submitted</p>
              <p className="text-gray-500">Initial acknowledgment appears immediately after submission.</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="font-semibold text-gray-700">Screening/Evaluation</p>
              <p className="text-gray-500">Most applications move to review within 1-3 business days.</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="font-semibold text-gray-700">Final Decision</p>
              <p className="text-gray-500">Final status is usually posted within 5-10 business days.</p>
            </div>
          </div>
          <div className="mt-4">
            <Link to="/student/admission" className="text-sm text-forest-600 hover:text-forest-700 inline-flex items-center gap-1.5">
              <Icon name="admissions" className="w-4 h-4" /> Go to My Admission
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function AdmissionStatusResult({ data, trackingId }: { data: Record<string, any>; trackingId: string }) {
  const statusOrder: Record<string, number> = {
    Submitted: 0,
    'Under Screening': 1,
    'Under Evaluation': 2,
    Accepted: 3,
    Rejected: -1,
  };

  const current = statusOrder[data.status] ?? -1;

  const periodLabel = data.academicYear?.year && data.semester?.name
    ? `${data.academicYear.year} - ${data.semester.name}`
    : data.academicYear?.year || data.semester?.name || 'N/A';
  const periodWindow = formatDateRange(data.semester?.startDate, data.semester?.endDate, {
    openStartLabel: 'Open',
    openEndLabel: 'Open',
  });

  return (
    <div className="gk-section-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-lg font-bold text-forest-500">Admission Application</h3>
          <p className="text-sm text-gray-400 font-mono">{trackingId}</p>
        </div>
        <Badge className={badgeClass(data.status)}>{data.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Field label="Applicant" value={formatPersonName(data) || 'N/A'} />
        <Field label="Grade Level" value={data.gradeLevel || 'N/A'} />
        <Field label="School Year" value={data.schoolYear || 'N/A'} />
        <Field label="Application Period" value={periodWindow ? `${periodLabel} (${periodWindow})` : periodLabel} />
        <Field label="Submitted" value={data.submittedAt ? formatDate(data.submittedAt) : 'N/A'} />
      </div>

      <h4 className="text-sm font-bold text-forest-500 mt-4 mb-2">Status Progression</h4>
      <div className="flex items-center gap-2 flex-wrap">
        {ADMISSION_PROGRESS_STEPS.map((step, i) => {
          const stepIdx = statusOrder[step];
          const done = current >= stepIdx && data.status !== 'Rejected';
          return (
            <div key={step} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-0.5 ${done ? 'bg-forest-500' : 'bg-gray-200'}`} />}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  done ? 'bg-forest-100 text-forest-700' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {done ? <Icon name="checkCircle" className="w-3.5 h-3.5 inline" /> : 'o'} {step}
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

      <div className="mt-4 rounded-lg border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">
        <p className="font-semibold">Process note</p>
        <p>
          If your status has not changed for more than 10 business days, contact the registrar and provide this tracking ID for faster support.
        </p>
      </div>
    </div>
  );
}

function ExamStatusResult({ data, trackingId }: { data: Record<string, any>; trackingId: string }) {
  const schedule = data.schedule;
  const scheduleDate = schedule?.scheduledDate ? formatDate(schedule.scheduledDate) : null;
  const registrationWindow = schedule
    ? formatDateRange(schedule.registrationOpenDate, schedule.registrationCloseDate, {
      openStartLabel: 'Anytime',
      openEndLabel: 'Until exam date',
    }) || 'Anytime - Until exam date'
    : 'N/A';

  return (
    <div className="gk-section-card p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-lg font-bold text-forest-500">Exam Registration</h3>
          <p className="text-sm text-gray-400 font-mono">{trackingId}</p>
        </div>
        <Badge className={badgeClass(data.status)}>{data.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Field label="Exam" value={schedule?.exam?.title || 'N/A'} />
        <Field label="Grade Level" value={schedule?.exam?.gradeLevel || 'N/A'} />
        <Field
          label="Schedule"
          value={schedule ? `${scheduleDate || schedule.scheduledDate} ${schedule.startTime} - ${schedule.endTime}` : 'N/A'}
        />
        <Field
          label="Registration Window"
          value={registrationWindow}
        />
        <Field label="Registration Status" value={data.status || 'N/A'} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <p className="font-semibold text-gray-700">Next action</p>
        <p>
          Keep this tracking ID until your exam and admission are fully completed. You can use the same page to re-check status at any time.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-forest-500 font-medium">{value}</span>
    </div>
  );
}
