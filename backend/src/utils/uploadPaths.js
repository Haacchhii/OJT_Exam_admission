import path from 'path';
import { existsSync } from 'fs';
import env from '../config/env.js';

export function getUploadBaseDir() {
  return env.NODE_ENV === 'production' && !path.isAbsolute(env.UPLOAD_DIR)
    ? path.posix.join('/tmp', env.UPLOAD_DIR)
    : path.resolve(env.UPLOAD_DIR);
}

export function resolveUploadedFilePath(storedPath) {
  const raw = String(storedPath || '').trim();
  if (!raw) return '';

  const normalized = raw.replace(/\\/g, '/');
  const baseDir = getUploadBaseDir();
  const baseName = path.basename(normalized);

  const candidates = [];
  if (path.isAbsolute(raw)) candidates.push(path.normalize(raw));

  candidates.push(path.resolve(baseDir, normalized));
  if (baseName && baseName !== normalized) {
    candidates.push(path.resolve(baseDir, baseName));
  }

  // Legacy fallback for environments that previously resolved from project root
  candidates.push(path.resolve(env.UPLOAD_DIR, normalized));
  if (baseName && baseName !== normalized) {
    candidates.push(path.resolve(env.UPLOAD_DIR, baseName));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return candidates[0];
}
