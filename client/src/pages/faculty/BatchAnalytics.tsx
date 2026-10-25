import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Award,
  Users,
  Clock,
  Layers,
  CheckCircle2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

export const BatchAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/batch')
      .then(res => {
        if (res.data.success) {
          setAnalytics(res.data.stats);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const stats = analytics;
  const hasAttempts = (stats?.totalAttempts ?? 0) > 0;
  const topicPerformance = stats?.topicPerformance || [];

  const getBarColor = (score: number) => {
    if (score >= 75) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="space-y-8 py-2 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Batch Performance Analytics</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Aggregate performance distribution, class-wide topic weaknesses, and outlier indicators
        </p>
      </div>

      {/* Cohort Statistical Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card pastelAccent="blue">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Class Average
            </span>
            <div className="text-2xl font-bold text-blue-900">{stats?.classAverage != null ? `${stats.classAverage}%` : 'No data'}</div>
            <div className="text-[10px] text-gray-400">Mean Score across cohort</div>
          </div>
        </Card>

        <Card pastelAccent="mint">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Median Score
            </span>
            <div className="text-2xl font-bold text-emerald-900">{stats?.median != null ? `${stats.median}%` : 'No data'}</div>
            <div className="text-[10px] text-gray-400">50th percentile mark</div>
          </div>
        </Card>

        <Card pastelAccent="purple">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Highest Score
            </span>
            <div className="text-2xl font-bold text-purple-900">{stats?.highest != null ? `${stats.highest}%` : 'No data'}</div>
            <div className="text-[10px] text-gray-400">Top performer mark</div>
          </div>
        </Card>

        <Card pastelAccent="rose">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Lowest Score
            </span>
            <div className="text-2xl font-bold text-red-900">{stats?.lowest != null ? `${stats.lowest}%` : 'No data'}</div>
            <div className="text-[10px] text-gray-400">Intervention threshold</div>
          </div>
        </Card>
      </div>

      {/* Topic Weaknesses Chart */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Cohort Topic Performance Distribution
            </span>
            <Badge variant="amber">Class-Wide Topic Analysis</Badge>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          {topicPerformance.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicPerformance} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                <XAxis
                  dataKey="topic"
                  tick={{ fontSize: 11, fill: '#4B5563' }}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="average" radius={[6, 6, 0, 0]}>
                  {topicPerformance.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.average)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center text-xs text-gray-500">
              <BarChart3 className="w-8 h-8 text-blue-300 mb-2" />
              <p className="font-semibold text-gray-800">No performance data yet</p>
              <p>Analytics will appear after students complete assessments.</p>
            </div>
          )}

          {hasAttempts && topicPerformance.some((t: any) => t.average < 50) && (
          <div className="p-3 bg-red-50/50 rounded-xl border border-red-200 text-xs text-red-950 flex items-center justify-between">
            <div>
              <span className="font-bold">Urgent Curriculum Action Needed:</span>
              <p className="text-[11px] text-red-800 mt-0.5">
                One or more topics are below 50% based on completed assessment attempts.
              </p>
            </div>
            <Badge variant="rose">Priority Workshop</Badge>
          </div>
          )}
        </div>
      </Card>

      {/* Difficult Questions Flagged */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              High Difficulty Questions in Exam Cohort
            </span>
            <span className="text-xs text-gray-400">Low discrimination index flags</span>
          </div>
        }
      >
        <div className="divide-y divide-gray-100 text-xs">
          <div className="py-8 text-center text-xs text-gray-500">
            <div className="font-semibold text-gray-800">Question flags require item-level attempt data</div>
            <div className="mt-1">Use Question Quality Analysis to review real stored question attempt metrics.</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
