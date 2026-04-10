import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icons';
import ApplicationTracker from './ApplicationTracker';
import AdmissionDetail from './admissions/AdmissionDetail';
import AdmissionList from './admissions/AdmissionList';

export default function EmployeeAdmissions() {
  const location = useLocation();
  const navigate = useNavigate();

  const hashParams = useMemo(() => {
    const hash = window.location.hash || '';
    const queryIndex = hash.indexOf('?');
    const query = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
    return new URLSearchParams(query);
  }, [location.key]);

  const directStatus = hashParams.get('status');
  const routeDetailIdRaw = hashParams.get('id');
  const routeDetailId = routeDetailIdRaw ? Number.parseInt(routeDetailIdRaw, 10) : null;

  const [activeDetailId, setActiveDetailId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'applications' | 'track'>('applications');

  const detailId = activeDetailId ?? routeDetailId;
  const hasDetailId = Number.isFinite(detailId) && (detailId as number) > 0;

  const showDetail = (id: number) => {
    setActiveDetailId(id);
    const next = new URLSearchParams(hashParams);
    next.set('id', String(id));
    navigate(`${location.pathname}?${next.toString()}`, { replace: false });
  };

  const backToList = () => {
    setActiveDetailId(null);
    const next = new URLSearchParams(hashParams);
    next.delete('id');
    navigate(next.toString() ? `${location.pathname}?${next.toString()}` : location.pathname, { replace: false });
  };

  const viewTabs = (
    <div className="mb-6">
      <p className="text-xs text-gray-500 mb-2">Switch between admissions queue management and direct tracking lookup.</p>
      <div className="inline-flex gap-2 p-1.5 rounded-2xl border border-gray-200 bg-white/80 shadow-sm" role="tablist" aria-label="Admissions workspace tabs">
      <button
        role="tab"
        aria-selected={viewMode === 'applications'}
        onClick={() => setViewMode('applications')}
        className={`relative px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 inline-flex items-center gap-2 border ${viewMode === 'applications' ? 'bg-gradient-to-r from-forest-600 to-forest-500 text-white border-forest-600 shadow-[0_8px_20px_rgba(21,128,61,0.28)]' : 'bg-white text-gray-600 border-gray-200 hover:border-forest-200 hover:text-forest-700 hover:bg-forest-50'}`}
      >
        <Icon name="clipboard" className="w-4 h-4" /> Applications
        {viewMode === 'applications' && <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gold-300" />}
      </button>
      <button
        role="tab"
        aria-selected={viewMode === 'track'}
        onClick={() => setViewMode('track')}
        className={`relative px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 inline-flex items-center gap-2 border ${viewMode === 'track' ? 'bg-gradient-to-r from-forest-600 to-forest-500 text-white border-forest-600 shadow-[0_8px_20px_rgba(21,128,61,0.28)]' : 'bg-white text-gray-600 border-gray-200 hover:border-forest-200 hover:text-forest-700 hover:bg-forest-50'}`}
      >
        <Icon name="search" className="w-4 h-4" /> Track Application
        {viewMode === 'track' && <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gold-300" />}
      </button>
      </div>
    </div>
  );

  // Detail view
  if (hasDetailId) {
    return <AdmissionDetail admissionId={detailId as number} onBack={backToList} />;
  }

  return (
    <div>
      {viewTabs}
      {viewMode === 'track' ? <ApplicationTracker /> : <AdmissionList onShowDetail={showDetail} directStatus={directStatus} />}
    </div>
  );
}
