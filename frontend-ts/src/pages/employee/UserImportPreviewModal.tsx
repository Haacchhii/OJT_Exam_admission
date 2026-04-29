import Modal from '../../components/Modal';
import { Badge } from '../../components/UI';
import Icon from '../../components/Icons';
import { USER_ROLE_OPTIONS } from '../../utils/constants';

export interface UserImportRow {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  password?: string;
}

export interface ValidatedUserRow {
  index: number;
  data: UserImportRow;
  isValid: boolean;
  errors: string[];
}

interface UserImportPreviewModalProps {
  isOpen: boolean;
  validatedRows: ValidatedUserRow[];
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const validRoles = USER_ROLE_OPTIONS.map(r => r.value).filter(Boolean);
const validStatuses = ['Active', 'Inactive'];

export function UserImportPreviewModal({
  isOpen,
  validatedRows,
  fileName,
  onConfirm,
  onCancel,
  isLoading = false,
}: UserImportPreviewModalProps) {
  const validRows = validatedRows.filter(r => r.isValid);
  const invalidRows = validatedRows.filter(r => !r.isValid);

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onCancel} title="Review Import" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* File info */}
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Icon name="documentDownload" className="w-5 h-5 text-blue-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">{fileName}</p>
            <p className="text-xs text-blue-700">
              {validRows.length} valid • {invalidRows.length} invalid
            </p>
          </div>
          <Badge className="gk-badge gk-badge-preview">Preview</Badge>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-2xl font-bold text-green-700">{validRows.length}</p>
            <p className="text-xs text-green-600">Ready to Import</p>
          </div>
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-2xl font-bold text-red-700">{invalidRows.length}</p>
            <p className="text-xs text-red-600">Issues Found</p>
          </div>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-2xl font-bold text-gray-700">{validatedRows.length}</p>
            <p className="text-xs text-gray-600">Total Rows</p>
          </div>
        </div>

        {/* Valid rows preview */}
        {validRows.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Icon name="checkCircle" className="w-4 h-4 text-green-600" />
              Valid Users ({validRows.length})
            </h4>
            <div className="max-h-48 overflow-y-auto border border-green-100 rounded-lg bg-green-50/30">
              <div className="space-y-2 p-3">
                {validRows.slice(0, 10).map((row) => (
                  <div key={row.index} className="flex items-start gap-2 p-2 bg-white border border-green-100 rounded">
                    <Icon name="checkCircle" className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-gray-800">
                        {row.data.firstName} {row.data.middleName} {row.data.lastName}
                      </p>
                      <p className="text-xs text-gray-600">{row.data.email}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge className="gk-badge gk-badge-small">{row.data.role}</Badge>
                        <Badge className="gk-badge gk-badge-small">{row.data.status}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {validRows.length > 10 && (
                <div className="p-2 text-center text-xs text-gray-500 bg-white border-t border-green-100">
                  +{validRows.length - 10} more valid users
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invalid rows with errors */}
        {invalidRows.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Icon name="alertCircle" className="w-4 h-4 text-red-600" />
              Issues Found ({invalidRows.length})
            </h4>
            <div className="max-h-48 overflow-y-auto border border-red-100 rounded-lg bg-red-50/30">
              <div className="space-y-2 p-3">
                {invalidRows.slice(0, 10).map((row) => (
                  <div key={row.index} className="p-2 bg-white border border-red-100 rounded">
                    <div className="flex items-start gap-2 mb-1">
                      <Icon name="xCircle" className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 text-sm">
                        <p className="font-medium text-gray-800">Row {row.index + 1}</p>
                        <p className="text-xs text-gray-600">
                          {row.data.firstName || '—'} {row.data.middleName || '—'} {row.data.lastName || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="ml-6 space-y-1">
                      {row.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-700">• {err}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {invalidRows.length > 10 && (
                <div className="p-2 text-center text-xs text-gray-500 bg-white border-t border-red-100">
                  +{invalidRows.length - 10} more rows with issues
                </div>
              )}
            </div>
          </div>
        )}

        {/* Warning if all invalid */}
        {validRows.length === 0 && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800 font-medium">No valid users to import</p>
            <p className="text-xs text-orange-700 mt-1">Review the errors above and resubmit the file.</p>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading || validRows.length === 0}
            className="px-4 py-2 bg-forest-500 text-white rounded-lg text-sm hover:bg-forest-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Icon name="checkCircle" className="w-4 h-4" />
                Import {validRows.length} User{validRows.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
