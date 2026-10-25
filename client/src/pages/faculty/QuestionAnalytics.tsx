import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge, DifficultyBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  Layers,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingDown,
  RefreshCw,
  Search
} from 'lucide-react';

export const QuestionAnalytics: React.FC = () => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);

  const fetchQuestionQuality = () => {
    setIsLoading(true);
    api.get('/analytics/questions')
      .then(res => {
        if (res.data.success) {
          setQuestions(res.data.questions);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchQuestionQuality();
  }, []);

  const displayedQuestions = filterFlaggedOnly
    ? questions.filter(q => q.flag)
    : questions;

  return (
    <div className="space-y-6 py-2 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Question Quality Analysis</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Psychometric discrimination indices, failure rates, and pedagogical ambiguity flags
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer bg-white px-3 py-2 border border-gray-200 rounded-lg">
            <input
              type="checkbox"
              checked={filterFlaggedOnly}
              onChange={e => setFilterFlaggedOnly(e.target.checked)}
              className="rounded text-red-600"
            />
            <span>Show Flagged Only ({questions.filter(q => q.flag).length})</span>
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchQuestionQuality}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Metrics
          </Button>
        </div>
      </div>

      {/* Quality Overview Card */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-600" />
              Item Response & Discrimination Table ({displayedQuestions.length})
            </span>
            <Badge variant="blue">Faculty Review Queue</Badge>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase text-[10px]">
                <th className="pb-3">Question Title</th>
                <th className="pb-3">Topic / Type</th>
                <th className="pb-3">Attempts</th>
                <th className="pb-3">Correct %</th>
                <th className="pb-3">Discrimination</th>
                <th className="pb-3 text-right">Quality Diagnosis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedQuestions.map(q => (
                <tr key={q._id} className={q.flag ? 'bg-amber-50/30' : 'hover:bg-gray-50'}>
                  <td className="py-3 font-semibold text-gray-900 max-w-xs truncate">
                    {q.title}
                  </td>
                  <td className="py-3 text-gray-600">
                    <div>{q.topic}</div>
                    <div className="text-[10px] text-gray-400 capitalize">{q.type}</div>
                  </td>
                  <td className="py-3 font-mono text-gray-700">{q.attemptCount}</td>
                  <td className="py-3">
                    <span
                      className={`font-bold ${
                        q.correctPercentage != null && q.correctPercentage < 35
                          ? 'text-red-700'
                          : q.correctPercentage != null && q.correctPercentage > 75
                          ? 'text-emerald-700'
                          : 'text-gray-800'
                      }`}
                    >
                      {q.correctPercentage != null ? `${q.correctPercentage}%` : 'Not enough data'}
                    </span>
                  </td>
                  <td className="py-3 font-mono">
                    <span className={q.discriminationIndex != null && q.discriminationIndex < 0.25 ? 'text-amber-700 font-bold' : 'text-gray-700'}>
                      {q.discriminationIndex != null ? q.discriminationIndex.toFixed(2) : 'N/A'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {q.flag ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#F7E6B5] border border-amber-300 text-amber-900 font-semibold">
                        <AlertTriangle className="w-3 h-3 text-amber-700" />
                        {q.flag}
                      </span>
                    ) : q.attemptCount > 0 ? (
                      <Badge variant="green">Healthy Distribution</Badge>
                    ) : (
                      <Badge variant="neutral">Not Enough Data</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && displayedQuestions.length === 0 && (
            <div className="py-8 text-center text-xs text-gray-500">
              <div className="font-semibold text-gray-800">No question analytics yet</div>
              <div className="mt-1">Question metrics will appear after students attempt questions.</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
