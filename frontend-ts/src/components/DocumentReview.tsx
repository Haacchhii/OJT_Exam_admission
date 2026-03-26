import { useState, useCallback } from 'react';
import Modal from './Modal';
import Icon from './Icons';
import { getDocumentPreviewUrl, getDocumentDownloadUrl, extractDocumentData, reviewDocument, type ExtractedResult } from '../api/admissions';
import { getToken } from '../api/client';
import { showToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from './ConfirmDialog';

interface DocumentFile {
  id: number;
  name: string;
  filePath: string | null;
  hasExtraction?: boolean;
  reviewStatus?: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
}

interface Props {
  admissionId: number;
  documents: DocumentFile[];
  onReviewUpdate?: () => void;
}

// Determine if a file is previewable in the browser
function isPreviewable(name: string): 'pdf' | 'image' | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(jpe?g|png|webp)$/.test(lower)) return 'image';
  return null;
}

export default function DocumentReview({ admissionId, documents, onReviewUpdate }: Props) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canReview = user?.role === 'administrator' || user?.role === 'registrar';
  const [previewDoc, setPreviewDoc] = useState<DocumentFile | null>(null);
  const [extraction, setExtraction] = useState<ExtractedResult | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'extracted'>('preview');
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoadError, setPreviewLoadError] = useState('');

  const token = getToken();

  const loadPreviewBlob = useCallback(async (doc: DocumentFile) => {
    const previewUrl = getDocumentPreviewUrl(admissionId, doc.id);
    if (!token) {
      setPreviewLoadError('You are not logged in. Please log in and try again.');
      return;
    }
    setPreviewLoading(true);
    setPreviewLoadError('');
    try {
      const res = await fetch(previewUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        let msg = 'Failed to load document preview';
        try {
          const contentType = res.headers.get('content-type') || '';
          const payload = contentType.includes('json') ? await res.json() : await res.text();
          if (typeof payload === 'string' && payload.trim()) msg = payload;
          else if (payload && typeof payload === 'object') {
            const p = payload as { message?: string; error?: string };
            if (typeof p.message === 'string' && p.message.trim()) msg = p.message;
            else if (typeof p.error === 'string' && p.error.trim()) msg = p.error;
          }
        } catch {
          // Keep default message if payload parsing fails.
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      setPreviewBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (err: any) {
      setPreviewLoadError(err.message || 'Failed to load document preview');
    } finally {
      setPreviewLoading(false);
    }
  }, [admissionId, token]);

  const handlePreview = useCallback((doc: DocumentFile) => {
    setPreviewDoc(doc);
    setExtraction(null);
    setExtractError('');
    setPreviewLoadError('');
    setActiveTab('preview');
    void loadPreviewBlob(doc);
  }, [loadPreviewBlob]);

  const handleExtract = useCallback(async (doc: DocumentFile) => {
    setExtracting(true);
    setExtractError('');
    try {
      const result = await extractDocumentData(admissionId, doc.id);
      setExtraction(result);
      setActiveTab('extracted');
    } catch (err: any) {
      setExtractError(err.message || 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }, [admissionId]);

  const closePreview = useCallback(() => {
    setPreviewDoc(null);
    setExtraction(null);
    setExtractError('');
    setPreviewLoadError('');
    setPreviewLoading(false);
    setPreviewBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleReview = useCallback(async (doc: DocumentFile, status: 'accepted' | 'rejected') => {
    const ok = await confirm({
      title: `${status === 'accepted' ? 'Accept' : 'Reject'} Document`,
      message: `Are you sure you want to mark "${doc.name}" as ${status}?`,
      confirmLabel: status === 'accepted' ? 'Accept' : 'Reject',
      variant: status === 'accepted' ? 'info' : 'warning',
    });
    if (!ok) return;

    setReviewing(doc.id);
    try {
      await reviewDocument(admissionId, doc.id, status);
      showToast(`Document ${status}`, 'success');
      onReviewUpdate?.();
    } catch { showToast('Failed to update review', 'error'); }
    finally { setReviewing(null); }
  }, [admissionId, onReviewUpdate, confirm]);

  return (
    <>
      <div className="space-y-2">
        {documents.map((doc, i) => {
          const previewType = isPreviewable(doc.name);
          const canOpenFile = !!doc.filePath && doc.id > 0;
          return (
            <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2.5 rounded-lg text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <Icon name="document" className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate">{doc.name}</span>
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {canOpenFile ? (
                  <>
                    {previewType ? (
                      <button
                        onClick={() => handlePreview(doc)}
                        className="inline-flex items-center gap-1 text-forest-600 hover:text-forest-800 text-xs font-medium hover:underline"
                        title="View document"
                      >
                        <Icon name="eye" className="w-3.5 h-3.5" /> View
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">Preview unavailable</span>
                    )}
                    <a
                      href={getDocumentDownloadUrl(admissionId, doc.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-700 text-xs font-medium hover:underline"
                      title="Download document"
                    >
                      Download
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">No file available</span>
                )}
                <span className="gk-badge gk-badge-submitted">
                  {doc.reviewStatus === 'accepted' ? '✓ Accepted' : doc.reviewStatus === 'rejected' ? '✗ Rejected' : 'Pending'}
                </span>
                {canReview && doc.reviewStatus === 'pending' && (
                  <>
                    <button disabled={reviewing === doc.id} onClick={() => handleReview(doc, 'accepted')} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">Accept</button>
                    <button disabled={reviewing === doc.id} onClick={() => handleReview(doc, 'rejected')} className="text-red-600 hover:text-red-800 text-xs font-medium">Reject</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Preview Modal ── */}
      <Modal
        open={!!previewDoc}
        onClose={closePreview}
        title={previewDoc?.name || 'Document Preview'}
        maxWidth="max-w-5xl"
      >
        {previewDoc && (
          <div>
            {/* Tab Bar */}
            <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'preview'
                    ? 'border-forest-500 text-forest-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon name="eye" className="w-4 h-4 inline mr-1.5" />
                Document Preview
              </button>
              <button
                onClick={() => {
                  setActiveTab('extracted');
                  if (previewDoc && !extraction && !extracting) handleExtract(previewDoc);
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'extracted'
                    ? 'border-forest-500 text-forest-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon name="clipboard" className="w-4 h-4 inline mr-1.5" />
                Extracted Info
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'preview' && (
              <div className="bg-gray-100 rounded-xl overflow-hidden" style={{ minHeight: '500px' }}>
                {previewLoading && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-500" style={{ minHeight: '500px' }}>
                    <div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium">Loading preview...</p>
                  </div>
                )}

                {!previewLoading && previewLoadError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 m-4">
                    <Icon name="exclamation" className="w-5 h-5 inline mr-2" />
                    {previewLoadError}
                  </div>
                )}

                {!previewLoading && !previewLoadError && previewBlobUrl && isPreviewable(previewDoc.name) === 'pdf' ? (
                  <iframe
                    src={previewBlobUrl}
                    className="w-full border-0 rounded-xl"
                    style={{ height: '70vh' }}
                    title={`Preview: ${previewDoc.name}`}
                  />
                ) : null}

                {!previewLoading && !previewLoadError && previewBlobUrl && isPreviewable(previewDoc.name) !== 'pdf' ? (
                  <div className="flex items-center justify-center p-4" style={{ minHeight: '500px' }}>
                    <img
                      src={previewBlobUrl}
                      alt={previewDoc.name}
                      className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
                    />
                  </div>
                ) : null}
              </div>
            )}

            {activeTab === 'extracted' && (
              <div style={{ minHeight: '400px' }}>
                {extracting && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                    <div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium">Analyzing document...</p>
                    <p className="text-xs text-gray-400 mt-1">Running OCR and extracting information</p>
                  </div>
                )}

                {extractError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                    <Icon name="exclamation" className="w-5 h-5 inline mr-2" />
                    {extractError}
                  </div>
                )}

                {extraction && !extracting && (
                  <div className="space-y-4">
                    {/* Document Type Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-forest-100 text-forest-700 px-3 py-1 rounded-full text-xs font-semibold">
                          {extraction.data.type}
                        </span>
                        {extraction.cached && (
                          <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">
                            Cached
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleExtract(previewDoc)}
                        className="text-xs text-forest-600 hover:text-forest-800 hover:underline"
                        disabled={extracting}
                      >
                        Re-extract
                      </button>
                    </div>

                    {/* Extracted Fields */}
                    {Object.keys(extraction.data.fields).length > 0 ? (
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-700">
                            <Icon name="info" className="w-4 h-4 inline mr-1.5" />
                            Extracted Information
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Auto-extracted from the uploaded document for quick review
                          </p>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {Object.entries(extraction.data.fields).map(([key, value]) => (
                            <div key={key} className="flex px-4 py-2.5 text-sm">
                              <span className="text-gray-500 font-medium w-44 shrink-0">{key}</span>
                              <span className="text-gray-900">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                        <Icon name="exclamation" className="w-5 h-5 inline mr-2" />
                        No structured fields could be extracted. The raw text is shown below for manual review.
                      </div>
                    )}

                    {/* Raw Extracted Text */}
                    <details className="group">
                      <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                        Show raw extracted text
                      </summary>
                      <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto font-mono">
                        {extraction.text || '(No text extracted)'}
                      </pre>
                    </details>
                  </div>
                )}

                {!extraction && !extracting && !extractError && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <Icon name="clipboard" className="w-10 h-10 mb-3" />
                    <p className="text-sm">Click the tab to run document extraction</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <a
                href={getDocumentDownloadUrl(admissionId, previewDoc.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 hover:underline"
              >
                Download Original
              </a>
              <button
                onClick={closePreview}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
