import { readFile, unlink } from 'fs/promises';
import { fileTypeFromBuffer } from 'file-type';
import { ALLOWED_MIME_TYPES } from '../utils/constants.js';

/**
 * Post-upload middleware: verifies file MIME types via magic bytes.
 * Removes spoofed files and returns 400.
 * Use AFTER multer: upload.array('docs', 10), verifyMime, controller
 */
export async function verifyMime(req, _res, next) {
  if (!req.files?.length && !req.file) return next();

  const files = req.file ? [req.file] : (req.files || []);
  const rejected = [];

  for (const file of files) {
    try {
      const buffer = await readFile(file.path);
      const detected = await fileTypeFromBuffer(buffer);
      // PDF, images are reliably detected. DOC/DOCX also detectable.
      // If file-type can't detect (e.g. plain text), fall back to multer's mimetype check.
      if (detected && !ALLOWED_MIME_TYPES.includes(detected.mime)) {
        rejected.push(file);
        await unlink(file.path).catch(() => {});
      }
    } catch {
      // If we can't read / detect, let it pass — multer already checked Content-Type
    }
  }

  if (rejected.length > 0) {
    // Remove remaining uploaded files from this request too
    for (const file of files) {
      if (!rejected.includes(file)) {
        await unlink(file.path).catch(() => {});
      }
    }
    const names = rejected.map(f => f.originalname).join(', ');
    const err = new Error(`Rejected files with mismatched MIME type: ${names}`);
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    return next(err);
  }

  next();
}
