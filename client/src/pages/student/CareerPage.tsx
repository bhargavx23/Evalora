import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { ArrowRight, CheckCircle2, FileSearch, TrendingUp, UserRound } from 'lucide-react';

export const CareerPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const toast = useToast();

  const load = () =>
    api
      .get('/profile')
      .then(res => setData(res.data))
      .catch(err => toast.error(err.response?.data?.message || 'Unable to load career workspace'))
      .finally(() => setIsLoading(false));

  useEffect(() => {
    load();
  }, []);

  const analyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await api.post('/profile/resume/analyze');
      toast.success(res.data.message);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Resume analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-shell">
        <Card>
          <div className="h-40 animate-pulse rounded bg-[#F5F5F7]" />
        </Card>
      </div>
    );
  }

  const analysis = data?.resume?.analysis;

  return (
    <div className="page-shell">
      <header className="border-b border-[#D2D2D7] pb-7">
        <p className="page-kicker">Career Readiness</p>
        <h1 className="page-title display-heading text-4xl text-[#1D1D1F]">
          Build a stronger professional profile.
        </h1>
        <p className="page-copy">
          Turn your real Evalora performance and experience into a clearer next step. No invented scores or achievements.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        <Card pastelAccent="blue">
          <div className="flex items-center justify-between">
            <UserRound className="h-5 w-5 text-[#007AFF]" />
            <Badge variant="blue">Profile</Badge>
          </div>
          <p className="mt-7 text-4xl font-semibold text-[#1D1D1F]">{data?.completion?.percentage ?? 0}%</p>
          <p className="mt-1 text-sm text-[#6E6E73]">Profile completion</p>
          <Button
            className="mt-6 w-full"
            variant="outline"
            onClick={() => navigate('/profile')}
            icon={<ArrowRight className="h-4 w-4" />}
          >
            Complete profile
          </Button>
        </Card>

        <Card pastelAccent="mint">
          <div className="flex items-center justify-between">
            <FileSearch className="h-5 w-5 text-[#4C765D]" />
            <Badge variant={analysis ? 'green' : 'neutral'}>
              {analysis ? 'Analyzed' : 'Not analyzed'}
            </Badge>
          </div>
          {analysis ? (
            <>
              <p className="mt-7 text-4xl font-semibold text-[#1D1D1F]">
                {analysis.score}
                <span className="text-lg text-[#6E6E73]">/100</span>
              </p>
              <p className="mt-1 text-sm text-[#6E6E73]">Evalora ATS compatibility estimate</p>
            </>
          ) : (
            <>
              <p className="mt-7 text-lg font-semibold text-[#1D1D1F]">No estimate yet</p>
              <p className="mt-1 text-sm text-[#6E6E73]">
                Upload and analyze your resume to get a document-based estimate.
              </p>
            </>
          )}
          <Button
            className="mt-6 w-full"
            variant="accent"
            onClick={analysis ? analyze : () => navigate('/profile')}
            isLoading={isAnalyzing}
          >
            {analysis ? 'Analyze again' : 'Upload resume'}
          </Button>
        </Card>

        <Card pastelAccent="purple">
          <div className="flex items-center justify-between">
            <TrendingUp className="h-5 w-5 text-[#007AFF]" />
            <Badge variant="purple">Evidence-based</Badge>
          </div>
          <p className="mt-7 text-lg font-semibold text-[#1D1D1F]">Skill signal</p>
          <p className="mt-1 text-sm leading-6 text-[#6E6E73]">
            Your career profile combines demonstrated assessment and practice performance with the experience you document.
          </p>
          <Button
            className="mt-6 w-full"
            variant="outline"
            onClick={() => navigate('/skills')}
          >
            View skill profile
          </Button>
        </Card>
      </section>

      {analysis ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <Card
            header={
              <div>
                <h2 className="text-sm font-semibold text-[#1D1D1F]">ATS compatibility estimate</h2>
                <p className="mt-1 text-xs text-[#6E6E73]">
                  This is Evalora's estimate based on structure, keywords, readability, and detected sections. It is not an official universal ATS score.
                </p>
              </div>
            }
          >
            <div className="flex items-end gap-2">
              <span className="text-6xl font-semibold tracking-tight text-[#1D1D1F]">{analysis.score}</span>
              <span className="pb-2 text-[#6E6E73]">/ 100</span>
            </div>
            <div className="mt-6 space-y-3">
              {Object.entries(analysis.scoreBreakdown || {}).map(([key, value]) => (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="capitalize text-[#6E6E73]">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <span className="font-medium text-[#1D1D1F]">{String(value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#F5F5F7]">
                    <div
                      className="h-full rounded-full bg-[#007AFF]"
                      style={{ width: `${Math.min(100, Number(value) * 5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            header={
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#1D1D1F]">Priority recommendations</span>
                <Badge variant="amber">{analysis.recommendations?.length || 0} found</Badge>
              </div>
            }
          >
            {analysis.recommendations?.length ? (
              <div className="divide-y divide-[#D2D2D7]">
                {analysis.recommendations.map((item: any, index: number) => (
                  <div key={`${item.category}-${index}`} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-[#1D1D1F]">{item.problem}</span>
                      <Badge
                        variant={
                          item.priority === 'high'
                            ? 'rose'
                            : item.priority === 'medium'
                            ? 'amber'
                            : 'neutral'
                        }
                      >
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#6E6E73]">
                      <strong>Why it matters:</strong> {item.whyItMatters}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[#1D1D1F]">
                      <strong>Recommendation:</strong> {item.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="h-7 w-7 text-[#4C765D]" />}
                title="No document problems detected"
                description="The current analysis did not identify additional recommendations."
              />
            )}
          </Card>
        </section>
      ) : (
        <Card>
          <EmptyState
            icon={<FileSearch className="h-8 w-8 text-[#007AFF]" />}
            title="Upload a resume to unlock career insights"
            description="Evalora analyzes the actual text and structure of your PDF or DOCX without inventing phantom scores."
            action={<Button onClick={() => navigate('/profile')}>Go to Profile</Button>}
          />
        </Card>
      )}
    </div>
  );
};
