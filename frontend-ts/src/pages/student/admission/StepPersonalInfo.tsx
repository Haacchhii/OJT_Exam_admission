import type { ChangeEvent } from 'react';
import Icon from '../../../components/Icons';
import { ActionButton } from '../../../components/UI';
import { Input, Select } from './AdmissionFormFields';
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Input label="Student First Name" value={form.firstName} onChange={set('firstName')} required placeholder="Juan" maxLength={100} error={errors.firstName} />
        <div>
          <Input
            label="Student Middle Name"
            value={form.middleName}
            onChange={set('middleName')}
            placeholder="Santos"
            maxLength={100}
            error={errors.middleName}
            disabled={form.noMiddleName}
          />
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.noMiddleName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const checked = e.target.checked;
                setForm(f => ({ ...f, noMiddleName: checked, middleName: checked ? '' : f.middleName }));
                clearError?.('middleName');
              }}
              className="accent-forest-500"
            />
            No middle name
          </label>
        </div>
        <Input label="Student Surname" value={form.lastName} onChange={set('lastName')} required placeholder="Dela Cruz" maxLength={100} error={errors.lastName} />
        <Input label="Email Address" type="email" value={form.email} onChange={set('email')} required placeholder="example@email.com" maxLength={255} error={errors.email} />
        <Select label="Sex" value={form.gender} onChange={set('gender')} required options={GENDER_OPTIONS} />
        <Input label="Date of Birth" type="date" value={form.dob} onChange={set('dob')} required error={errors.dob} />
        <Input label="Place of Birth" value={form.placeOfBirth} onChange={set('placeOfBirth')} required placeholder="City/Municipality, Province" maxLength={200} error={errors.placeOfBirth} />
        <Input label="Religion (Optional)" value={form.religion} onChange={set('religion')} placeholder="Roman Catholic" maxLength={100} error={errors.religion} />
        <Input label="Applicant's Phone Number" type="tel" value={form.phone} onChange={(e: ChangeEvent<HTMLInputElement>) => { const v = e.target.value.replace(/[^0-9+\-\s()]/g, ''); setForm(f => ({ ...f, phone: v })); clearError?.('phone'); }} required placeholder="+63 9XX XXX XXXX" maxLength={20} error={errors.phone} />
      </div>

      <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="location" className="w-4 h-4" /> Home Address</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Input label="House No. / Street / Subdivision" value={form.addressStreet} onChange={set('addressStreet')} required placeholder="Block/Lot/Street" maxLength={200} error={errors.addressStreet} />
        <Input label="Barangay" value={form.addressBarangay} onChange={set('addressBarangay')} required placeholder="Barangay name" maxLength={120} error={errors.addressBarangay} />
        <Input label="City / Municipality" value={form.addressCityMunicipality} onChange={set('addressCityMunicipality')} required placeholder="City or municipality" maxLength={120} error={errors.addressCityMunicipality} />
        <Input label="Province" value={form.addressProvince} onChange={set('addressProvince')} required placeholder="Province" maxLength={120} error={errors.addressProvince} />
        <Input label="ZIP Code (Optional)" value={form.addressZipCode} onChange={(e: ChangeEvent<HTMLInputElement>) => { const v = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, addressZipCode: v })); clearError?.('addressZipCode'); }} placeholder="4211" maxLength={10} inputMode="numeric" pattern="[0-9]*" error={errors.addressZipCode} className="md:col-span-2" />
      </div>
      <div className="flex justify-end">
        <ActionButton onClick={() => goTo(2)} className="px-6 py-2.5 bg-gradient-to-r from-forest-500 to-forest-400 hover:from-gold-500 hover:to-gold-600">Next: School Info</ActionButton>
      </div>
    </div>
  );
}
