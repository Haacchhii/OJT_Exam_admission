-- Academic period indexes for active-year and semester lookups.

CREATE INDEX IF NOT EXISTS academic_years_is_active_idx
  ON academic_years(is_active);

CREATE INDEX IF NOT EXISTS semesters_academic_year_id_idx
  ON semesters(academic_year_id);

CREATE INDEX IF NOT EXISTS semesters_academic_year_id_is_active_idx
  ON semesters(academic_year_id, is_active);

CREATE INDEX IF NOT EXISTS semesters_is_active_idx
  ON semesters(is_active);
