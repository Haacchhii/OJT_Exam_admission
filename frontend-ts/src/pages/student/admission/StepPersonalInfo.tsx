import type { ChangeEvent } from 'react';
import Icon from '../../../components/Icons';
import { Input, Select } from './AdmissionFormFields';
import { GENDER_OPTIONS, GUARDIAN_RELATIONS } from '../../../utils/constants';
import type { AdmissionForm } from './useAdmissionWizard';

interface Props {
  form: AdmissionForm;
  set: (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  setForm: React.Dispatch<React.SetStateAction<AdmissionForm>>;
  goTo: (n: number) => void;
}

export default function StepPersonalInfo({ form, set, setForm, goTo }: Props) {
  return (
    <div className="gk-card p-6">
      <h3 className="text-lg font-bold text-forest-500 mb-1">Step 1: Personal Information</h3>
      <p className="text-gray-500 text-sm mb-6">Provide basic personal details of the student.</p>
      <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="userCircle" className="w-4 h-4" /> Student Details</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Input label="First Name" value={form.firstName} onChange={set('firstName')} required placeholder="Juan" />
        <Input label="Last Name" value={form.lastName} onChange={set('lastName')} required placeholder="Dela Cruz" />
        <Input label="Email Address" type="email" value={form.email} onChange={set('email')} required placeholder="example@email.com" />
        <Input label="Phone Number" type="tel" value={form.phone} onChange={(e: ChangeEvent<HTMLInputElement>) => { const v = e.target.value.replace(/[^0-9+\-\s()]/g, ''); setForm(f => ({ ...f, phone: v })); }} placeholder="+63 9XX XXX XXXX" />
        <Input label="Date of Birth" type="date" value={form.dob} onChange={set('dob')} required />
        <Select label="Gender" value={form.gender} onChange={set('gender')} required options={GENDER_OPTIONS} />
        <div className="md:col-span-2">
          <Input label="Home Address" value={form.address} onChange={set('address')} required placeholder="Street, Barangay, Municipality, Province" />
        </div>
      </div>
      <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="users" className="w-4 h-4" /> Parent / Guardian Details</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Input label="Parent / Guardian Full Name" value={form.guardian} onChange={set('guardian')} required placeholder="Full name" />
        <Select label="Relationship to Student" value={form.guardianRelation} onChange={set('guardianRelation')} required options={GUARDIAN_RELATIONS} />
        <Input label="Parent / Guardian Contact No." type="tel" value={form.guardianPhone} onChange={(e: ChangeEvent<HTMLInputElement>) => { const v = e.target.value.replace(/[^0-9+\-\s()]/g, ''); setForm(f => ({ ...f, guardianPhone: v })); }} required placeholder="+63 9XX XXX XXXX" />
        <Input label="Parent / Guardian Email" type="email" value={form.guardianEmail} onChange={set('guardianEmail')} placeholder="parent@email.com" />
      </div>
      <div className="flex justify-end">
        <button onClick={() => goTo(2)} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600">Next: School Info →</button>
      </div>
    </div>
  );
}
