import type { ChangeEvent } from 'react';
import Icon from '../../../components/Icons';
import { Input, Select, TextArea } from './AdmissionFormFields';
import { GENDER_OPTIONS } from '../../../utils/constants';
import type { AdmissionForm } from './useAdmissionWizard';

interface Props {
  form: AdmissionForm;
  set: (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  setForm: React.Dispatch<React.SetStateAction<AdmissionForm>>;
  goTo: (n: number) => void;
  errors?: Record<string, string>;
  clearError?: (k: string) => void;
}

export default function StepPersonalInfo({ form, set, setForm, goTo, errors = {}, clearError }: Props) {
  return (
    <div className="gk-section-card p-6">
      <h3 className="text-lg font-bold text-forest-500 mb-1">Step 1: Personal Information</h3>
      <p className="text-gray-500 text-sm mb-6">Provide basic personal details of the student.</p>
      <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="userCircle" className="w-4 h-4" /> Student Details</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Input label="Student First Name" value={form.firstName} onChange={set('firstName')} required placeholder="Juan" maxLength={100} error={errors.firstName} />
        <Input label="Student Last Name" value={form.lastName} onChange={set('lastName')} required placeholder="Dela Cruz" maxLength={100} error={errors.lastName} />
        <Input label="Email Address" type="email" value={form.email} onChange={set('email')} required placeholder="example@email.com" maxLength={255} error={errors.email} />
        <Select label="Sex" value={form.gender} onChange={set('gender')} required options={GENDER_OPTIONS} />
        <Input label="Date of Birth" type="date" value={form.dob} onChange={set('dob')} required error={errors.dob} />
        <Input label="Place of Birth" value={form.placeOfBirth} onChange={set('placeOfBirth')} required placeholder="City/Municipality, Province" maxLength={200} error={errors.placeOfBirth} />
        <Input label="Religion" value={form.religion} onChange={set('religion')} placeholder="Optional" maxLength={100} error={errors.religion} />
        <Input label="Contact Number" type="tel" value={form.phone} onChange={(e: ChangeEvent<HTMLInputElement>) => { const v = e.target.value.replace(/[^0-9+\-\s()]/g, ''); setForm(f => ({ ...f, phone: v })); clearError?.('phone'); }} required placeholder="+63 9XX XXX XXXX" maxLength={20} error={errors.phone} />
      </div>
      <div className="mb-6">
        <TextArea label="Complete Address" value={form.address} onChange={set('address')} required placeholder="Street, Barangay, Municipality/City, Province, ZIP Code" rows={3} maxLength={500} error={errors.address} />
      </div>
      <div className="flex justify-end">
        <button onClick={() => goTo(2)} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600">Next: School Info</button>
      </div>
    </div>
  );
}
