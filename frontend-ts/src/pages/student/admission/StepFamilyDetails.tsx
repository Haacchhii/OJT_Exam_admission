import type { ChangeEvent } from 'react';
import Icon from '../../../components/Icons';
import { ActionButton } from '../../../components/UI';
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
    <div className="gk-section-card p-6">
      <h3 className="text-lg font-bold text-forest-500 mb-1">Step 3: Family Details</h3>
      <p className="text-gray-500 text-sm mb-6">Provide information about the student&apos;s parents or guardian.</p>
      <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="users" className="w-4 h-4" /> Parent Information</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Input
          label="Father's Full Name"
          value={form.fatherName}
          onChange={set('fatherName')}
          required
          placeholder="e.g. Juan Dela Cruz"
          maxLength={200}
          error={errors.fatherName}
        />
        <Input
          label="Father's Occupation"
          value={form.fatherOccupation}
          onChange={set('fatherOccupation')}
          required
          placeholder="e.g. Engineer"
          maxLength={120}
          error={errors.fatherOccupation}
        />
        <Input
          label="Mother's Full Name"
          value={form.motherName}
          onChange={set('motherName')}
          required
          placeholder="e.g. Maria Dela Cruz"
          maxLength={200}
          error={errors.motherName}
        />
        <Input
          label="Mother's Occupation"
          value={form.motherOccupation}
          onChange={set('motherOccupation')}
          required
          placeholder="e.g. Teacher"
          maxLength={120}
          error={errors.motherOccupation}
        />
        <div className="md:col-span-2">
          <Input
            label="Guardian Name (Optional, if applicable)"
            value={form.guardian}
            onChange={set('guardian')}
            placeholder="Leave blank if parents are the guardians"
            maxLength={200}
            error={errors.guardian}
          />
        </div>
        <Input
          label="Guardian Relationship"
          value={form.guardianRelation}
          onChange={set('guardianRelation')}
          placeholder={form.guardian?.trim() ? 'e.g. Aunt, Uncle, Grandparent' : 'Required only if guardian name is provided'}
          maxLength={100}
          error={errors.guardianRelation}
        />
      </div>
      <div className="flex justify-between">
        <ActionButton variant="secondary" onClick={() => goTo(2)} className="px-5 py-2.5">Back</ActionButton>
        <ActionButton onClick={() => goTo(4)} className="px-6 py-2.5 bg-gradient-to-r from-forest-500 to-forest-400 hover:from-gold-500 hover:to-gold-600">Next: Documents</ActionButton>
      </div>
    </div>
  );
}
