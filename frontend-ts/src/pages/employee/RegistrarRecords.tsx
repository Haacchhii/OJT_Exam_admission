import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { getAdmissions } from '../../api/admissions';
import { PageHeader, EmptyState, SkeletonPage } from '../../components/UI';
import Icon from '../../components/Icons';
import type { Admission } from '../../types';

export default function RegistrarRecords() {
  const { data, loading, refetch } = useAsync<Admission[]>(
    () => getAdmissions({ status: 'Accepted', limit: 200 }).then(r => r.data),
    [], 0, { resourcePrefixes: ['/admissions'] }
  );

  useEffect(() => { refetch(); }, []);

  if (loading && !data) return <SkeletonPage />;

  return (
    <div>
      <PageHeader title="Registrar Records" subtitle="Accepted applications ready for enrollment handoff and processing." />
      <div className="gk-section-card p-6">
        {(!data || data.length === 0) ? (
          <EmptyState icon="checkCircle" title="No accepted applications" text="There are no accepted applications awaiting registrar processing." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Tracking ID</th>
                  <th className="px-3 py-2">Applicant</th>
                  <th className="px-3 py-2">Grade</th>
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((a: Admission) => (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="px-3 py-3 text-xs text-gray-600 font-medium">{a.trackingId}</td>
                    <td className="px-3 py-3">{a.firstName} {a.lastName}</td>
                    <td className="px-3 py-3">{a.gradeLevel}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{new Date(a.submittedAt).toLocaleDateString()}</td>
                    <td className="px-3 py-3 text-xs"><Link to={`/employee/admissions?id=${a.id}`} className="text-forest-500 hover:text-forest-700 inline-flex items-center gap-1"><Icon name="eye" className="w-4 h-4" /> View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
