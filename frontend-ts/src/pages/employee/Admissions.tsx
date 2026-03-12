import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icons';
import ApplicationTracker from './ApplicationTracker';
import AdmissionDetail from './admissions/AdmissionDetail';
import AdmissionList from './admissions/AdmissionList';

export default function EmployeeAdmissions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const directId = searchParams.get('id');
  const directStatus = searchParams.get('status');
  const [detailId, setDetailId] = useState<number | null>(directId ? parseInt(directId) : null);
  const [viewMode, setViewMode] = useState<'applications' | 'track'>('applications');

  const showDetail = (id: number) => {
    setDetailId(id);
    setSearchParams({ id: String(id) });
  };

  const backToList = () => {
    setDetailId(null);
    setSearchParams({});
  };

  // Track view
  if (viewMode === 'track') {
    return (
      <div>
        <div className="flex gap-2 mb-6">
          <button onClick={() => setViewMode('applications')} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition inline-flex items-center gap-1.5"><Icon name="clipboard" className="w-4 h-4" /> Applications</button>
          <button className="px-4 py-2 rounded-lg text-sm font-medium bg-forest-500 text-white inline-flex items-center gap-1.5"><Icon name="search" className="w-4 h-4" /> Track Application</button>
        </div>
        <ApplicationTracker />
      </div>
    );
  }

  // Detail view
  if (detailId) {
    return <AdmissionDetail admissionId={detailId} onBack={backToList} />;
  }

  // List view
  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-forest-500 text-white inline-flex items-center gap-1.5"><Icon name="clipboard" className="w-4 h-4" /> Applications</button>
        <button onClick={() => setViewMode('track')} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition inline-flex items-center gap-1.5"><Icon name="search" className="w-4 h-4" /> Track Application</button>
      </div>
      <AdmissionList onShowDetail={showDetail} directStatus={directStatus} />
    </div>
  );
}
