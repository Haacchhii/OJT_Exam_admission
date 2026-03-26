import multer from 'multer';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import env from '../config/env.js';
import { ALLOWED_MIME_TYPES } from '../utils/constants.js';

// Vercel's filesystem is read-only except /tmp.
// Keep local dev behavior, but force a writable temp dir in production when UPLOAD_DIR is relative.
const uploadDir = env.NODE_ENV === 'production' && !path.isAbsolute(env.UPLOAD_DIR)
  ? path.posix.join('/tmp', env.UPLOAD_DIR)
  : path.resolve(env.UPLOAD_DIR);

if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
});
