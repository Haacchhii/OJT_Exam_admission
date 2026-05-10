# Test Accounts for Role-Based System Testing
## School Stage Workflows - May 10, 2026

---

## 📋 Overview

This document outlines **6 test applicant accounts** divided into **2 distinct workflow types** based on school stage:

| **School Stage** | **Grades** | **Workflow Path** | **Exam Required?** |
|---|---|---|---|
| **Preschool** | Nursery, Kinder | Registration → Application Form | ❌ No |
| **Grade School (Elementary)** | Grade 1-6 | Registration → Application Form | ❌ No |
| **Junior High School** | Grade 7-10 | Registration → **Exam** → Application Form | ✅ Yes |
| **Senior High School** | Grade 11-12 (ABM/STEM/HUMSS) | Registration → **Exam** → Application Form | ✅ Yes |

---

## 👤 Test Accounts

### **WORKFLOW 1: Straight to Admissions (No Exams)**
*These learners bypass the entrance exam and proceed directly to the application form.*

#### Account 1: Preschool Level
```
Name:           Sofia Maria Santos
Email:          sofia.santos.preschool@testaccount.edu
Password:       TestPass123!
Grade Level:    Kinder
School Stage:   Preschool
Email Verified: ✅ Yes
Status:         Active
```
**Testing Scenario:**
1. Login with Sofia's credentials
2. Dashboard should show **"No exams available"** or **"Not applicable to your level"**
3. Click "Start Application" → Fill admission form
4. No exam scheduling or taking steps required
5. Submit application and verify it appears in system

---

#### Account 2: Elementary Level
```
Name:           Lucas Angelo Reyes
Email:          lucas.reyes.elementary@testaccount.edu
Password:       TestPass123!
Grade Level:    Grade 4
School Stage:   Grade School
Email Verified: ✅ Yes
Status:         Active
```
**Testing Scenario:**
1. Login with Lucas's credentials
2. Dashboard should show **"No exams available"** or **"Not applicable to your level"**
3. Click "Start Application" → Fill admission form
4. No exam scheduling or taking steps required
5. Submit application and verify it appears in system

---

### **WORKFLOW 2: Exam FIRST → Then Admissions**
*These learners must take the entrance exam BEFORE they can access the application form.*

#### Account 3: Junior High (Grade 7)
```
Name:           Maria Clara Diaz
Email:          maria.diaz.jhs@testaccount.edu
Password:       TestPass123!
Grade Level:    Grade 7
School Stage:   Junior High School
Email Verified: ✅ Yes
Status:         Active
```
**Testing Scenario:**
1. Login with Maria's credentials
2. Dashboard should show **"Upcoming Exams"** section
3. Find scheduled exam matching Grade 7 exams
4. Click exam → Take exam (answer questions, submit)
5. System marks exam status as "Submitted" or "Completed"
6. After exam submission, **"Start Application"** button becomes available
7. Fill and submit admission form
8. Verify application shows exam was completed before submission

---

#### Account 4: Junior High (Grade 10)
```
Name:           Juan Carlo Cruz
Email:          juan.cruz.jhs@testaccount.edu
Password:       TestPass123!
Grade Level:    Grade 10
School Stage:   Junior High School
Email Verified: ✅ Yes
Status:         Active
```
**Testing Scenario:**
1. Login with Juan's credentials
2. Dashboard should show **"Upcoming Exams"** section
3. Find scheduled exam matching Grade 10 exams
4. Click exam → Take exam (answer questions, submit)
5. Verify exam submission recorded
6. Proceed to application form after exam
7. Verify application shows connection to exam taken

---

#### Account 5: Senior High (STEM Track)
```
Name:           Alejandro Miguel Garcia
Email:          alejandro.garcia.stem@testaccount.edu
Password:       TestPass123!
Grade Level:    Grade 11 — STEM
School Stage:   Senior High School
Email Verified: ✅ Yes
Status:         Active
```
**Testing Scenario:**
1. Login with Alejandro's credentials
2. Dashboard should show **"Upcoming Exams"** section with STEM exams
3. Find scheduled exam for **Grade 11-12 or "Grade 11 — STEM"**
4. Click exam → Take exam → Submit answers
5. After exam, access **"Start Application"** button
6. Fill detailed admission form for senior high applicants
7. Submit and verify system links exam result to application
8. In admin portal, verify STEM track is correctly identified

---

#### Account 6: Senior High (HUMSS Track)
```
Name:           Isabela Rosario Fernandez
Email:          isabela.fernandez.humss@testaccount.edu
Password:       TestPass123!
Grade Level:    Grade 11 — HUMSS
School Stage:   Senior High School
Email Verified: ✅ Yes
Status:         Active
```
**Testing Scenario:**
1. Login with Isabela's credentials
2. Dashboard should show **"Upcoming Exams"** section with HUMSS exams
3. Find scheduled exam for **Grade 11-12 or "Grade 11 — HUMSS"**
4. Click exam → Take exam → Submit answers
5. After exam, access **"Start Application"** button
6. Fill detailed admission form for senior high applicants
7. Submit and verify system links exam result to application
8. In admin portal, verify HUMSS track is correctly identified

---

## 🔑 Quick Reference

### Login Credentials (All Accounts)
| Account | Email | Password |
|---|---|---|
| Sofia (Preschool) | sofia.santos.preschool@testaccount.edu | TestPass123! |
| Lucas (Grade 4) | lucas.reyes.elementary@testaccount.edu | TestPass123! |
| Maria (Grade 7) | maria.diaz.jhs@testaccount.edu | TestPass123! |
| Juan (Grade 10) | juan.cruz.jhs@testaccount.edu | TestPass123! |
| Alejandro (Grade 11 STEM) | alejandro.garcia.stem@testaccount.edu | TestPass123! |
| Isabela (Grade 11 HUMSS) | isabela.fernandez.humss@testaccount.edu | TestPass123! |

### All Accounts Status
- ✅ Email Verified (no verification email needed)
- ✅ Account Active (ready for immediate login)
- ✅ Role: Applicant
- ✅ No guardian/parent info pre-filled (allows testing of data entry)

---

## 🧪 Test Scenarios by Role

### **As System Administrator**
**Test Data Visibility:**
1. Navigate to **Users → Applicants** or **Applications**
2. You should see all 6 test accounts segregated by grade level
3. Filter by grade level: confirm Preschool/Elementary separated from JHS/SHS
4. Verify each account shows correct:
   - Grade Level
   - Level Group (Preschool, Grade School, Junior High School, Senior High School)
   - Email Verified status (all should be ✅)
   - Application status (Submitted if they filled form)

### **As Registrar**
**Document Review:**
1. Open application queue
2. You should see applications from these 6 test accounts
3. Sort by school stage and verify:
   - Preschool/Elementary applications have NO exam requirement noted
   - JHS/SHS applications show exam was taken BEFORE application
4. Review and verify each application's documents
5. Update status for test accounts to track workflow

### **As Teacher**
**Exam Scoring (if applicable):**
1. Navigate to **Assigned Exams**
2. If exams are assigned to your courses, you should see submissions from:
   - Maria (Grade 7), Juan (Grade 10) from Junior High
   - Alejandro (STEM), Isabela (HUMSS) from Senior High
3. Score essays and provide feedback (if applicable)
4. Publish scores to observe student view

### **As Applicant (Student)**
**Application Journey:**
1. **Sofia/Lucas Path (No Exam):**
   - Login → Dashboard shows no exams → Click "Start Application" immediately
   
2. **Maria/Juan/Alejandro/Isabela Path (Exam First):**
   - Login → Dashboard shows "Upcoming Exams" → Take exam first
   - After exam submission → "Start Application" becomes enabled
   - Fill application form
   - See application status update

---

## 🚀 How to Run the Seeding Script

### Step 1: Navigate to Backend Directory
```bash
cd golden/backend
```

### Step 2: Ensure Dependencies
```bash
npm install  # if not already done
```

### Step 3: Run the Seed Script
```bash
node prisma/seed-role-test-accounts.js
```

### Expected Output
```
🌱 Starting test account seeding...

✅ Created: Sofia Maria Santos
   Email: sofia.santos.preschool@testaccount.edu
   Grade: Kinder
   School Stage: Preschool
   Workflow: Straight to Admissions (No Exam)
   Password: TestPass123!
   Status: Email Verified ✓

✅ Created: Lucas Angelo Reyes
   ...

✨ Seeding complete!

═══════════════════════════════════════════════════
TEST ACCOUNT SUMMARY
═══════════════════════════════════════════════════

📌 PRESCHOOL & ELEMENTARY (No Exams - Straight to Admissions):
...
```

---

## ✅ Verification Checklist

After running the seeding script, verify in your system:

- [ ] All 6 accounts appear in the admin user list
- [ ] All accounts show `emailVerified = true`
- [ ] All accounts have status `Active`
- [ ] Sofia and Lucas (no-exam group) have separate dashboard view from others
- [ ] Maria, Juan, Alejandro, Isabela (exam-required group) see exam schedule
- [ ] Grade levels are correctly mapped to school stages:
  - Kinder → Preschool ✓
  - Grade 4 → Grade School ✓
  - Grade 7, 10 → Junior High School ✓
  - Grade 11 STEM/HUMSS → Senior High School ✓
- [ ] Can login with each account using password `TestPass123!`

---

## 📝 Notes for QA Testers

1. **These are test/demo accounts** — feel free to delete them after testing and reseed as needed
2. **Email addresses are not real** — they won't receive actual emails (by design for testing)
3. **Password is standard** — make sure to change if used in production
4. **Workflow validation** — the key test is ensuring Preschool/Elementary skip exams while JHS/SHS require them
5. **Document any issues** where the system doesn't correctly enforce the exam-requirement logic

---

**Created:** May 10, 2026  
**For:** Online Admission and Examination Management System QA Testing  
**Version:** 1.0
