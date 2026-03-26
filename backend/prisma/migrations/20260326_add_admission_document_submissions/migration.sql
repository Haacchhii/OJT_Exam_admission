-- Dedicated table for submitted admission files.
CREATE TABLE IF NOT EXISTS admission_document_submissions (
  id SERIAL PRIMARY KEY,
  admission_id INTEGER NOT NULL,
  admission_document_id INTEGER NULL,
  original_file_name TEXT NOT NULL,
  stored_file_path TEXT NOT NULL,
  mime_type TEXT NULL,
  file_size INTEGER NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  extracted_text TEXT NULL,
  extracted_data TEXT NULL,
  extracted_at TIMESTAMP NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMP NULL,
  reviewed_by_id INTEGER NULL,
  review_note TEXT NULL,
  CONSTRAINT admission_document_submissions_admission_id_fkey
    FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE CASCADE,
  CONSTRAINT admission_document_submissions_admission_document_id_fkey
    FOREIGN KEY (admission_document_id) REFERENCES admission_documents(id) ON DELETE SET NULL,
  CONSTRAINT admission_document_submissions_reviewed_by_id_fkey
    FOREIGN KEY (reviewed_by_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS admission_document_submissions_admission_id_idx
  ON admission_document_submissions(admission_id);

CREATE INDEX IF NOT EXISTS admission_document_submissions_admission_document_id_idx
  ON admission_document_submissions(admission_document_id);

CREATE INDEX IF NOT EXISTS admission_document_submissions_uploaded_at_idx
  ON admission_document_submissions(uploaded_at);
