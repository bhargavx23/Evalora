import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TOPICS, DEFAULT_STARTER_CODES } from '../../shared/constants';
import { DifficultyLevel, QuestionType } from '../../shared/types';
import { Plus, Trash2, ArrowRight } from 'lucide-react';

export const CreateQuestion: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [type, setType] = useState<QuestionType>('mcq');
  const [topic, setTopic] = useState('Arrays');
  const [subtopic, setSubtopic] = useState('General');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [marks, setMarks] = useState(2);
  const [negativeMarks, setNegativeMarks] = useState(0.5);
  const [explanation, setExplanation] = useState('');

  // MCQ Options
  const [options, setOptions] = useState([
    { id: 'opt_1', text: '', isCorrect: true },
    { id: 'opt_2', text: '', isCorrect: false },
    { id: 'opt_3', text: '', isCorrect: false },
    { id: 'opt_4', text: '', isCorrect: false }
  ]);

  // Coding Details
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [constraints, setConstraints] = useState('');
  const [visibleTestCases, setVisibleTestCases] = useState([
    { input: '', expectedOutput: '' }
  ]);
  const [hiddenTestCases, setHiddenTestCases] = useState([
    { input: '', expectedOutput: '' }
  ]);

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      toast.warning('Please provide question title and description');
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = {
        title,
        description,
        type,
        topic,
        subtopic,
        difficulty,
        marks,
        negativeMarks,
        explanation,
        status: 'verified'
      };

      if (type === 'coding') {
        payload.codingDetails = {
          supportedLanguages: ['c', 'cpp', 'python', 'java'],
          starterCode: DEFAULT_STARTER_CODES,
          inputFormat,
          outputFormat,
          constraints,
          examples: [{ input: visibleTestCases[0]?.input || '', output: visibleTestCases[0]?.expectedOutput || '', explanation: '' }],
          visibleTestCases,
          hiddenTestCases,
          timeLimitMs: 3000,
          memoryLimitMb: 256
        };
      } else {
        payload.options = options;
      }

      const res = await api.post('/questions', payload);
      if (res.data.success) {
        toast.success('Question added to verified bank!');
        navigate('/faculty/questions');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create question');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Create New Question</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Author a custom assessment question with test cases and pedagogical explanation
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        <Card header={<span className="text-xs font-bold text-gray-800">1. Metadata & Classification</span>}>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Question Type</label>
              <select
                value={type}
                onChange={e => {
                  const newType = e.target.value as QuestionType;
                  setType(newType);
                  setMarks(newType === 'coding' ? 15 : 2);
                  setNegativeMarks(newType === 'coding' ? 0 : 0.5);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="mcq">Multiple Choice (Single)</option>
                <option value="multiple_select">Multiple Select</option>
                <option value="coding">Coding Problem</option>
                <option value="true_false">True / False</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Topic</label>
              <select
                value={topic}
                onChange={e => setTopic(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                {TOPICS.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Subtopic</label>
              <input
                type="text"
                value={subtopic}
                onChange={e => setSubtopic(e.target.value)}
                placeholder="e.g. Sliding Window"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
        </Card>

        <Card header={<span className="text-xs font-bold text-gray-800">2. Statement & Details</span>}>
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Concise problem headline"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Detailed Description</label>
              <textarea
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Full problem text..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Marks</label>
                <input
                  type="number"
                  value={marks}
                  onChange={e => setMarks(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Negative Marks</label>
                <input
                  type="number"
                  step="0.25"
                  value={negativeMarks}
                  onChange={e => setNegativeMarks(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        </Card>

        {type === 'coding' ? (
          <Card header={<span className="text-xs font-bold text-gray-800">3. Coding Specifications & Test Cases</span>}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Input Format</label>
                  <input
                    type="text"
                    value={inputFormat}
                    onChange={e => setInputFormat(e.target.value)}
                    placeholder="e.g. First line contains N"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Output Format</label>
                  <input
                    type="text"
                    value={outputFormat}
                    onChange={e => setOutputFormat(e.target.value)}
                    placeholder="e.g. Print single integer"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Constraints</label>
                  <input
                    type="text"
                    value={constraints}
                    onChange={e => setConstraints(e.target.value)}
                    placeholder="1 <= N <= 10^5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Visible Test Cases */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="font-bold text-gray-800">Visible Sample Test Cases:</span>
                {visibleTestCases.map((tc, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-2">
                    <textarea
                      rows={2}
                      value={tc.input}
                      onChange={e => {
                        const updated = [...visibleTestCases];
                        updated[idx].input = e.target.value;
                        setVisibleTestCases(updated);
                      }}
                      placeholder="Input..."
                      className="p-2 border border-gray-300 rounded-lg font-mono text-xs"
                    />
                    <textarea
                      rows={2}
                      value={tc.expectedOutput}
                      onChange={e => {
                        const updated = [...visibleTestCases];
                        updated[idx].expectedOutput = e.target.value;
                        setVisibleTestCases(updated);
                      }}
                      placeholder="Expected Output..."
                      className="p-2 border border-gray-300 rounded-lg font-mono text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* Hidden Test Cases */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="font-bold text-gray-800">Hidden Evaluation Test Cases:</span>
                {hiddenTestCases.map((tc, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-2">
                    <textarea
                      rows={2}
                      value={tc.input}
                      onChange={e => {
                        const updated = [...hiddenTestCases];
                        updated[idx].input = e.target.value;
                        setHiddenTestCases(updated);
                      }}
                      placeholder="Hidden Input..."
                      className="p-2 border border-gray-300 rounded-lg font-mono text-xs"
                    />
                    <textarea
                      rows={2}
                      value={tc.expectedOutput}
                      onChange={e => {
                        const updated = [...hiddenTestCases];
                        updated[idx].expectedOutput = e.target.value;
                        setHiddenTestCases(updated);
                      }}
                      placeholder="Expected Output..."
                      className="p-2 border border-gray-300 rounded-lg font-mono text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : (
          <Card header={<span className="text-xs font-bold text-gray-800">3. Answer Choices</span>}>
            <div className="space-y-2.5">
              {options.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={opt.isCorrect}
                    onChange={() => {
                      setOptions(options.map(o => ({ ...o, isCorrect: o.id === opt.id })));
                    }}
                    className="text-[#0056CC]"
                  />
                  <input
                    type="text"
                    value={opt.text}
                    onChange={e => {
                      const updated = [...options];
                      updated[idx].text = e.target.value;
                      setOptions(updated);
                    }}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card header={<span className="text-xs font-bold text-gray-800">4. Pedagogical Explanation</span>}>
          <textarea
            rows={3}
            value={explanation}
            onChange={e => setExplanation(e.target.value)}
            placeholder="Explain why the solution is correct for student review..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="md" onClick={() => navigate('/faculty/questions')}>
            Cancel
          </Button>
          <Button variant="primary" size="md" type="submit" isLoading={isLoading}>
            Add Question to Bank
          </Button>
        </div>
      </form>
    </div>
  );
};
