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

interface ResultsBreakdownChartsProps {
  resultsCount: number;
  passFailData: { name: string; value: number; color: string }[];
  scoreBandData: { band: string; count: number }[];
}

const CHART_FALLBACK_COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];

const renderPieLabelInside = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + r * Math.sin(-midAngle * (Math.PI / 180));
  return (
    <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
      {value}
    </text>
  );
};

export default function ResultsBreakdownCharts({
  resultsCount,
  passFailData,
  scoreBandData,
}: ResultsBreakdownChartsProps) {
  return (
    <div className="gk-section-card p-6 mb-6">
      <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="chartPie" className="w-5 h-5" /></span> Results Breakdown</h3>
      {resultsCount > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-100 rounded-xl p-3" id="chart-results-breakdown-pass-fail">
            <h4 className="text-sm font-semibold text-gray-600 mb-2">Pass vs Fail</h4>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={passFailData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    label={renderPieLabelInside}
                    labelLine={false}
                  >
                    {passFailData.map((entry, idx) => (
                      <Cell key={`pf-${idx}`} fill={entry.color || CHART_FALLBACK_COLORS[idx % CHART_FALLBACK_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [Number(value ?? 0), 'Results']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
              {passFailData.map((item) => (
                <div key={item.name} className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 bg-gray-50">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-gray-600 font-medium">{item.name}</span>
                  <span className="text-xs font-bold text-gray-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-3" id="chart-results-breakdown-score-bands">
            <h4 className="text-sm font-semibold text-gray-600 mb-2">Score Bands</h4>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreBandData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [Number(value ?? 0), 'Students']} />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="count" position="insideTop" fill="#ffffff" fontSize={11} fontWeight={700} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 text-center py-8">No result data available.</p>
      )}
    </div>
  );
}
