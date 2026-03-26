import { useState, useRef } from "react";
import Papa from "papaparse";
import Icon from './Icons';
import Modal from './Modal';

export function CSVUploader({
  title,
  isOpen,
  onClose,
  onImport,
  templateHeaders,
  allowMultiple = false,
}: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[]) => void;
  templateHeaders: string[];
  allowMultiple?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const parseCsvFile = (file: File) => new Promise<{ rows: any[]; error?: string }>((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          resolve({ rows: [], error: `${file.name}: parsing failed` });
          return;
        }

        const rows = (results.data || []) as any[];
        const firstRow = rows[0] as any;
        const missingHeaders = templateHeaders.filter(h => !Object.keys(firstRow || {}).includes(h));

        if (missingHeaders.length > 0) {
          resolve({ rows: [], error: `${file.name}: missing ${missingHeaders.join(", ")}` });
          return;
        }

        resolve({ rows });
      },
      error: () => resolve({ rows: [], error: `${file.name}: parsing failed` }),
    });
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError(null);
    const mergedRows: any[] = [];
    const issues: string[] = [];

    for (const file of files) {
      const parsed = await parseCsvFile(file);
      if (parsed.error) {
        issues.push(parsed.error);
        continue;
      }
      mergedRows.push(...parsed.rows);
    }

    if (issues.length > 0 && mergedRows.length === 0) {
      setError(issues.join(' | '));
      return;
    }

    if (issues.length > 0) {
      setError(`Some files were skipped: ${issues.join(' | ')}`);
    }

    try {
      await Promise.resolve(onImport(mergedRows));
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Import failed. Please try again.');
    }
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse([templateHeaders]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${title.replace(/\s+/g, "_").toLowerCase()}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 mb-6">
        <Icon name="documentDownload" className="w-12 h-12 text-forest-500 mx-auto mb-3" />
        <p className="text-gray-600 mb-4">Upload a .CSV file to bulk import</p>
        <input
          type="file"
          accept=".csv"
          multiple={allowMultiple}
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-forest-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-forest-600 transition-colors"
        >
          {allowMultiple ? 'Select Files' : 'Select File'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="text-sm text-gray-500 mb-4">
        <p className="font-semibold text-gray-700 mb-1">Required Format:</p>
        <p className="mb-3">Your CSV must include the following headers exact matches:</p>
        <code className="bg-gray-100 px-2 py-1 rounded block text-xs break-all mb-4">
          {templateHeaders.join(", ")}
        </code>
        <button onClick={downloadTemplate} className="text-forest-600 hover:underline">
          Download Template File
        </button>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
