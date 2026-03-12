import Icon from '../../../components/Icons';
import { UploadSlot } from './AdmissionFormFields';
import { DOC_SLOT_LABELS } from '../../../utils/constants';
import type { SlotFiles } from './useAdmissionWizard';

interface Props {
  form: { gradeLevel: string };
  requiredDocs: string[];
  slotFiles: SlotFiles;
  extraFiles: File[];
  goTo: (n: number) => void;
  handleSlotFile: (slot: string, file: File) => void;
  handleExtraFiles: (files: FileList | null) => void;
  removeSlot: (slot: string) => void;
  removeExtra: (index: number) => void;
}

export default function StepDocuments({ form, requiredDocs, slotFiles, extraFiles, goTo, handleSlotFile, handleExtraFiles, removeSlot, removeExtra }: Props) {
  return (
    <div className="gk-card p-6">
      <h3 className="text-lg font-bold text-forest-500 mb-1">Step 3: Required Documents</h3>
      <p className="text-gray-500 text-sm mb-2">Upload the documents required for <strong>{form.gradeLevel || 'your grade level'}</strong>.</p>
      <p className="text-xs text-gray-400 mb-6">Accepted formats: PDF, JPG, PNG, DOC, DOCX.</p>
      <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="document" className="w-4 h-4" /> Required Documents</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {requiredDocs.map(docKey => (
          <UploadSlot key={docKey} label={`📄 ${(DOC_SLOT_LABELS as Record<string, string>)[docKey]}`} required slot={docKey} file={slotFiles[docKey]} onFile={handleSlotFile} onRemove={removeSlot} />
        ))}
      </div>
      <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="checkCircle" className="w-4 h-4" /> Document Checklist</h4>
      <div className="space-y-2 mb-6">
        {requiredDocs.map(docKey => (
          <div key={docKey} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${slotFiles[docKey] ? 'bg-forest-50 text-forest-700' : 'bg-red-50 text-red-500'}`}>
            {slotFiles[docKey] ? <Icon name="checkCircle" className="w-4 h-4" /> : <Icon name="exclamation" className="w-4 h-4" />} {(DOC_SLOT_LABELS as Record<string, string>)[docKey]} — <span className="text-xs">{slotFiles[docKey] ? 'Uploaded' : 'Not yet uploaded'}</span>
          </div>
        ))}
      </div>
      <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="upload" className="w-4 h-4" /> Other Supporting Files (Optional)</h4>
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gold-400 transition"
        onClick={() => document.getElementById('extraFileInput')?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-gold-400'); }}
        onDragLeave={e => e.currentTarget.classList.remove('border-gold-400')}
        onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-gold-400'); handleExtraFiles(e.dataTransfer.files); }}
      >
        <Icon name="upload" className="w-8 h-8 text-gray-400" />
        <p className="text-gray-500 mt-2">Drag & drop files here or <span className="text-forest-500 font-medium">browse</span></p>
        <p className="text-xs text-gray-400 mt-1">Medical records, recommendation letters, other certificates</p>
      </div>
      <input id="extraFileInput" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden" onChange={e => { handleExtraFiles(e.target.files); e.target.value = ''; }} />
      {extraFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {extraFiles.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm">
              <span>📄 {f.name} <span className="text-gray-400 text-xs">({(f.size/1024).toFixed(1)} KB)</span></span>
              <button onClick={() => removeExtra(i)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between mt-6">
        <button onClick={() => goTo(2)} className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50">← Back</button>
        <button onClick={() => goTo(4)} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600">Next: Review →</button>
      </div>
    </div>
  );
}
