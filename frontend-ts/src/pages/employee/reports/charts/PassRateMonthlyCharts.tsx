import Icon from '../../../../components/Icons';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts';

interface PassRateMonthlyChartsProps {
  sortedStats: { name: string; passed: number; total: number; rate: number }[];
  monthData: { label: string; count: number }[];
  admissionStatusData: { name: string; value: number; color: string }[];
  admissionStatusTotal: number;
}

const CHART_FALLBACK_COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];

export default function PassRateMonthlyCharts({
  sortedStats,
  monthData,
  admissionStatusData,
  admissionStatusTotal,
}: PassRateMonthlyChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 mb-6 items-start">
      <div className="gk-section-card p-6" id="chart-pass-rate-by-exam">
        <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="chartBar" className="w-5 h-5" /></span> Pass Rate by Exam</h3>
        {sortedStats.length > 0 && sortedStats.some(e => e.total > 0) ? (
          <div className="h-96 overflow-x-auto">
            <ResponsiveContainer width="100%" height="100%" minWidth={Math.max(800, sortedStats.length * 80)}>
              <BarChart data={sortedStats} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${Number(value ?? 0)}%`, 'Pass Rate']} />
                <Bar dataKey="rate" fill="#16a34a" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="rate" position="insideTop" fill="#ffffff" fontSize={11} fontWeight={700} formatter={(value) => `${Number(value ?? 0)}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">No exam result data available.</p>
        )}
      </div>

      <div className="gk-section-card p-6" id="chart-applicant-volume">
        <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="arrowTrendUp" className="w-5 h-5" /></span> Applicant Volume (Monthly)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [Number(value ?? 0), 'Applicants']} />
              <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="count" position="insideTop" fill="#ffffff" fontSize={11} fontWeight={700} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="gk-section-card p-6" id="chart-admission-status-mix">
        <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="users" className="w-5 h-5" /></span> Admission Status Mix</h3>
        {admissionStatusData.length > 0 ? (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={admissionStatusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} label={{ position: 'outside', fill: '#374151', fontSize: 11, fontWeight: 600, formatter: (v) => `${v}` }}>
                    {admissionStatusData.map((entry, idx) => (
                      <Cell key={`status-${idx}`} fill={entry.color || CHART_FALLBACK_COLORS[idx % CHART_FALLBACK_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [Number(value ?? 0), 'Applicants']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
              {admissionStatusData
                .slice()
                .sort((a, b) => b.value - a.value)
                .map((item) => (
                  <div key={item.name} className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 bg-gray-50">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-600 font-medium">{item.name}</span>
                    <span className="text-xs font-bold text-gray-800">{item.value}</span>
                    <span className="text-[11px] text-gray-500">({admissionStatusTotal > 0 ? Math.round((item.value / admissionStatusTotal) * 100) : 0}%)</span>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-center py-8">No admissions data available.</p>
        )}
      </div>
    </div>
  );
}
