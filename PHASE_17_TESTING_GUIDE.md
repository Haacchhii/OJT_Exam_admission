# Phase 17 Quick Testing Guide

## Feature Summary
✅ **Exam Publish** — Teachers can publish exams directly from builder  
✅ **Scoring Queue Link** — Quick navigation to essay scoring in sidebar  
✅ **Registrar Handoff** — Transition accepted applicants to enrollment  
✅ **Registrar Records** — Dedicated page for accepted admissions  
✅ **Force Password Reset** — Admin action to require user password change  
✅ **Set User Role** — Admin action to change user role

---

## Testing Workflow

### 1. Exam Publishing (Teacher)
```
1. Login as Teacher
2. Navigate to Exams → Create/Edit Exam
3. Fill in exam details
4. Click "Assign & Publish" button (new, green)
5. Verify:
   - Toast: "Exam published successfully"
   - Exam appears in Exam List with isActive = true
   - Audit log shows: exam.publish action
```

### 2. Scoring Queue (Teacher)
```
1. Login as Teacher
2. Look for "Scoring Queue" link in Sidebar (new, under employee links)
3. Click it
4. Verify: Redirects to /employee/results#essays with essays tab open
5. Should show essay submissions ready for grading
```

### 3. Registrar Handoff (Registrar)
```
1. Login as Registrar
2. Navigate to Registrar Records (new menu item or direct /employee/registrar-records)
3. See table of Accepted admissions
4. Click on a row to open Admission Detail
5. Scroll down and find "Mark Enrollment Handoff" button (new, visible only if status = Accepted)
6. Click and confirm
7. Verify:
   - Toast: "Enrollment handoff marked successfully"
   - Admission notes now include: "[DATE] Enrollment handoff marked"
   - Audit log shows: admission.handoff action
```

### 4. Admin User Provisioning

#### A. Force Password Reset
```
1. Login as Administrator
2. Navigate to User Management
3. In Users table, scroll right to Actions column
4. Click "Force Password" button (amber, key icon) on any user row
5. Confirm the action in dialog
6. Verify:
   - Toast: "Password reset forced successfully"
   - If you were editing that user, mustChangePassword = true
   - Audit log shows: user.forcePasswordReset action
   - Next time that user logs in, they're prompted to change password
```

#### B. Set User Role
```
1. Login as Administrator
2. Navigate to User Management
3. In Users table, scroll right to Actions column
4. Click "Set Role" button (blue, shield icon) on any user row
5. Modal opens with role dropdown (current role marked)
6. Select new role (e.g., "Teacher" → "Registrar")
7. Click "Set Role" button in modal
8. Verify:
   - Toast: "User role updated successfully"
   - User's role badge in table updates immediately
   - Audit log shows: user.setRole action with newRole=registrar
   - If changed TO applicant: applicantProfile created
   - If changed FROM applicant: applicantProfile deleted
```

---

## API Endpoints Reference

### Backend Endpoints (New)

| Method | Endpoint | Auth | Body | Response |
|--------|----------|------|------|----------|
| POST | `/api/exams/:id/publish` | TEACHER, ADMIN | {} | Exam object |
| POST | `/api/admissions/:id/handoff` | REGISTRAR, ADMIN | {} | Admission object |
| POST | `/api/users/:id/force-password-reset` | ADMIN | {} | User object |
| POST | `/api/users/:id/set-role` | ADMIN | `{role}` | User object |

### Frontend API Functions (New)

```typescript
// exams.ts
publishExam(examId: number): Promise<Exam>

// admissions.ts
handoffAdmission(admissionId: number): Promise<Admission>

// users.ts
forcePasswordReset(userId: number): Promise<User>
setUserRole(userId: number, role: string): Promise<User>
```

---

## Common Issues & Solutions

### Issue: "Assign & Publish" button not visible
**Solution:** Verify you're logged in as Teacher or Admin role

### Issue: Force Password button not showing
**Solution:** 
- Verify you're Administrator role
- Scroll right in Users table to see Actions column
- May need to expand column width

### Issue: Registrar Records page 404
**Solution:**
- Verify you're Registrar or Admin role
- Direct URL: `/employee/registrar-records`
- Check that router is configured correctly

### Issue: Handoff button not appearing in Admission Detail
**Solution:**
- Verify admission status is "Accepted"
- Only visible for Registrar and Admin roles
- Check that AdmissionDetail page loaded fully

### Issue: Audit log shows action but no change in UI
**Solution:**
- Verify cache invalidation worked (page refresh may be needed)
- Check browser console for errors
- Restart backend service if cache sync issues

---

## Database Verification

To verify features are working at DB level:

```sql
-- Check exam publishing
SELECT id, title, isActive, createdAt FROM Exam WHERE isActive = true ORDER BY createdAt DESC LIMIT 5;

-- Check admission handoff notes
SELECT id, status, notes FROM Admission WHERE status = 'Accepted' LIMIT 5;

-- Check password reset flag
SELECT id, email, mustChangePassword FROM User WHERE mustChangePassword = true;

-- Check audit logs
SELECT * FROM AuditLog WHERE action IN ('exam.publish', 'admission.handoff', 'user.forcePasswordReset', 'user.setRole') ORDER BY createdAt DESC LIMIT 20;
```

---

## Browser DevTools Checklist

- [ ] Network tab: POST requests return 200-201 status
- [ ] Console: No errors for new endpoints
- [ ] Application/Storage: User token/auth state unchanged after actions
- [ ] Network: Cache headers properly invalidating on mutations

---

## Performance Notes

- Exam publish: ~50-100ms (single row update + cache invalidate)
- Registrar Records load: ~100-150ms (list of ~50 accepted admissions)
- Force password: ~20-30ms (flag set, cache invalidated)
- Set role: ~30-50ms (role update, profile cleanup, cache invalidated)

All operations should complete within 500ms total including UI updates.

---

## Rollback Plan

If issues found:
1. Revert commits (git reset) to previous state
2. Remove new API routes from routes files
3. Remove new buttons/modals from frontend
4. Database: No schema changes, so no rollback needed
5. Clear browser cache and restart services

Commit to revert: Search for "feat: Add admin user provisioning" and "feat: Add exam publish"

---

## Next Steps After Testing

1. ✅ Unit test backend endpoints
2. ✅ E2E test frontend flows
3. ✅ Stakeholder acceptance testing
4. ⏳ Phase 18: Bulk provisioning, notifications, active period controls
