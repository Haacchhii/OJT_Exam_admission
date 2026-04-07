import prisma from '../config/db.js';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import env from '../config/env.js';
import { ROLES, DOC_CACHE_MAX_AGE, MAX_KV_PAIRS } from '../utils/constants.js';

// Lazy-loaded heavy modules
let Tesseract = null;
let pdfParse = null;

const EXTRACTION_JOB_TTL_MS = 10 * 60 * 1000;
const extractionJobs = new Map();
const extractionQueue = [];
const activeDocJobs = new Map();
let extractionWorkerBusy = false;

async function loadTesseract() {
  if (!Tesseract) Tesseract = await import('tesseract.js');
  return Tesseract;
}

async function loadPdfParse() {
  if (!pdfParse) pdfParse = (await import('pdf-parse')).default;
  return pdfParse;
}

// ── MIME type map ─────────────────────────────────────
const EXT_MIME = {
  '.pdf':  'application/pdf',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function generateJobId(docId) {
  return `extract_${docId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanupExtractionJobs() {
  const now = Date.now();
  for (const [jobId, job] of extractionJobs.entries()) {
    const terminal = job.status === 'completed' || job.status === 'failed';
    if (terminal && now - job.updatedAtMs > EXTRACTION_JOB_TTL_MS) {
      extractionJobs.delete(jobId);
      if (activeDocJobs.get(job.docId) === jobId) activeDocJobs.delete(job.docId);
    }
  }
}

async function extractTextFromFile(filePath, ext) {
  if (ext === '.pdf') {
    const parse = await loadPdfParse();
    const buffer = await fs.readFile(filePath);
    const pdfData = await parse(buffer);
    const pdfText = pdfData.text || '';
    if (!pdfText.trim()) {
      return '[Scanned PDF - no embedded text detected. For best results, upload image files (JPG/PNG) of scanned documents.]';
    }
    return pdfText;
  }

  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    const tesseract = await loadTesseract();
    const worker = await tesseract.createWorker('eng');
    try {
      const result = await worker.recognize(filePath);
      return result.data.text || '';
    } finally {
      await worker.terminate();
    }
  }

  return '[Text extraction is not supported for this file type. Supported: PDF, JPG, PNG, WebP]';
}

async function performDocumentExtraction(doc) {
  const filePath = path.resolve(env.UPLOAD_DIR, doc.filePath);
  if (!existsSync(filePath)) {
    throw new Error('File not found on server');
  }

  const ext = path.extname(doc.filePath).toLowerCase();
  const extractedText = await extractTextFromFile(filePath, ext);
  const parsedData = parseDocumentFields(extractedText, doc.documentName);
  const extractedAt = new Date();

  await prisma.admissionDocument.update({
    where: { id: doc.id },
    data: {
      extractedText,
      extractedData: JSON.stringify(parsedData),
      extractedAt,
    },
  });

  return {
    text: extractedText,
    data: parsedData,
    extractedAt,
    cached: false,
  };
}

async function processExtractionQueue() {
  if (extractionWorkerBusy) return;
  extractionWorkerBusy = true;

  try {
    while (extractionQueue.length > 0) {
      const jobId = extractionQueue.shift();
      const job = extractionJobs.get(jobId);
      if (!job || job.status !== 'queued') continue;

      job.status = 'running';
      job.updatedAtMs = Date.now();

      try {
        const doc = await prisma.admissionDocument.findUnique({ where: { id: job.docId } });
        if (!doc || doc.admissionId !== job.admissionId || !doc.filePath) {
          throw new Error('Document not found');
        }

        job.result = await performDocumentExtraction(doc);
        job.status = 'completed';
      } catch (err) {
        job.error = err?.message || 'Extraction failed';
        job.status = 'failed';
      } finally {
        job.updatedAtMs = Date.now();
        if (activeDocJobs.get(job.docId) === jobId) {
          activeDocJobs.delete(job.docId);
        }
      }

      cleanupExtractionJobs();
    }
  } finally {
    extractionWorkerBusy = false;
  }
}

// ── Ownership helper ──────────────────────────────────
async function verifyAccess(user, admissionId) {
  const admission = await prisma.admission.findUnique({ where: { id: admissionId } });
  if (!admission) return { error: 'Admission not found', status: 404 };
  if (user.role === ROLES.APPLICANT && admission.userId !== user.id) {
    return { error: 'Access denied', status: 403 };
  }
  return { admission };
}

// GET /api/admissions/:id/documents/:docId/preview
// Serves the file inline so the browser can render it (PDF, images)
// Requires shared authenticate middleware and ownership checks.
export async function previewDocument(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const admissionId = Number(req.params.id);
    const docId = Number(req.params.docId);

    const access = await verifyAccess(user, admissionId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const doc = await prisma.admissionDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.admissionId !== admissionId) {
      return res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
    }
    if (!doc.filePath) {
      return res.status(404).json({ error: 'File not available', code: 'NOT_FOUND' });
    }

    const filePath = path.resolve(env.UPLOAD_DIR, doc.filePath);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server', code: 'NOT_FOUND' });
    }

    const ext = path.extname(doc.filePath).toLowerCase();
    const mime = EXT_MIME[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${doc.documentName}"`);
    res.setHeader('Cache-Control', `private, max-age=${DOC_CACHE_MAX_AGE}`);

    const data = await fs.readFile(filePath);
    res.send(data);
  } catch (err) { next(err); }
}

// POST /api/admissions/:id/documents/:docId/extract
// Queues OCR / text extraction and returns job metadata.
export async function extractDocument(req, res, next) {
  try {
    cleanupExtractionJobs();

    const admissionId = Number(req.params.id);
    const docId = Number(req.params.docId);

    const access = await verifyAccess(req.user, admissionId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const doc = await prisma.admissionDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.admissionId !== admissionId) {
      return res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
    }
    if (!doc.filePath) {
      return res.status(404).json({ error: 'File not available', code: 'NOT_FOUND' });
    }

    // Return cached extraction if available
    if (doc.extractedText && doc.extractedData) {
      return res.json({
        jobId: null,
        status: 'completed',
        result: {
          text: doc.extractedText,
          data: JSON.parse(doc.extractedData),
          extractedAt: doc.extractedAt,
          cached: true,
        },
      });
    }

    const existingJobId = activeDocJobs.get(docId);
    if (existingJobId && extractionJobs.has(existingJobId)) {
      const existing = extractionJobs.get(existingJobId);
      return res.status(202).json({
        jobId: existingJobId,
        status: existing.status,
      });
    }

    const jobId = generateJobId(docId);
    extractionJobs.set(jobId, {
      jobId,
      admissionId,
      docId,
      status: 'queued',
      result: null,
      error: null,
      updatedAtMs: Date.now(),
    });
    activeDocJobs.set(docId, jobId);
    extractionQueue.push(jobId);
    void processExtractionQueue();

    res.status(202).json({ jobId, status: 'queued' });
  } catch (err) { next(err); }
}

// GET /api/admissions/:id/documents/:docId/extract/:jobId
// Poll extraction status and return result once complete.
export async function getExtractionJobStatus(req, res, next) {
  try {
    cleanupExtractionJobs();

    const admissionId = Number(req.params.id);
    const docId = Number(req.params.docId);
    const { jobId } = req.params;

    const access = await verifyAccess(req.user, admissionId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const doc = await prisma.admissionDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.admissionId !== admissionId) {
      return res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
    }

    const job = extractionJobs.get(jobId);
    if (!job || job.docId !== docId || job.admissionId !== admissionId) {
      if (doc.extractedText && doc.extractedData) {
        return res.json({
          jobId,
          status: 'completed',
          result: {
            text: doc.extractedText,
            data: JSON.parse(doc.extractedData),
            extractedAt: doc.extractedAt,
            cached: true,
          },
        });
      }
      return res.status(404).json({ error: 'Extraction job not found', code: 'NOT_FOUND' });
    }

    if (job.status === 'completed') {
      return res.json({
        jobId,
        status: 'completed',
        result: job.result,
      });
    }

    if (job.status === 'failed') {
      return res.json({
        jobId,
        status: 'failed',
        error: job.error || 'Extraction failed',
      });
    }

    return res.json({ jobId, status: job.status });
  } catch (err) { next(err); }
}

// ── Template-based field parsing ─────────────────────
// Parses extracted OCR text to pull structured key-value data
// from common Philippine documents
function parseDocumentFields(text, documentName) {
  const lower = (documentName || '').toLowerCase();
  const fields = {};

  if (!text || text.startsWith('[')) return { type: 'unknown', fields };

  // Normalize text: collapse whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Detect document type from filename or content
  const isBirthCert = lower.includes('birth') || /birth\s*cert|certificate\s*of\s*live\s*birth|live\s*birth/i.test(normalized);
  const isReportCard = lower.includes('report') || lower.includes('card') || /report\s*card|form\s*137|form\s*138|learner/i.test(normalized);
  const isGoodMoral = lower.includes('good') || lower.includes('moral') || /good\s*moral|character/i.test(normalized);
  const isBaptismal = lower.includes('baptism') || lower.includes('baptismal') || /baptism|baptismal|certificate\s*of\s*baptism/i.test(normalized);
  const isIDPhoto = lower.includes('id') && lower.includes('photo') || lower.includes('picture');

  if (isBirthCert) {
    return parseBirthCertificate(normalized);
  } else if (isReportCard) {
    return parseReportCard(normalized);
  } else if (isGoodMoral) {
    return parseGoodMoral(normalized);
  } else if (isBaptismal) {
    return parseBaptismal(normalized);
  } else if (isIDPhoto) {
    return { type: 'ID Photo', fields: { note: 'ID Photo detected — no text extraction needed.' } };
  }

  // Generic: extract any key-value pairs in "Label: Value" format
  return parseGeneric(normalized);
}

function parseBirthCertificate(text) {
  const fields = {};

  // Common patterns in Philippine PSA / NSO birth certificates
  const patterns = [
    { key: 'Full Name', re: /(?:name|child|first\s*name)[:\s]*([A-Z][A-Za-z\s,.-]+)/i },
    { key: 'First Name', re: /(?:first\s*name|given\s*name)[:\s]*([A-Za-z\s-]+?)(?:\s*(?:middle|last|surname|$))/i },
    { key: 'Middle Name', re: /(?:middle\s*name)[:\s]*([A-Za-z\s-]+?)(?:\s*(?:last|surname|sex|$))/i },
    { key: 'Last Name', re: /(?:last\s*name|surname)[:\s]*([A-Za-z\s-]+?)(?:\s*(?:first|sex|date|$))/i },
    { key: 'Sex', re: /(?:sex|gender)[:\s]*(male|female)/i },
    { key: 'Date of Birth', re: /(?:date\s*of\s*birth|birth\s*date|born\s*on|date\s*born)[:\s]*([A-Za-z0-9\s,.-]+?)(?:\s*(?:place|sex|city|$))/i },
    { key: 'Place of Birth', re: /(?:place\s*of\s*birth|birth\s*place|born\s*(?:at|in))[:\s]*([A-Za-z0-9\s,.-]+?)(?:\s*(?:date|sex|name|mother|father|$))/i },
    { key: "Father's Name", re: /(?:father|father'?s?\s*name)[:\s]*([A-Za-z\s,.-]+?)(?:\s*(?:mother|citizen|nation|$))/i },
    { key: "Mother's Maiden Name", re: /(?:mother|mother'?s?\s*(?:maiden\s*)?name)[:\s]*([A-Za-z\s,.-]+?)(?:\s*(?:father|citizen|nation|date|$))/i },
    { key: 'Registry Number', re: /(?:registry\s*(?:no|number|#)|reg\.?\s*no)[.:\s]*([0-9-]+)/i },
    { key: 'Date of Registration', re: /(?:date\s*of\s*registration|registered\s*on)[:\s]*([A-Za-z0-9\s,.-]+?)(?:\s*(?:prepared|$))/i },
  ];

  for (const { key, re } of patterns) {
    const match = text.match(re);
    if (match) fields[key] = match[1].trim();
  }

  return { type: 'Birth Certificate', fields };
}

function parseReportCard(text) {
  const fields = {};
  const patterns = [
    { key: 'Student Name', re: /(?:name\s*of\s*(?:learner|student|pupil)|student\s*name|learner'?s?\s*name)[:\s]*([A-Za-z\s,.-]+?)(?:\s*(?:grade|school|section|lrn|$))/i },
    { key: 'LRN', re: /(?:lrn|learner\s*reference\s*(?:no|number))[.:\s]*([0-9-]+)/i },
    { key: 'Grade Level', re: /(?:grade\s*(?:level)?|year\s*level)[:\s]*([A-Za-z0-9\s-]+?)(?:\s*(?:section|school|name|$))/i },
    { key: 'Section', re: /(?:section)[:\s]*([A-Za-z0-9\s-]+?)(?:\s*(?:school|teacher|adviser|$))/i },
    { key: 'School Name', re: /(?:school\s*name|name\s*of\s*school|school)[:\s]*([A-Za-z0-9\s,.-]+?)(?:\s*(?:school\s*id|district|division|$))/i },
    { key: 'School Year', re: /(?:school\s*year|s\.?y\.?)[.:\s]*([0-9-]+)/i },
    { key: 'General Average', re: /(?:general\s*average|final\s*average|average)[:\s]*([0-9.]+)/i },
  ];

  for (const { key, re } of patterns) {
    const match = text.match(re);
    if (match) fields[key] = match[1].trim();
  }

  return { type: 'Report Card', fields };
}

function parseGoodMoral(text) {
  const fields = {};
  const patterns = [
    { key: 'Student Name', re: /(?:certif(?:y|ies)\s*that|this\s*is\s*to\s*certify\s*that|student\s*name|name)[:\s]*([A-Z][A-Za-z\s,.-]+?)(?:\s*(?:is|has|was|a\s*student|$))/i },
    { key: 'School Name', re: /(?:school|institution|academy)[:\s]*([A-Za-z\s,.-]+?)(?:\s*(?:certif|for|during|$))/i },
    { key: 'School Year', re: /(?:school\s*year|s\.?y\.?|academic\s*year)[.:\s]*([0-9-]+)/i },
    { key: 'Date Issued', re: /(?:date\s*issued|issued\s*(?:on|this)|given\s*this)[:\s]*([A-Za-z0-9\s,.-]+?)(?:\s*(?:at|in|signed|$))/i },
  ];

  for (const { key, re } of patterns) {
    const match = text.match(re);
    if (match) fields[key] = match[1].trim();
  }

  return { type: 'Good Moral Certificate', fields };
}

function parseBaptismal(text) {
  const fields = {};
  const patterns = [
    { key: 'Name', re: /(?:name|baptized|child)[:\s]*([A-Z][A-Za-z\s,.-]+?)(?:\s*(?:was|born|date|son|daughter|$))/i },
    { key: 'Date of Baptism', re: /(?:date\s*of\s*baptism|baptized\s*on)[:\s]*([A-Za-z0-9\s,.-]+?)(?:\s*(?:at|in|church|parish|$))/i },
    { key: 'Church/Parish', re: /(?:church|parish|baptized\s*(?:at|in))[:\s]*([A-Za-z\s,.-]+?)(?:\s*(?:date|located|$))/i },
    { key: 'Date of Birth', re: /(?:born\s*on|date\s*of\s*birth|birth\s*date)[:\s]*([A-Za-z0-9\s,.-]+?)(?:\s*(?:baptized|place|parents|$))/i },
    { key: 'Parents', re: /(?:parents|father\s*and\s*mother|son\/daughter\s*of)[:\s]*([A-Za-z\s,.&-]+?)(?:\s*(?:sponsor|godparent|ninong|ninang|$))/i },
  ];

  for (const { key, re } of patterns) {
    const match = text.match(re);
    if (match) fields[key] = match[1].trim();
  }

  return { type: 'Baptismal Certificate', fields };
}

function parseGeneric(text) {
  const fields = {};
  // Try to find key: value patterns
  const kvPattern = /([A-Z][A-Za-z\s]{2,30})[:\-]\s*([^\n:]{2,80})/g;
  let match;
  let count = 0;
  while ((match = kvPattern.exec(text)) !== null && count < MAX_KV_PAIRS) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (key && value && !fields[key]) {
      fields[key] = value;
      count++;
    }
  }
  return { type: 'Document', fields };
}
