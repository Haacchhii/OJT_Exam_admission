import Icon from '../../../../components/Icons';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';

interface GradeLevelPoint {
  gradeLevel: string;
  count: number;
}

interface GradeLevelDistributionChartProps {
  data: GradeLevelPoint[];
  totalApplicants: number;
}

export default function GradeLevelDistributionChart({
  data,
  totalApplicants,
}: GradeLevelDistributionChartProps) {
  const chartHeight = Math.max(320, data.length * 34);

  return (
    <div className="gk-section-card p-6 mb-6">
      <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5">
        <span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="users" className="w-5 h-5" /></span>
        Applicant Grade-Level Distribution
      </h3>

      {totalApplicants > 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-3" id="chart-grade-level-distribution">
          <h4 className="text-sm font-semibold text-gray-600 mb-2">Applicants by Grade Level</h4>
          <p className="text-xs text-gray-500 mb-3">
            Showing {data.length} grade levels across {totalApplicants} applicants.
          </p>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 8, right: 22, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="gradeLevel" width={220} interval={0} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => {
                    const count = Number(value ?? 0);
                    const percentage = totalApplicants > 0 ? ((count / totalApplicants) * 100).toFixed(1) : '0.0';
                    return [`${count} (${percentage}%)`, 'Applicants'];
                  }}
                />
                <Bar dataKey="count" fill="#16a34a" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="count" position="right" fill="#1f2937" fontSize={11} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 text-center py-8">No applicant data available for grade-level distribution.</p>
      )}
    </div>
  );
}
