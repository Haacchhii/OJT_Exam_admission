import Icon from '../../../components/Icons';
import { ActionButton } from '../../../components/UI';
import { UploadSlot } from './AdmissionFormFields';
import { DOC_SLOT_LABELS } from '../../../utils/constants';
import type { SlotFiles } from './useAdmissionWizard';

interface Props {
  form: { gradeLevel: string };
  requiredDocs: string[];
  optionalDocs: string[];
  slotFiles: SlotFiles;
  extraFiles: File[];
  goTo: (n: number) => void;
  handleSlotFile: (slot: string, file: File) => void;
  handleExtraFiles: (files: FileList | null) => void;
  removeSlot: (slot: string) => void;
  removeExtra: (index: number) => void;
}

export default function StepDocuments({ form, requiredDocs, optionalDocs, slotFiles, extraFiles, goTo, handleSlotFile, handleExtraFiles, removeSlot, removeExtra }: Props) {
  return (
    <div className="gk-section-card p-6">
      <h3 className="text-lg font-bold text-forest-500 mb-1">Step 4: Required Documents</h3>
      <p className="text-gray-500 text-sm mb-2">Upload the documents required for <strong>{form.gradeLevel || 'your grade level'}</strong>.</p>
      <p className="text-sm text-gray-500 mb-6">Accepted formats: PDF, JPG, JPEG, PNG, WEBP.</p>
      <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="document" className="w-4 h-4" /> Required Documents</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {requiredDocs.map(docKey => (
          <UploadSlot key={docKey} label={`File: ${(DOC_SLOT_LABELS as Record<string, string>)[docKey]}`} required slot={docKey} file={slotFiles[docKey]} onFile={handleSlotFile} onRemove={removeSlot} />
        ))}
      </div>

      {optionalDocs.length > 0 && (
        <>
          <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="info" className="w-4 h-4" /> Optional (If Applicable)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {optionalDocs.map(docKey => (
              <UploadSlot key={docKey} label={`Optional: ${(DOC_SLOT_LABELS as Record<string, string>)[docKey]}`} slot={docKey} file={slotFiles[docKey]} onFile={handleSlotFile} onRemove={removeSlot} />
            ))}
          </div>
        </>
      )}
      <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="checkCircle" className="w-4 h-4" /> Document Checklist</h4>
      <div className="space-y-2 mb-6">
        {requiredDocs.map(docKey => (
          <div key={docKey} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${slotFiles[docKey] ? 'bg-forest-50 text-forest-700' : 'bg-red-50 text-red-500'}`}>
            {slotFiles[docKey] ? <Icon name="checkCircle" className="w-4 h-4" /> : <Icon name="exclamation" className="w-4 h-4" />} {(DOC_SLOT_LABELS as Record<string, string>)[docKey]} - <span className="text-sm">{slotFiles[docKey] ? 'Uploaded' : 'Not yet uploaded'}</span>
          </div>
        ))}
      </div>
      <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="upload" className="w-4 h-4" /> Other Supporting Files (Optional)</h4>
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gold-400 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => document.getElementById('extraFileInput')?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            document.getElementById('extraFileInput')?.click();
          }
        }}
        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-gold-400'); }}
        onDragLeave={e => e.currentTarget.classList.remove('border-gold-400')}
        onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-gold-400'); handleExtraFiles(e.dataTransfer.files); }}
        role="button"
        tabIndex={0}
        aria-label="Upload additional files. Press Enter or Space to select files, or drag and drop."
      >
        <Icon name="upload" className="w-8 h-8 text-gray-400" />
        <p className="text-gray-500 mt-2">Drag & drop files here or <span className="text-forest-500 font-medium">browse</span></p>
        <p className="text-sm text-gray-500 mt-1">Medical records, recommendation letters, other certificates</p>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        Press Enter or Space to upload additional files, or drag and drop files here
      </div>
      <input id="extraFileInput" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={e => { handleExtraFiles(e.target.files); e.target.value = ''; }} aria-hidden="true" />
      {extraFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {extraFiles.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm">
              <span>File: {f.name} <span className="text-gray-500 text-sm">({(f.size/1024).toFixed(1)} KB)</span></span>
              <button onClick={() => removeExtra(i)} className="text-red-400 hover:text-red-600" aria-label={`Remove ${f.name}`}>X</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between mt-6">
        <ActionButton variant="secondary" onClick={() => goTo(3)} className="px-5 py-2.5">Back</ActionButton>
        <ActionButton onClick={() => goTo(5)} className="px-6 py-2.5 bg-gradient-to-r from-forest-500 to-forest-400 hover:from-gold-500 hover:to-gold-600">Next: Review</ActionButton>
      </div>
    </div>
  );
}
