import { useState, useRef } from "react";
import Papa from "papaparse";
import Icon from './Icons';

export function CSVUploader({
  title,
  isOpen,
  onClose,
  onImport,
  templateHeaders
}: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[]) => void;
  templateHeaders: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError("Error parsing CSV. Please check formatting.");
          return;
        }
        
        const firstRow = results.data[0] as any;
        const missingHeaders = templateHeaders.filter(h => !Object.keys(firstRow || {}).includes(h));
        
        if (missingHeaders.length > 0) {
          setError(`Missing required headers: ${missingHeaders.join(", ")}`);
          return;
        }

        onImport(results.data);
        onClose();
      }
    });
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-500 hover:text-gray-700">
          <Icon name="x" className="w-6 h-6" />
        </button>
        
        <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 mb-6">
          <Icon name="documentDownload" className="w-12 h-12 text-forest-500 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">Upload a .CSV file to bulk import</p>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-forest-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-forest-600 transition-colors"
          >
            Select File
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="text-sm text-gray-500">
          <p className="font-semibold text-gray-700 mb-1">Required Format:</p>
          <p className="mb-3">Your CSV must include the following headers exact matches:</p>
          <code className="bg-gray-100 px-2 py-1 rounded block text-xs break-all mb-4">
            {templateHeaders.join(", ")}
          </code>
          <button onClick={downloadTemplate} className="text-forest-600 hover:underline">
            Download Template File
          </button>
        </div>
      </div>
    </div>
  );
}
