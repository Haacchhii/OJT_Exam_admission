import { Link, useLocation } from 'react-router-dom';
import Icon from './Icons';

const labelMap: Record<string, string> = {
  student: 'Student Portal',
  employee: 'Employee Portal',
  dashboard: 'Dashboard',
  admission: 'Admission',
  admissions: 'Admissions',
  exam: 'Online Exam',
  exams: 'Exams',
  results: 'Results',
  reports: 'Reports',
  users: 'Users',
};

export default function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => {
    const path = '/' + segments.slice(0, i + 1).join('/');
    const label = labelMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
    const isLast = i === segments.length - 1;
    return { path, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-4 -mt-1" aria-label="Breadcrumb">
      <Link to={`/${segments[0]}`} className="hover:text-forest-500 transition-colors">
        <Icon name="home" className="w-4 h-4" />
      </Link>
      {crumbs.slice(1).map((c) => (
        <span key={c.path} className="flex items-center gap-1.5">
          <span className="text-gray-300">/</span>
          {c.isLast ? (
            <span className="text-forest-500 font-medium" aria-current="page">{c.label}</span>
          ) : (
            <Link to={c.path} className="hover:text-forest-500 transition-colors">{c.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
