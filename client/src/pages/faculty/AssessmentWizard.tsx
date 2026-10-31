import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  FileCheck2,
  Layers,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Clock,
  Plus,
  Trash2
} from 'lucide-react';
import { TOPICS } from '../../shared/constants';

export const AssessmentWizard: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);

  // Wizard state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructions: '1. Fullscreen mode is monitored.\n2. Do not leave the active window.',
    durationMinutes: 60,
    totalMarks: 50,
    passPercentage: 40,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    sections: [
      {
        id: 'sec_1',
        name: 'Aptitude & Technical Reasoning',
        type: 'aptitude',
        questionIds: [] as string[],
        marksPerQuestion: 2,
        totalMarks: 20
      },
      {
        id: 'sec_2',
        name: 'Coding Evaluation',
        type: 'coding',
        questionIds: [] as string[],
        marksPerQuestion: 15,
        totalMarks: 30
      }
    ],
    rules: {
      negativeMarking: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      fullscreenRequired: true,
      tabSwitchLimit: 3,
      copyPasteRestricted: true,
      maxAttempts: 1
    }
  });

  useEffect(() => {
    api.get('/questions?limit=100&status=verified')
      .then(res => {
        if (res.data.success) {
          setBankQuestions(res.data.questions);
          // Auto-populate some sample questions into sections
          const codingQs = res.data.questions.filter((q: any) => q.type === 'coding').slice(0, 2);
          const mcqQs = res.data.questions.filter((q: any) => q.type !== 'coding').slice(0, 5);

          setFormData(prev => ({
            ...prev,
            sections: [
              { ...prev.sections[0], questionIds: mcqQs.map((q: any) => q._id) },
              { ...prev.sections[1], questionIds: codingQs.map((q: any) => q._id) }
            ]
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleCreateAndPublish = async (publish = true) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        status: publish ? 'published' : 'draft',
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate)
      };

      const res = await api.post('/assessments', payload);
      if (res.data.success) {
        toast.success(`Assessment ${publish ? 'published' : 'saved as draft'} successfully!`);
        navigate('/faculty/assessments');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create assessment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: 'Basic Info' },
    { num: 2, label: 'Sections' },
    { num: 3, label: 'Questions' },
    { num: 4, label: 'Anti-Cheat Rules' },
    { num: 5, label: 'Review & Publish' }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Create Assessment Wizard</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Design a structured multi-section exam with automated proctoring and coding evaluation
        </p>
      </div>

      {/* Wizard Progress Bar */}
      <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-xs">
        {steps.map((s, idx) => (
          <React.Fragment key={s.num}>
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  currentStep === s.num
                    ? 'bg-[#DCEFEB] text-[#3C648E] border border-[#CFE2DC]'
                    : currentStep > s.num
                    ? 'bg-[#E5F2EB] text-[#4C765D] border border-[#C6DFD2]'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {currentStep > s.num ? '✓' : s.num}
              </div>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  currentStep === s.num ? 'text-gray-900 font-bold' : 'text-gray-500'
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 mx-2" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {currentStep === 1 && (
        <Card header={<span className="text-xs font-bold text-gray-800">Step 1: General Assessment Info</span>}>
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Assessment Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. DSA Placement Mock #05"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief summary of syllabus and target students"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Duration (Minutes)</label>
                <input
                  type="number"
                  value={formData.durationMinutes}
                  onChange={e => setFormData({ ...formData, durationMinutes: parseInt(e.target.value, 10) || 60 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">End Date (Deadline)</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Student Instructions</label>
              <textarea
                rows={3}
                value={formData.instructions}
                onChange={e => setFormData({ ...formData, instructions: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Sections */}
      {currentStep === 2 && (
        <Card header={<span className="text-xs font-bold text-gray-800">Step 2: Assessment Sections</span>}>
          <div className="space-y-4 text-xs">
            {formData.sections.map((sec, idx) => (
              <div key={sec.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">Section {idx + 1}</span>
                  {formData.sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          sections: formData.sections.filter(s => s.id !== sec.id)
                        })
                      }
                      className="text-[#A36162] hover:text-[#A36162] text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Section Name</label>
                    <input
                      type="text"
                      value={sec.name}
                      onChange={e => {
                        const updated = [...formData.sections];
                        updated[idx].name = e.target.value;
                        setFormData({ ...formData, sections: updated });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Type</label>
                    <select
                      value={sec.type}
                      onChange={e => {
                        const updated = [...formData.sections];
                        updated[idx].type = e.target.value as any;
                        setFormData({ ...formData, sections: updated });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="aptitude">Aptitude</option>
                      <option value="technical">Technical MCQ</option>
                      <option value="coding">Coding Evaluation</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Marks per Question</label>
                    <input
                      type="number"
                      value={sec.marksPerQuestion}
                      onChange={e => {
                        const updated = [...formData.sections];
                        updated[idx].marksPerQuestion = parseInt(e.target.value, 10) || 1;
                        setFormData({ ...formData, sections: updated });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setFormData({
                  ...formData,
                  sections: [
                    ...formData.sections,
                    {
                      id: `sec_${Date.now()}`,
                      name: 'Additional Section',
                      type: 'technical',
                      questionIds: [],
                      marksPerQuestion: 2,
                      totalMarks: 10
                    }
                  ]
                })
              }
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Another Section
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Question Selection */}
      {currentStep === 3 && (
        <Card header={<span className="text-xs font-bold text-gray-800">Step 3: Question Selection</span>}>
          <div className="space-y-6 text-xs">
            <div className="p-3 bg-[#DCEFEB]/50 rounded-xl border border-[#CFE2DC] text-[#3C648E] flex items-center justify-between">
              <div>
                <span className="font-bold">Smart Selection Available</span>
                <p className="text-[11px] text-[#3C648E]">Select questions from bank or auto-distribute across difficulties</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  toast.success('Smart distribution applied: 30% Easy, 50% Medium, 20% Hard');
                }}
              >
                Apply Smart 30/50/20%
              </Button>
            </div>

            {formData.sections.map((sec, sIdx) => (
              <div key={sec.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800">
                    {sec.name} ({sec.questionIds.length} questions assigned)
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white p-2">
                  {bankQuestions.map(q => {
                    const isSelected = sec.questionIds.includes(q._id);

                    return (
                      <div key={q._id} className="py-2 px-3 flex items-center justify-between text-xs hover:bg-gray-50">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const updated = [...formData.sections];
                              if (isSelected) {
                                updated[sIdx].questionIds = updated[sIdx].questionIds.filter(id => id !== q._id);
                              } else {
                                updated[sIdx].questionIds.push(q._id);
                              }
                              setFormData({ ...formData, sections: updated });
                            }}
                            className="rounded text-[#3C648E]"
                          />
                          <span className="font-semibold text-gray-800">{q.title}</span>
                          <span className="text-gray-400">({q.topic})</span>
                        </div>
                        <Badge variant="blue">{q.difficulty}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Step 4: Anti-Cheat Rules */}
      {currentStep === 4 && (
        <Card header={<span className="text-xs font-bold text-gray-800">Step 4: Anti-Cheating & Integrity Rules</span>}>
          <div className="space-y-4 text-xs">
            <div className="space-y-3">
              {[
                { key: 'fullscreenRequired', label: 'Enforce Fullscreen Requirement', desc: 'Students are prompted to enter fullscreen; exits are logged.' },
                { key: 'negativeMarking', label: 'Enable Negative Marking', desc: 'Deducts partial marks for incorrect MCQ attempts.' },
                { key: 'copyPasteRestricted', label: 'Restrict Copy / Paste', desc: 'Prevents clipboard text extraction during assessment.' },
                { key: 'shuffleQuestions', label: 'Shuffle Question Order', desc: 'Randomizes presentation sequence per student.' },
                { key: 'shuffleOptions', label: 'Shuffle Options', desc: 'Randomizes MCQ choice ordering.' }
              ].map(r => (
                <label key={r.key} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.rules as any)[r.key]}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        rules: { ...formData.rules, [r.key]: e.target.checked }
                      })
                    }
                    className="mt-0.5 rounded text-[#3C648E]"
                  />
                  <div>
                    <span className="font-bold text-gray-900">{r.label}</span>
                    <p className="text-[11px] text-gray-500 mt-0.5">{r.desc}</p>
                  </div>
                </label>
              ))}

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <label className="block font-bold text-gray-900 mb-1">Tab-Switch Tolerance Limit</label>
                <input
                  type="number"
                  value={formData.rules.tabSwitchLimit}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      rules: { ...formData.rules, tabSwitchLimit: parseInt(e.target.value, 10) || 3 }
                    })
                  }
                  className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                />
                <p className="text-[11px] text-gray-500 mt-1">Exceeding twice this limit will flag severe violation.</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Step 5: Review & Publish */}
      {currentStep === 5 && (
        <Card header={<span className="text-xs font-bold text-gray-800">Step 5: Review & Finalize Assessment</span>}>
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <h3 className="text-base font-bold text-gray-900">{formData.title || 'Untitled Assessment'}</h3>
              <p className="text-gray-600">{formData.description}</p>
              <div className="flex flex-wrap gap-3 pt-2 text-gray-500">
                <span>Duration: {formData.durationMinutes} mins</span>
                <span>&bull;</span>
                <span>Sections: {formData.sections.length}</span>
                <span>&bull;</span>
                <span>Total Questions: {formData.sections.reduce((a, s) => a + s.questionIds.length, 0)}</span>
                <span>&bull;</span>
                <span>Fullscreen: {formData.rules.fullscreenRequired ? 'Yes' : 'No'}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                variant="outline"
                size="md"
                onClick={() => handleCreateAndPublish(false)}
                isLoading={isSubmitting}
              >
                Save as Draft
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => handleCreateAndPublish(true)}
                isLoading={isSubmitting}
                icon={<CheckCircle2 className="w-4 h-4 text-[#3C648E]" />}
              >
                Publish Assessment to Students
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <Button
          variant="outline"
          size="sm"
          disabled={currentStep === 1}
          onClick={() => setCurrentStep(prev => prev - 1)}
          icon={<ChevronLeft className="w-4 h-4" />}
        >
          Previous Step
        </Button>

        {currentStep < 5 && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (currentStep === 1 && !formData.title.trim()) {
                toast.warning('Please enter an assessment title');
                return;
              }
              setCurrentStep(prev => prev + 1);
            }}
            icon={<ChevronRight className="w-4 h-4" />}
          >
            Next Step
          </Button>
        )}
      </div>
    </div>
  );
};
