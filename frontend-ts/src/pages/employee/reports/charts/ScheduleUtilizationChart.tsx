import Icon from '../../../../components/Icons';
import {
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts';

interface ScheduleUtilizationChartProps {
  scheduleUtilizationData: { schedule: string; utilization: number; used: number; total: number }[];
}

export default function ScheduleUtilizationChart({ scheduleUtilizationData }: ScheduleUtilizationChartProps) {
  return (
    <div className="gk-section-card p-6 mb-6" id="chart-schedule-utilization">
      <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="calendar" className="w-5 h-5" /></span> Top Schedule Utilization</h3>
      {scheduleUtilizationData.length > 0 ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scheduleUtilizationData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="schedule" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value, _name, item: any) => [`${Number(value ?? 0)}% (${item?.payload?.used ?? 0}/${item?.payload?.total ?? 0})`, 'Utilization']} />
              <Bar dataKey="utilization" fill="#8b5cf6" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="utilization" position="insideTop" fill="#ffffff" fontSize={11} fontWeight={700} formatter={(value) => `${Number(value ?? 0)}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-gray-400 text-center py-8">No schedule data available.</p>
      )}
    </div>
  );
}
