import { useState } from 'react';
import Modal from './Modal';
import { ActionButton } from './UI';
import Icon from './Icons';

interface ExamSecurityNoticeProps {
  examTitle: string;
  durationMinutes: number;
  questionCount: number;
  passingScore: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ExamSecurityNotice({
  examTitle,
  durationMinutes,
  questionCount,
  passingScore,
  onConfirm,
  onCancel,
}: ExamSecurityNoticeProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const securityRules = [
    {
      icon: 'fullscreen',
      title: 'Fullscreen Enforcement',
      description: 'The exam will run in fullscreen mode. Exiting fullscreen will trigger a warning.',
    },
    {
      icon: 'eye',
      title: 'Tab & Window Switch Detection',
      description: 'Switching to another tab or window is monitored. After 5 switches, your exam will be automatically submitted.',
    },
    {
      icon: 'lock',
      title: 'Context Menu Disabled',
      description: 'Right-click and inspect element are disabled to prevent cheating shortcuts.',
    },
    {
      icon: 'copy',
      title: 'Copy & Paste Disabled',
      description: 'You cannot copy or paste content during the exam. All content must be original.',
    },
    {
      icon: 'clock',
      title: 'Strict Time Controls',
      description: `You will have exactly ${durationMinutes} minutes. The exam auto-submits when time runs out.`,
    },
    {
      icon: 'chartBar',
      title: 'Performance Tracking',
      description: 'Your answer time per question is tracked. Suspiciously fast or slow answers may be flagged for review.',
    },
  ];

  return (
    <Modal
      isOpen
      onClose={() => {}}
      title=""
      subtitle=""
      className="max-w-2xl"
    >
      <div className="p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Icon name="exclamation" className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Exam Security & Integrity Notice</h2>
          <p className="text-gray-600">
            Before you begin <strong>{examTitle}</strong>, you must understand and agree to the security requirements.
          </p>
        </div>

        {/* Exam Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-4 bg-blue-50 rounded-lg">
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Exam Title</p>
            <p className="font-bold text-forest-600 mt-1">{examTitle}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Duration</p>
            <p className="font-bold text-forest-600 mt-1">{durationMinutes} min</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Questions</p>
            <p className="font-bold text-forest-600 mt-1">{questionCount}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Passing Score</p>
            <p className="font-bold text-forest-600 mt-1">{passingScore}%</p>
          </div>
        </div>

        {/* Security Rules */}
        <div className="mb-8">
          <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
            <Icon name="shield" className="w-5 h-5 text-red-600" />
            Security Requirements
          </h3>
          <div className="space-y-3">
            {securityRules.map((rule, idx) => (
              <div
                key={idx}
                className="flex gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-forest-100 flex items-center justify-center">
                    <Icon name={rule.icon as any} className="w-4 h-4 text-forest-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{rule.title}</p>
                  <p className="text-gray-600 text-sm mt-0.5">{rule.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Critical Warnings */}
        <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-600 rounded-r-lg">
          <h4 className="font-bold text-red-700 mb-3 flex items-center gap-2">
            <Icon name="exclamation" className="w-5 h-5" />
            Critical Warnings
          </h4>
          <ul className="space-y-2 text-red-700 text-sm">
            <li className="flex gap-2">
              <span className="font-bold">•</span>
              <span><strong>Do not exit fullscreen.</strong> If you exit, you will receive a warning and must return immediately.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">•</span>
              <span><strong>Maximum 5 tab switches.</strong> On the 5th switch, your exam will be auto-submitted regardless of completion.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">•</span>
              <span><strong>No pausing or restarting.</strong> Once you begin, the exam runs continuously until you submit or time runs out.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">•</span>
              <span><strong>Answer all questions.</strong> Unanswered questions will count as incorrect.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">•</span>
              <span><strong>Violations are logged.</strong> All security events are recorded and may affect your admission status.</span>
            </li>
          </ul>
        </div>

        {/* System Requirements */}
        <div className="mb-8 p-4 bg-gold-50 border border-gold-200 rounded-lg">
          <h4 className="font-bold text-forest-600 mb-3 flex items-center gap-2">
            <Icon name="info" className="w-5 h-5 text-gold-600" />
            System Requirements
          </h4>
          <ul className="space-y-1.5 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <span className="text-forest-500">✓</span> Stable internet connection required
            </li>
            <li className="flex items-center gap-2">
              <span className="text-forest-500">✓</span> Modern browser (Chrome, Firefox, Edge, Safari)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-forest-500">✓</span> Desktop or laptop computer (not mobile)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-forest-500">✓</span> Quiet, distraction-free environment
            </li>
          </ul>
        </div>

        {/* Agreement Checkbox */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="w-5 h-5 mt-1 text-forest-600 rounded accent-forest-600"
            />
            <span className="text-sm text-gray-700">
              <strong>I understand and accept these security requirements.</strong> I confirm that:
              <ul className="mt-2 ml-4 space-y-1 text-gray-600">
                <li>• I will take this exam in a secure environment</li>
                <li>• I will not attempt to circumvent security measures</li>
                <li>• I understand violations may result in exam cancellation or admission denial</li>
                <li>• I will maintain focus and not leave the exam window</li>
              </ul>
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <ActionButton
            variant="secondary"
            onClick={onCancel}
            className="px-6 py-3"
          >
            Cancel
          </ActionButton>
          <ActionButton
            onClick={onConfirm}
            disabled={!agreedToTerms}
            className="px-8 py-3 bg-gradient-to-r from-forest-500 to-forest-400 hover:from-gold-500 hover:to-gold-600 disabled:opacity-50 disabled:cursor-not-allowed"
            icon={<Icon name="exam" className="w-5 h-5" />}
          >
            I Agree & Start Exam
          </ActionButton>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-gray-400 text-center mt-6">
          This exam is monitored for academic integrity. All sessions are recorded and analyzed.
        </p>
      </div>
    </Modal>
  );
}
