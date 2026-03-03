# Database Schema Design

## GOLDEN KEY Integrated School of St. Joseph — Admission & Examination System

**Version:** 1.0  
**Date:** February 27, 2026  
**Database:** MySQL 8.0 / PostgreSQL 15+  

---

## 1. Entity Relationship Diagram (ERD)

```
┌──────────────┐       ┌──────────────────┐       ┌───────────────────┐
│    users     │       │   admissions     │       │      exams        │
├──────────────┤       ├──────────────────┤       ├───────────────────┤
│ id (PK)      │──┐    │ id (PK)          │       │ id (PK)           │
│ first_name   │  │    │ user_id (FK)     │◄──┐   │ title             │
│ last_name    │  │    │ first_name       │   │   │ grade_level       │
│ email (UQ)   │  └───►│ last_name        │   │   │ duration_minutes  │
│ password_hash│       │ email            │   │   │ passing_score     │
│ role         │       │ phone            │   │   │ is_active         │
│ status       │       │ dob              │   │   │ created_by (FK)   │
│ created_at   │       │ gender           │   │   │ created_at        │
│ updated_at   │       │ address          │   │   │ updated_at        │
└──────────────┘       │ grade_level      │   │   └─────────┬─────────┘
                       │ prev_school      │   │             │
                       │ school_year      │   │             │
                       │ lrn              │   │   ┌─────────▼─────────┐
                       │ applicant_type   │   │   │  exam_questions   │
                       │ guardian         │   │   ├───────────────────┤
                       │ guardian_relation│   │   │ id (PK)           │
                       │ guardian_phone   │   │   │ exam_id (FK)      │
                       │ guardian_email   │   │   │ question_text     │
                       │ status           │   │   │ question_type     │
                       │ notes            │   │   │ points            │
                       │ submitted_at     │   │   │ order_num         │
                       │ updated_at       │   │   └─────────┬─────────┘
                       └────────┬─────────┘   │             │
                                │             │   ┌─────────▼─────────┐
                                │             │   │ question_choices  │
                                │             │   ├───────────────────┤
                  ┌─────────────▼──────────┐  │   │ id (PK)           │
                  │  admission_documents   │  │   │ question_id (FK)  │
                  ├────────────────────────┤  │   │ choice_text       │
                  │ id (PK)                │  │   │ is_correct        │
                  │ admission_id (FK)      │  │   │ order_num         │
                  │ document_name          │  │   └───────────────────┘
                  │ uploaded_at            │  │
                  └────────────────────────┘  │
                                              │
┌──────────────────────┐    ┌─────────────────▼───────┐
│  exam_schedules      │    │  exam_registrations     │
├──────────────────────┤    ├─────────────────────────┤
│ id (PK)              │◄──►│ id (PK)                 │
│ exam_id (FK)         │    │ admission_id (FK)       │──┐
│ scheduled_date       │    │ schedule_id (FK)        │  │
│ start_time           │    │ status                  │  │
│ end_time             │    │ started_at              │  │
│ max_slots            │    │ submitted_at            │  │
│ slots_taken          │    │ created_at              │  │
│ venue                │    └────────────┬────────────┘  │
│ created_at           │                 │               │
│ updated_at           │                 │               │
└──────────────────────┘    ┌────────────▼────────────┐  │
                            │    exam_results         │  │
                            ├─────────────────────────┤  │
                            │ id (PK)                 │  │
                            │ registration_id (FK,UQ) │  │
                            │ total_score             │  │
                            │ max_possible            │  │
                            │ percentage              │  │
                            │ passed                  │  │
                            │ essay_reviewed          │  │
                            │ reviewed_by (FK)        │  │
                            │ created_at              │  │
                            │ updated_at              │  │
                            └─────────────────────────┘  │
                                                         │
┌───────────────────────────┐  ┌─────────────────────────▼──┐
│    essay_answers          │  │   submitted_answers        │
├───────────────────────────┤  ├────────────────────────────┤
│ id (PK)                   │  │ id (PK)                    │
│ registration_id (FK)      │  │ registration_id (FK)       │
│ question_id (FK)          │  │ question_id (FK)           │
│ essay_response (TEXT)     │  │ selected_choice_id (FK)    │
│ points_awarded            │  │ essay_text (TEXT)           │
│ max_points                │  │ created_at                 │
│ scored                    │  └────────────────────────────┘
│ scored_by (FK)            │
│ scored_at                 │
│ created_at                │
└───────────────────────────┘

┌───────────────────────────┐
│    notifications          │
├───────────────────────────┤
│ id (PK)                   │
│ user_id (FK)              │
│ type                      │
│ title                     │
│ message                   │
│ is_read                   │
│ created_at                │
└───────────────────────────┘
```

---

## 2. Table Definitions

### 2.1 `users`

| Column        | Type                 | Constraints                                  |
|---------------|----------------------|----------------------------------------------|
| id            | INT / SERIAL         | PRIMARY KEY, AUTO_INCREMENT                  |
| first_name    | VARCHAR(100)         | NOT NULL                                     |
| last_name     | VARCHAR(100)         | NOT NULL                                     |
| email         | VARCHAR(255)         | NOT NULL, UNIQUE                             |
| password_hash | VARCHAR(255)         | NOT NULL                                     |
| role          | ENUM('administrator','registrar','exam_coordinator','applicant') | NOT NULL, DEFAULT 'applicant' |
| status        | ENUM('Active','Inactive') | NOT NULL, DEFAULT 'Active'              |
| created_at    | TIMESTAMP            | NOT NULL, DEFAULT CURRENT_TIMESTAMP          |
| updated_at    | TIMESTAMP            | ON UPDATE CURRENT_TIMESTAMP                  |

**Indexes:**
- UNIQUE INDEX `idx_users_email` (email)
- INDEX `idx_users_role` (role)
- INDEX `idx_users_status` (status)

---

### 2.2 `admissions`

| Column           | Type              | Constraints                                   |
|------------------|-------------------|-----------------------------------------------|
| id               | INT / SERIAL      | PRIMARY KEY, AUTO_INCREMENT                   |
| user_id          | INT               | NOT NULL, FOREIGN KEY → users(id)             |
| first_name       | VARCHAR(100)      | NOT NULL                                      |
| last_name        | VARCHAR(100)      | NOT NULL                                      |
| email            | VARCHAR(255)      | NOT NULL                                      |
| phone            | VARCHAR(30)       | NULL                                          |
| dob              | DATE              | NOT NULL                                      |
| gender           | ENUM('Male','Female') | NOT NULL                                  |
| address          | TEXT              | NOT NULL                                      |
| grade_level      | VARCHAR(50)       | NOT NULL                                      |
| prev_school      | VARCHAR(200)      | NULL                                          |
| school_year      | VARCHAR(20)       | NOT NULL (e.g., "2026-2027")                  |
| lrn              | VARCHAR(12)       | NULL (12-digit numeric string)                |
| applicant_type   | ENUM('New','Transferee') | NOT NULL, DEFAULT 'New'                |
| guardian         | VARCHAR(200)      | NOT NULL                                      |
| guardian_relation| VARCHAR(50)       | NOT NULL                                      |
| guardian_phone   | VARCHAR(30)       | NULL                                          |
| guardian_email   | VARCHAR(255)      | NULL                                          |
| status           | ENUM('Submitted','Under Screening','Under Evaluation','Pending Payment','Accepted','Rejected') | NOT NULL, DEFAULT 'Submitted' |
| notes            | TEXT              | NULL                                          |
| submitted_at     | TIMESTAMP         | NOT NULL, DEFAULT CURRENT_TIMESTAMP           |
| updated_at       | TIMESTAMP         | ON UPDATE CURRENT_TIMESTAMP                   |

**Indexes:**
- INDEX `idx_admissions_user` (user_id)
- INDEX `idx_admissions_status` (status)
- INDEX `idx_admissions_grade` (grade_level)
- INDEX `idx_admissions_submitted` (submitted_at)

**Business Rule:** One active application per user (enforce via application logic or partial unique index on `user_id` WHERE status NOT IN ('Rejected')).

---

### 2.3 `admission_documents`

| Column        | Type          | Constraints                              |
|---------------|---------------|------------------------------------------|
| id            | INT / SERIAL  | PRIMARY KEY, AUTO_INCREMENT              |
| admission_id  | INT           | NOT NULL, FOREIGN KEY → admissions(id) ON DELETE CASCADE |
| document_name | VARCHAR(200)  | NOT NULL                                 |
| file_path     | VARCHAR(500)  | NULL (for future file upload support)    |
| uploaded_at   | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP                |

**Note:** Currently documents are stored as names only (checkbox-based). This table supports future file upload.

---

### 2.4 `exams`

| Column           | Type          | Constraints                              |
|------------------|---------------|------------------------------------------|
| id               | INT / SERIAL  | PRIMARY KEY, AUTO_INCREMENT              |
| title            | VARCHAR(200)  | NOT NULL                                 |
| grade_level      | VARCHAR(50)   | NOT NULL                                 |
| duration_minutes | INT           | NOT NULL, CHECK (> 0)                    |
| passing_score    | DECIMAL(5,2)  | NOT NULL, CHECK (BETWEEN 0 AND 100)     |
| is_active        | BOOLEAN       | NOT NULL, DEFAULT TRUE                   |
| created_by       | INT           | FOREIGN KEY → users(id)                  |
| created_at       | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP                |
| updated_at       | TIMESTAMP     | ON UPDATE CURRENT_TIMESTAMP              |

**Indexes:**
- INDEX `idx_exams_grade` (grade_level)
- INDEX `idx_exams_active` (is_active)

---

### 2.5 `exam_questions`

| Column        | Type              | Constraints                              |
|---------------|-------------------|------------------------------------------|
| id            | INT / SERIAL      | PRIMARY KEY, AUTO_INCREMENT              |
| exam_id       | INT               | NOT NULL, FOREIGN KEY → exams(id) ON DELETE CASCADE |
| question_text | TEXT              | NOT NULL                                 |
| question_type | ENUM('mc','essay')| NOT NULL                                 |
| points        | INT               | NOT NULL, CHECK (> 0)                    |
| order_num     | INT               | NOT NULL                                 |

**Indexes:**
- INDEX `idx_questions_exam` (exam_id)
- UNIQUE INDEX `idx_questions_order` (exam_id, order_num)

---

### 2.6 `question_choices`

| Column      | Type          | Constraints                                    |
|-------------|---------------|------------------------------------------------|
| id          | INT / SERIAL  | PRIMARY KEY, AUTO_INCREMENT                    |
| question_id | INT           | NOT NULL, FOREIGN KEY → exam_questions(id) ON DELETE CASCADE |
| choice_text | VARCHAR(500)  | NOT NULL                                       |
| is_correct  | BOOLEAN       | NOT NULL, DEFAULT FALSE                        |
| order_num   | INT           | NOT NULL                                       |

**Indexes:**
- INDEX `idx_choices_question` (question_id)

**Business Rule:** For MC questions, exactly one choice must have `is_correct = TRUE`.

---

### 2.7 `exam_schedules`

| Column         | Type          | Constraints                              |
|----------------|---------------|------------------------------------------|
| id             | INT / SERIAL  | PRIMARY KEY, AUTO_INCREMENT              |
| exam_id        | INT           | NOT NULL, FOREIGN KEY → exams(id) ON DELETE CASCADE |
| scheduled_date | DATE          | NOT NULL                                 |
| start_time     | TIME          | NOT NULL                                 |
| end_time       | TIME          | NOT NULL                                 |
| max_slots      | INT           | NOT NULL, CHECK (> 0)                    |
| slots_taken    | INT           | NOT NULL, DEFAULT 0                      |
| venue          | VARCHAR(200)  | NULL                                     |
| created_at     | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP                |
| updated_at     | TIMESTAMP     | ON UPDATE CURRENT_TIMESTAMP              |

**Indexes:**
- INDEX `idx_schedules_exam` (exam_id)
- INDEX `idx_schedules_date` (scheduled_date)

---

### 2.8 `exam_registrations`

| Column       | Type               | Constraints                               |
|--------------|--------------------|-------------------------------------------|
| id           | INT / SERIAL       | PRIMARY KEY, AUTO_INCREMENT               |
| admission_id | INT               | NOT NULL, FOREIGN KEY → admissions(id)    |
| schedule_id  | INT               | NOT NULL, FOREIGN KEY → exam_schedules(id)|
| status       | ENUM('scheduled','started','done','cancelled') | NOT NULL, DEFAULT 'scheduled' |
| started_at   | TIMESTAMP          | NULL                                      |
| submitted_at | TIMESTAMP          | NULL                                      |
| created_at   | TIMESTAMP          | DEFAULT CURRENT_TIMESTAMP                 |

**Indexes:**
- UNIQUE INDEX `idx_reg_admission` (admission_id) — one registration per applicant
- INDEX `idx_reg_schedule` (schedule_id)
- INDEX `idx_reg_status` (status)

---

### 2.9 `exam_results`

| Column          | Type          | Constraints                              |
|-----------------|---------------|------------------------------------------|
| id              | INT / SERIAL  | PRIMARY KEY, AUTO_INCREMENT              |
| registration_id | INT          | NOT NULL, UNIQUE, FOREIGN KEY → exam_registrations(id) |
| total_score     | INT           | NOT NULL, DEFAULT 0                      |
| max_possible    | INT           | NOT NULL                                 |
| percentage      | DECIMAL(5,1)  | NOT NULL                                 |
| passed          | BOOLEAN       | NOT NULL, DEFAULT FALSE                  |
| essay_reviewed  | BOOLEAN       | NOT NULL, DEFAULT FALSE                  |
| reviewed_by     | INT           | NULL, FOREIGN KEY → users(id)            |
| created_at      | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP                |
| updated_at      | TIMESTAMP     | ON UPDATE CURRENT_TIMESTAMP              |

---

### 2.10 `submitted_answers`

| Column            | Type          | Constraints                              |
|-------------------|---------------|------------------------------------------|
| id                | INT / SERIAL  | PRIMARY KEY, AUTO_INCREMENT              |
| registration_id   | INT           | NOT NULL, FOREIGN KEY → exam_registrations(id) ON DELETE CASCADE |
| question_id       | INT           | NOT NULL, FOREIGN KEY → exam_questions(id) |
| selected_choice_id| INT           | NULL, FOREIGN KEY → question_choices(id) |
| essay_text        | TEXT          | NULL                                     |
| created_at        | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP                |

**Indexes:**
- UNIQUE INDEX `idx_answers_unique` (registration_id, question_id)

---

### 2.11 `essay_answers`

| Column          | Type          | Constraints                              |
|-----------------|---------------|------------------------------------------|
| id              | INT / SERIAL  | PRIMARY KEY, AUTO_INCREMENT              |
| registration_id | INT           | NOT NULL, FOREIGN KEY → exam_registrations(id) ON DELETE CASCADE |
| question_id     | INT           | NOT NULL, FOREIGN KEY → exam_questions(id) |
| essay_response  | TEXT          | NOT NULL                                 |
| points_awarded  | INT           | NULL                                     |
| max_points      | INT           | NOT NULL                                 |
| scored          | BOOLEAN       | NOT NULL, DEFAULT FALSE                  |
| scored_by       | INT           | NULL, FOREIGN KEY → users(id)            |
| scored_at       | TIMESTAMP     | NULL                                     |
| created_at      | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP                |

**Indexes:**
- UNIQUE INDEX `idx_essay_unique` (registration_id, question_id)

---

### 2.12 `notifications`

| Column    | Type               | Constraints                              |
|-----------|--------------------|------------------------------------------|
| id        | INT / SERIAL       | PRIMARY KEY, AUTO_INCREMENT              |
| user_id   | INT                | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE |
| type      | ENUM('info','success','warning','admission','exam','scoring','status') | NOT NULL |
| title     | VARCHAR(200)       | NOT NULL                                 |
| message   | TEXT               | NOT NULL                                 |
| is_read   | BOOLEAN            | NOT NULL, DEFAULT FALSE                  |
| created_at| TIMESTAMP          | DEFAULT CURRENT_TIMESTAMP                |

**Indexes:**
- INDEX `idx_notif_user` (user_id)
- INDEX `idx_notif_user_read` (user_id, is_read)

---

## 3. Prisma Schema (Reference)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"    // or "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  administrator
  registrar
  exam_coordinator
  applicant
}

enum UserStatus {
  Active
  Inactive
}

enum AdmissionStatus {
  Submitted
  Under_Screening    @map("Under Screening")
  Under_Evaluation   @map("Under Evaluation")
  Pending_Payment    @map("Pending Payment")
  Accepted
  Rejected
}

enum ApplicantType {
  New
  Transferee
}

enum Gender {
  Male
  Female
}

enum QuestionType {
  mc
  essay
}

enum RegistrationStatus {
  scheduled
  started
  done
  cancelled
}

model User {
  id            Int       @id @default(autoincrement())
  firstName     String    @map("first_name") @db.VarChar(100)
  lastName      String    @map("last_name") @db.VarChar(100)
  email         String    @unique @db.VarChar(255)
  passwordHash  String    @map("password_hash") @db.VarChar(255)
  role          UserRole  @default(applicant)
  status        UserStatus @default(Active)
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  admissions    Admission[]
  examsCreated  Exam[]       @relation("ExamCreator")
  reviewedResults ExamResult[] @relation("ResultReviewer")
  scoredEssays  EssayAnswer[] @relation("EssayScorer")
  notifications Notification[]

  @@map("users")
}

model Admission {
  id              Int             @id @default(autoincrement())
  userId          Int             @map("user_id")
  firstName       String          @map("first_name") @db.VarChar(100)
  lastName        String          @map("last_name") @db.VarChar(100)
  email           String          @db.VarChar(255)
  phone           String?         @db.VarChar(30)
  dob             DateTime        @db.Date
  gender          Gender
  address         String          @db.Text
  gradeLevel      String          @map("grade_level") @db.VarChar(50)
  prevSchool      String?         @map("prev_school") @db.VarChar(200)
  schoolYear      String          @map("school_year") @db.VarChar(20)
  lrn             String?         @db.VarChar(12)
  applicantType   ApplicantType   @default(New) @map("applicant_type")
  guardian        String          @db.VarChar(200)
  guardianRelation String         @map("guardian_relation") @db.VarChar(50)
  guardianPhone   String?         @map("guardian_phone") @db.VarChar(30)
  guardianEmail   String?         @map("guardian_email") @db.VarChar(255)
  status          AdmissionStatus @default(Submitted)
  notes           String?         @db.Text
  submittedAt     DateTime        @default(now()) @map("submitted_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")

  user            User            @relation(fields: [userId], references: [id])
  documents       AdmissionDocument[]
  registrations   ExamRegistration[]

  @@index([userId])
  @@index([status])
  @@index([gradeLevel])
  @@map("admissions")
}

model AdmissionDocument {
  id           Int       @id @default(autoincrement())
  admissionId  Int       @map("admission_id")
  documentName String    @map("document_name") @db.VarChar(200)
  filePath     String?   @map("file_path") @db.VarChar(500)
  uploadedAt   DateTime  @default(now()) @map("uploaded_at")

  admission    Admission @relation(fields: [admissionId], references: [id], onDelete: Cascade)

  @@map("admission_documents")
}

model Exam {
  id              Int       @id @default(autoincrement())
  title           String    @db.VarChar(200)
  gradeLevel      String    @map("grade_level") @db.VarChar(50)
  durationMinutes Int       @map("duration_minutes")
  passingScore    Decimal   @map("passing_score") @db.Decimal(5, 2)
  isActive        Boolean   @default(true) @map("is_active")
  createdById     Int?      @map("created_by")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  createdBy       User?     @relation("ExamCreator", fields: [createdById], references: [id])
  questions       ExamQuestion[]
  schedules       ExamSchedule[]

  @@map("exams")
}

model ExamQuestion {
  id           Int          @id @default(autoincrement())
  examId       Int          @map("exam_id")
  questionText String       @map("question_text") @db.Text
  questionType QuestionType @map("question_type")
  points       Int
  orderNum     Int          @map("order_num")

  exam         Exam         @relation(fields: [examId], references: [id], onDelete: Cascade)
  choices      QuestionChoice[]
  submittedAnswers SubmittedAnswer[]
  essayAnswers EssayAnswer[]

  @@unique([examId, orderNum])
  @@map("exam_questions")
}

model QuestionChoice {
  id         Int      @id @default(autoincrement())
  questionId Int      @map("question_id")
  choiceText String   @map("choice_text") @db.VarChar(500)
  isCorrect  Boolean  @default(false) @map("is_correct")
  orderNum   Int      @map("order_num")

  question   ExamQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  selectedIn SubmittedAnswer[]

  @@map("question_choices")
}

model ExamSchedule {
  id            Int      @id @default(autoincrement())
  examId        Int      @map("exam_id")
  scheduledDate DateTime @map("scheduled_date") @db.Date
  startTime     String   @map("start_time") @db.VarChar(5)
  endTime       String   @map("end_time") @db.VarChar(5)
  maxSlots      Int      @map("max_slots")
  slotsTaken    Int      @default(0) @map("slots_taken")
  venue         String?  @db.VarChar(200)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  exam          Exam     @relation(fields: [examId], references: [id], onDelete: Cascade)
  registrations ExamRegistration[]

  @@map("exam_schedules")
}

model ExamRegistration {
  id           Int                @id @default(autoincrement())
  admissionId  Int                @map("admission_id")
  scheduleId   Int                @map("schedule_id")
  status       RegistrationStatus @default(scheduled)
  startedAt    DateTime?          @map("started_at")
  submittedAt  DateTime?          @map("submitted_at")
  createdAt    DateTime           @default(now()) @map("created_at")

  admission    Admission          @relation(fields: [admissionId], references: [id])
  schedule     ExamSchedule       @relation(fields: [scheduleId], references: [id])
  result       ExamResult?
  submittedAnswers SubmittedAnswer[]
  essayAnswers EssayAnswer[]

  @@unique([admissionId])
  @@map("exam_registrations")
}

model ExamResult {
  id              Int      @id @default(autoincrement())
  registrationId  Int      @unique @map("registration_id")
  totalScore      Int      @default(0) @map("total_score")
  maxPossible     Int      @map("max_possible")
  percentage      Decimal  @db.Decimal(5, 1)
  passed          Boolean  @default(false)
  essayReviewed   Boolean  @default(false) @map("essay_reviewed")
  reviewedById    Int?     @map("reviewed_by")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  registration    ExamRegistration @relation(fields: [registrationId], references: [id])
  reviewedBy      User?    @relation("ResultReviewer", fields: [reviewedById], references: [id])

  @@map("exam_results")
}

model SubmittedAnswer {
  id               Int      @id @default(autoincrement())
  registrationId   Int      @map("registration_id")
  questionId       Int      @map("question_id")
  selectedChoiceId Int?     @map("selected_choice_id")
  essayText        String?  @map("essay_text") @db.Text
  createdAt        DateTime @default(now()) @map("created_at")

  registration     ExamRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  question         ExamQuestion     @relation(fields: [questionId], references: [id])
  selectedChoice   QuestionChoice?  @relation(fields: [selectedChoiceId], references: [id])

  @@unique([registrationId, questionId])
  @@map("submitted_answers")
}

model EssayAnswer {
  id              Int       @id @default(autoincrement())
  registrationId  Int       @map("registration_id")
  questionId      Int       @map("question_id")
  essayResponse   String    @map("essay_response") @db.Text
  pointsAwarded   Int?      @map("points_awarded")
  maxPoints       Int       @map("max_points")
  scored          Boolean   @default(false)
  scoredById      Int?      @map("scored_by")
  scoredAt        DateTime? @map("scored_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  registration    ExamRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  question        ExamQuestion     @relation(fields: [questionId], references: [id])
  scoredBy        User?    @relation("EssayScorer", fields: [scoredById], references: [id])

  @@unique([registrationId, questionId])
  @@map("essay_answers")
}

model Notification {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  type      String   @db.VarChar(50)
  title     String   @db.VarChar(200)
  message   String   @db.Text
  isRead    Boolean  @default(false) @map("is_read")
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isRead])
  @@map("notifications")
}
```

---

## 4. Migration from localStorage

### Current → Database Field Mapping

| localStorage Field      | Database Column          | Notes |
|-------------------------|--------------------------|-------|
| `admissions[].id`       | `admissions.id`          | Auto-increment replaces `nextId` |
| `admissions[].documents`| `admission_documents`    | Array → separate table |
| `exams[].questions`     | `exam_questions`         | Nested array → separate table |
| `questions[].choices`   | `question_choices`       | Nested array → separate table |
| `users[].password`      | `users.password_hash`    | Plaintext → bcrypt hash |
| `notifications[].userId`| `notifications.user_id`  | String "student_3" → INT FK |
| `nextId`, `nextExamId`  | *(removed)*              | Database auto-increment handles this |

### Notification userId Migration

Current format uses string prefixes (`student_3`, `employee_1`, `employee`). The database version uses integer foreign keys to `users.id`. Employee-wide notifications can be handled by:
- Option A: Insert one notification per employee user
- Option B: Add a `target_role` column for role-based targeting

---

## 5. Seed Data SQL

```sql
-- Users (passwords are bcrypt hashes of the plaintext values)
INSERT INTO users (first_name, last_name, email, password_hash, role, status) VALUES
('Admin', 'Staff', 'admin@goldenkey.edu', '$2b$12$...hash_of_admin123...', 'administrator', 'Active'),
('Registrar', 'Office', 'registrar@goldenkey.edu', '$2b$12$...hash_of_admin123...', 'registrar', 'Active'),
('Maria', 'Santos', 'maria.santos@email.com', '$2b$12$...hash_of_student123...', 'applicant', 'Active'),
('Juan', 'Dela Cruz', 'juan.dc@email.com', '$2b$12$...hash_of_student123...', 'applicant', 'Active');
```

*Full seed data script will be generated in the `prisma/seed.js` file during backend scaffolding.*
