// ============================================
// seed-data.js — Default seed data for localStorage
// ============================================
// ⚠️ SECURITY NOTE: Passwords are stored in plaintext for the localStorage demo mode only.
// In production with a real backend (USE_API=true), the backend handles password hashing
// with bcrypt/argon2 and these seed passwords are irrelevant.
export const defaultData = {
  admissions: [
    { id: 1, firstName: "Maria", lastName: "Santos", email: "maria.santos@email.com", phone: "+63 912 345 6789", dob: "2010-05-14", gender: "Female", address: "123 Rizal St, San Jose, Batangas", gradeLevel: "Grade 7", prevSchool: "Manila Elementary School", schoolYear: "2026-2027", lrn: "123456789012", applicantType: "New", guardian: "Elena Santos", guardianRelation: "Mother", guardianPhone: "+63 912 000 1111", guardianEmail: "elena.santos@email.com", status: "Accepted", submittedAt: "2026-02-18T09:30:00", documents: ["PSA Birth Certificate", "2x2 ID Photos", "Baptismal Certificate", "Report Card / Form 138", "Certificate of Good Moral Character", "Latest Income Tax Return"], notes: "Complete requirements. Approved for admission." },
    { id: 2, firstName: "Juan", lastName: "Dela Cruz", email: "juan.dc@email.com", phone: "+63 917 654 3210", dob: "2009-11-22", gender: "Male", address: "456 Mabini Ave, San Jose, Batangas", gradeLevel: "Grade 11 — STEM", prevSchool: "Makati High School", schoolYear: "2026-2027", lrn: "234567890123", applicantType: "Transferee", guardian: "Pedro Dela Cruz", guardianRelation: "Father", guardianPhone: "+63 917 000 2222", guardianEmail: "", status: "Under Screening", submittedAt: "2026-02-20T14:15:00", documents: ["PSA Birth Certificate", "Report Card / Form 138"], notes: "" },
    { id: 3, firstName: "Ana", lastName: "Reyes", email: "ana.reyes@email.com", phone: "+63 926 111 2233", dob: "2011-03-08", gender: "Female", address: "789 Luna St, San Jose, Batangas", gradeLevel: "Grade 10", prevSchool: "Pasig National High School", schoolYear: "2026-2027", lrn: "345678901234", applicantType: "New", guardian: "Rosa Reyes", guardianRelation: "Mother", guardianPhone: "+63 926 000 3333", guardianEmail: "", status: "Under Evaluation", submittedAt: "2026-02-19T11:00:00", documents: ["PSA Birth Certificate", "2x2 ID Photos", "Baptismal Certificate", "Report Card / Form 138", "Certificate of Good Moral Character", "ESC Certificate"], notes: "Excellent grades. Scholarship candidate." },
    { id: 4, firstName: "Carlos", lastName: "Garcia", email: "c.garcia@email.com", phone: "+63 935 222 4455", dob: "2012-07-30", gender: "Male", address: "321 Aguinaldo Blvd, San Jose, Batangas", gradeLevel: "Grade 8", prevSchool: "Cavite Academy", schoolYear: "2026-2027", lrn: "", applicantType: "Transferee", guardian: "Jose Garcia", guardianRelation: "Father", guardianPhone: "+63 935 000 4444", guardianEmail: "", status: "Rejected", submittedAt: "2026-02-21T16:45:00", documents: ["Report Card / Form 138"], notes: "Incomplete requirements. Missing PSA birth certificate and good moral." },
    { id: 5, firstName: "Isabella", lastName: "Torres", email: "bella.t@email.com", phone: "+63 905 333 6677", dob: "2008-12-15", gender: "Female", address: "567 Bonifacio Dr, San Jose, Batangas", gradeLevel: "Grade 12 — ABM", prevSchool: "BGC International School", schoolYear: "2026-2027", lrn: "567890123456", applicantType: "New", guardian: "Carmen Torres", guardianRelation: "Mother", guardianPhone: "+63 905 000 5555", guardianEmail: "", status: "Submitted", submittedAt: "2026-02-22T08:20:00", documents: ["PSA Birth Certificate", "2x2 ID Photos", "Report Card / Form 138", "Certificate of Good Moral Character"], notes: "" },
    { id: 6, firstName: "Miguel", lastName: "Ramos", email: "m.ramos@email.com", phone: "+63 918 444 8899", dob: "2011-09-03", gender: "Male", address: "890 Del Pilar St, San Jose, Batangas", gradeLevel: "Grade 9", prevSchool: "Manila Science High School", schoolYear: "2026-2027", lrn: "678901234567", applicantType: "New", guardian: "Luis Ramos", guardianRelation: "Father", guardianPhone: "+63 918 000 6666", guardianEmail: "", status: "Under Evaluation", submittedAt: "2026-02-23T10:00:00", documents: ["PSA Birth Certificate", "2x2 ID Photos", "Report Card / Form 138"], notes: "" },
  ],
  nextId: 7,
  exams: [
    {
      id: 1, title: "Entrance Exam — Grade 7-10", gradeLevel: "Grade 7-10", durationMinutes: 60, passingScore: 60, isActive: true, createdBy: "Admin",
      questions: [
        { id: 1, questionText: "What is the capital of the Philippines?", questionType: "mc", points: 5, orderNum: 1, choices: [{ id: 1, choiceText: "Cebu", isCorrect: false }, { id: 2, choiceText: "Manila", isCorrect: true }, { id: 3, choiceText: "Davao", isCorrect: false }, { id: 4, choiceText: "Quezon City", isCorrect: false }] },
        { id: 2, questionText: "Solve: 15 × 8 + 12 = ?", questionType: "mc", points: 5, orderNum: 2, choices: [{ id: 5, choiceText: "120", isCorrect: false }, { id: 6, choiceText: "132", isCorrect: true }, { id: 7, choiceText: "140", isCorrect: false }, { id: 8, choiceText: "128", isCorrect: false }] },
        { id: 3, questionText: "Which planet is known as the Red Planet?", questionType: "mc", points: 5, orderNum: 3, choices: [{ id: 9, choiceText: "Venus", isCorrect: false }, { id: 10, choiceText: "Jupiter", isCorrect: false }, { id: 11, choiceText: "Mars", isCorrect: true }, { id: 12, choiceText: "Saturn", isCorrect: false }] },
        { id: 4, questionText: "What is the Filipino word for 'freedom'?", questionType: "mc", points: 5, orderNum: 4, choices: [{ id: 13, choiceText: "Kalayaan", isCorrect: true }, { id: 14, choiceText: "Kapayapaan", isCorrect: false }, { id: 15, choiceText: "Kasarinlan", isCorrect: false }, { id: 16, choiceText: "Katarungan", isCorrect: false }] },
        { id: 5, questionText: "Who is the national hero of the Philippines?", questionType: "mc", points: 5, orderNum: 5, choices: [{ id: 17, choiceText: "Andres Bonifacio", isCorrect: false }, { id: 18, choiceText: "Jose Rizal", isCorrect: true }, { id: 19, choiceText: "Emilio Aguinaldo", isCorrect: false }, { id: 20, choiceText: "Apolinario Mabini", isCorrect: false }] },
        { id: 6, questionText: "Simplify: 3/4 + 1/2 = ?", questionType: "mc", points: 5, orderNum: 6, choices: [{ id: 21, choiceText: "1", isCorrect: false }, { id: 22, choiceText: "5/4", isCorrect: true }, { id: 23, choiceText: "4/6", isCorrect: false }, { id: 24, choiceText: "7/4", isCorrect: false }] },
        { id: 7, questionText: "What is the largest organ in the human body?", questionType: "mc", points: 5, orderNum: 7, choices: [{ id: 25, choiceText: "Heart", isCorrect: false }, { id: 26, choiceText: "Liver", isCorrect: false }, { id: 27, choiceText: "Skin", isCorrect: true }, { id: 28, choiceText: "Brain", isCorrect: false }] },
        { id: 8, questionText: "Which of the following is a renewable energy source?", questionType: "mc", points: 5, orderNum: 8, choices: [{ id: 29, choiceText: "Coal", isCorrect: false }, { id: 30, choiceText: "Natural Gas", isCorrect: false }, { id: 31, choiceText: "Solar Energy", isCorrect: true }, { id: 32, choiceText: "Petroleum", isCorrect: false }] },
        { id: 9, questionText: "What is the value of x if 2x + 6 = 20?", questionType: "mc", points: 5, orderNum: 9, choices: [{ id: 33, choiceText: "5", isCorrect: false }, { id: 34, choiceText: "7", isCorrect: true }, { id: 35, choiceText: "8", isCorrect: false }, { id: 36, choiceText: "10", isCorrect: false }] },
        { id: 10, questionText: "Write a short paragraph about why education is important.", questionType: "essay", points: 15, orderNum: 10, choices: [] },
      ],
    },
    {
      id: 2, title: "Entrance Exam — Senior High", gradeLevel: "Grade 11-12", durationMinutes: 90, passingScore: 70, isActive: true, createdBy: "Admin",
      questions: [
        { id: 11, questionText: "What is the derivative of f(x) = 3x² + 2x?", questionType: "mc", points: 5, orderNum: 1, choices: [{ id: 37, choiceText: "6x + 2", isCorrect: true }, { id: 38, choiceText: "3x + 2", isCorrect: false }, { id: 39, choiceText: "6x² + 2", isCorrect: false }, { id: 40, choiceText: "x² + 2x", isCorrect: false }] },
        { id: 12, questionText: "Who wrote 'Noli Me Tangere'?", questionType: "mc", points: 5, orderNum: 2, choices: [{ id: 41, choiceText: "Andres Bonifacio", isCorrect: false }, { id: 42, choiceText: "Jose Rizal", isCorrect: true }, { id: 43, choiceText: "Marcelo H. del Pilar", isCorrect: false }, { id: 44, choiceText: "Graciano Lopez Jaena", isCorrect: false }] },
        { id: 13, questionText: "Discuss the importance of critical thinking in modern education.", questionType: "essay", points: 20, orderNum: 3, choices: [] },
      ],
    },
  ],
  examSchedules: [
    { id: 1, examId: 1, scheduledDate: "2026-03-05", startTime: "09:00", endTime: "10:00", maxSlots: 30, slotsTaken: 12 },
    { id: 2, examId: 1, scheduledDate: "2026-03-12", startTime: "09:00", endTime: "10:00", maxSlots: 30, slotsTaken: 8 },
    { id: 3, examId: 2, scheduledDate: "2026-03-12", startTime: "13:00", endTime: "14:30", maxSlots: 25, slotsTaken: 5 },
    { id: 4, examId: 1, scheduledDate: "2026-03-20", startTime: "09:00", endTime: "10:00", maxSlots: 30, slotsTaken: 0 },
  ],
  examRegistrations: [
    { id: 1, userEmail: "maria.santos@email.com", scheduleId: 1, status: "done", startedAt: "2026-03-05T09:02:00", submittedAt: "2026-03-05T09:55:00" },
    { id: 2, userEmail: "ana.reyes@email.com", scheduleId: 1, status: "done", startedAt: "2026-03-05T09:01:00", submittedAt: "2026-03-05T09:48:00" },
  ],
  examResults: [
    { id: 1, registrationId: 1, totalScore: 47, maxPossible: 60, percentage: 78.3, passed: true, essayReviewed: true, reviewedBy: "Admin", createdAt: "2026-03-05T10:30:00" },
    { id: 2, registrationId: 2, totalScore: 45, maxPossible: 60, percentage: 75.0, passed: false, essayReviewed: false, reviewedBy: null, createdAt: "2026-03-05T10:30:00" },
  ],
  essayAnswers: [
    { id: 1, registrationId: 1, questionId: 10, essayResponse: "Education is the foundation of a progressive society. It empowers individuals with knowledge and critical thinking skills...", pointsAwarded: 12, maxPoints: 15, scored: true },
    { id: 2, registrationId: 2, questionId: 10, essayResponse: "I believe education is very important because it helps us learn new things and prepares us for the future...", pointsAwarded: null, maxPoints: 15, scored: false },
  ],
  notifications: [
    { id: 1, userId: "student_3", type: "admission", title: "Application Received", message: "Your admission application has been received.", isRead: true, createdAt: "2026-02-23T10:05:00" },
    { id: 2, userId: "student_3", type: "status", title: "Status Updated", message: "Your application status has been updated to: Under Screening.", isRead: false, createdAt: "2026-02-24T14:00:00" },
    { id: 3, userId: "student_3", type: "exam", title: "Exam Scheduled", message: "You have been scheduled for the Entrance Exam on March 5, 2026.", isRead: false, createdAt: "2026-02-25T09:00:00" },
    { id: 4, userId: "employee_1", type: "admission", title: "New Application", message: "New admission application received from Miguel Ramos.", isRead: false, createdAt: "2026-02-23T10:01:00" },
    { id: 5, userId: "employee_1", type: "exam", title: "Exam Update", message: "Entrance Exam Batch 1 has 12 registered applicants.", isRead: true, createdAt: "2026-02-24T08:00:00" },
    { id: 6, userId: "employee_1", type: "scoring", title: "Essay Review", message: "2 essay answers are pending review.", isRead: false, createdAt: "2026-02-25T11:00:00" },
  ],
  nextExamId: 3,
  nextScheduleId: 5,
  nextRegistrationId: 3,
  nextNotificationId: 7,
  users: [
    { id: 1, firstName: "Admin", lastName: "Staff", email: "admin@goldenkey.edu", password: "admin123", role: "administrator", status: "Active", isActive: true, createdAt: "2026-01-01T00:00:00" },
    { id: 2, firstName: "Registrar", lastName: "Office", email: "registrar@goldenkey.edu", password: "admin123", role: "registrar", status: "Active", isActive: true, createdAt: "2026-01-01T00:00:00" },
    { id: 9, firstName: "Teacher", lastName: "Examiner", email: "teacher@goldenkey.edu", password: "admin123", role: "teacher", status: "Active", isActive: true, createdAt: "2026-01-01T00:00:00" },
    { id: 3, firstName: "Maria", lastName: "Santos", email: "maria.santos@email.com", password: "student123", role: "applicant", status: "Active", isActive: true, createdAt: "2026-02-18T09:30:00" },
    { id: 4, firstName: "Juan", lastName: "Dela Cruz", email: "juan.dc@email.com", password: "student123", role: "applicant", status: "Active", isActive: true, createdAt: "2026-02-20T14:15:00" },
    { id: 5, firstName: "Ana", lastName: "Reyes", email: "ana.reyes@email.com", password: "student123", role: "applicant", status: "Active", isActive: true, createdAt: "2026-02-19T11:00:00" },
    { id: 6, firstName: "Carlos", lastName: "Garcia", email: "c.garcia@email.com", password: "student123", role: "applicant", status: "Active", isActive: true, createdAt: "2026-02-21T16:45:00" },
    { id: 7, firstName: "Isabella", lastName: "Torres", email: "bella.t@email.com", password: "student123", role: "applicant", status: "Active", isActive: true, createdAt: "2026-02-22T08:20:00" },
    { id: 8, firstName: "Miguel", lastName: "Ramos", email: "m.ramos@email.com", password: "student123", role: "applicant", status: "Active", isActive: true, createdAt: "2026-02-23T10:00:00" },
  ],
  nextUserId: 10,
  submittedAnswers: [
    { registrationId: 1, questionId: 1, selectedChoiceId: 2, essayText: null },
    { registrationId: 1, questionId: 2, selectedChoiceId: 6, essayText: null },
    { registrationId: 1, questionId: 3, selectedChoiceId: 11, essayText: null },
    { registrationId: 1, questionId: 4, selectedChoiceId: 13, essayText: null },
    { registrationId: 1, questionId: 5, selectedChoiceId: 18, essayText: null },
    { registrationId: 1, questionId: 6, selectedChoiceId: 23, essayText: null },
    { registrationId: 1, questionId: 7, selectedChoiceId: 27, essayText: null },
    { registrationId: 1, questionId: 8, selectedChoiceId: 29, essayText: null },
    { registrationId: 1, questionId: 9, selectedChoiceId: 34, essayText: null },
    { registrationId: 1, questionId: 10, selectedChoiceId: null, essayText: "Education is the foundation of a progressive society..." },
    { registrationId: 2, questionId: 1, selectedChoiceId: 2, essayText: null },
    { registrationId: 2, questionId: 2, selectedChoiceId: 6, essayText: null },
    { registrationId: 2, questionId: 3, selectedChoiceId: 11, essayText: null },
    { registrationId: 2, questionId: 4, selectedChoiceId: 13, essayText: null },
    { registrationId: 2, questionId: 5, selectedChoiceId: 18, essayText: null },
    { registrationId: 2, questionId: 6, selectedChoiceId: 22, essayText: null },
    { registrationId: 2, questionId: 7, selectedChoiceId: 27, essayText: null },
    { registrationId: 2, questionId: 8, selectedChoiceId: 31, essayText: null },
    { registrationId: 2, questionId: 9, selectedChoiceId: 34, essayText: null },
    { registrationId: 2, questionId: 10, selectedChoiceId: null, essayText: "I believe education is very important because it helps us learn..." },
  ],
};
