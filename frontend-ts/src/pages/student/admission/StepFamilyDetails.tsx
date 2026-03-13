import type { ChangeEvent } from 'react';
import Icon from '../../../components/Icons';
import { Input } from './AdmissionFormFields';
import type { AdmissionForm } from './useAdmissionWizard';

interface Props {
  form: AdmissionForm;
  set: (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  goTo: (n: number) => void;
  errors?: Record<string, string>;
}

export default function StepFamilyDetails({ form, set, goTo, errors = {} }: Props) {
  return (
    <div className="gk-card p-6">
      <h3 className="text-lg font-bold text-forest-500 mb-1">Step 3: Family Details</h3>
      <p className="text-gray-500 text-sm mb-6">Provide information about the student&apos;s parents or guardian.</p>
      <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="users" className="w-4 h-4" /> Parent Information</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Input
          label="Father's Name & Occupation"
          value={form.fatherNameOccupation}
          onChange={set('fatherNameOccupation')}
          required
          placeholder="e.g. Juan Dela Cruz, Engineer"
          maxLength={200}
          error={errors.fatherNameOccupation}
        />
        <Input
          label="Mother's Name & Occupation"
          value={form.motherNameOccupation}
          onChange={set('motherNameOccupation')}
          required
          placeholder="e.g. Maria Dela Cruz, Teacher"
          maxLength={200}
          error={errors.motherNameOccupation}
        />
        <div className="md:col-span-2">
          <Input
            label="Guardian Name (if applicable)"
            value={form.guardian}
            onChange={set('guardian')}
            placeholder="Leave blank if parents are the guardians"
            maxLength={200}
            error={errors.guardian}
          />
        </div>
      </div>
      <div className="flex justify-between">
        <button onClick={() => goTo(2)} className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50">← Back</button>
        <button onClick={() => goTo(4)} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600">Next: Documents →</button>
      </div>
    </div>
  );
}
