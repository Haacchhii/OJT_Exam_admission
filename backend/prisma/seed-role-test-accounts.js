import { PrismaClient } from '../generated/prisma-client/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;
const TEST_PASSWORD = 'TestPass123!';

/**
 * SCHOOL STAGES MAPPING:
 * Preschool: Nursery, Kinder → Skip Exams, go straight to Admissions
 * Grade School (Elementary): Grade 1-6 → Skip Exams, go straight to Admissions
 * Junior High: Grade 7-10 → Must take Exam FIRST, then Admissions
 * Senior High: Grade 11-12 (ABM/STEM/HUMSS) → Must take Exam FIRST, then Admissions
 */

const TEST_ACCOUNTS = [
  // PRESCHOOL - No Exam, Straight to Admissions
  {
    firstName: 'Sofia',
    middleName: 'Maria',
    lastName: 'Santos',
    email: 'sofia.santos.preschool@testaccount.edu',
    gradeLevel: 'Kinder',
    schoolStage: 'Preschool',
    workflow: 'Straight to Admissions (No Exam)',
    role: 'applicant',
  },
  // ELEMENTARY - No Exam, Straight to Admissions
  {
    firstName: 'Lucas',
    middleName: 'Angelo',
    lastName: 'Reyes',
    email: 'lucas.reyes.elementary@testaccount.edu',
    gradeLevel: 'Grade 4',
    schoolStage: 'Grade School',
    workflow: 'Straight to Admissions (No Exam)',
    role: 'applicant',
  },
  // JUNIOR HIGH - Exam FIRST, then Admissions
  {
    firstName: 'Maria',
    middleName: 'Clara',
    lastName: 'Diaz',
    email: 'maria.diaz.jhs@testaccount.edu',
    gradeLevel: 'Grade 7',
    schoolStage: 'Junior High School',
    workflow: 'Exam First → Then Admissions',
    role: 'applicant',
  },
  {
    firstName: 'Juan',
    middleName: 'Carlo',
    lastName: 'Cruz',
    email: 'juan.cruz.jhs@testaccount.edu',
    gradeLevel: 'Grade 10',
    schoolStage: 'Junior High School',
    workflow: 'Exam First → Then Admissions',
    role: 'applicant',
  },
  // SENIOR HIGH - Exam FIRST, then Admissions
  {
    firstName: 'Alejandro',
    middleName: 'Miguel',
    lastName: 'Garcia',
    email: 'alejandro.garcia.stem@testaccount.edu',
    gradeLevel: 'Grade 11 — STEM',
    schoolStage: 'Senior High School',
    workflow: 'Exam First → Then Admissions',
    role: 'applicant',
  },
  {
    firstName: 'Isabela',
    middleName: 'Rosario',
    lastName: 'Fernandez',
    email: 'isabela.fernandez.humss@testaccount.edu',
    gradeLevel: 'Grade 11 — HUMSS',
    schoolStage: 'Senior High School',
    workflow: 'Exam First → Then Admissions',
    role: 'applicant',
  },
];

async function getLevelGroup(gradeLevel) {
  const GRADE_OPTIONS = [
    { group: 'Preschool', items: ['Nursery', 'Kinder'] },
    { group: 'Grade School', items: ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'] },
    { group: 'Junior High School', items: ['Grade 7','Grade 8','Grade 9','Grade 10'] },
    { group: 'Senior High School', items: ['Grade 11 — ABM','Grade 11 — STEM','Grade 11 — HUMSS','Grade 12 — ABM','Grade 12 — STEM','Grade 12 — HUMSS'] }
  ];
  const stage = GRADE_OPTIONS.find(g => g.items.includes(gradeLevel));
  return stage ? stage.group : null;
}

async function seedTestAccounts() {
  console.log('🌱 Starting test account seeding...\n');

  for (const account of TEST_ACCOUNTS) {
    try {
      // Check if account already exists
      const existing = await prisma.user.findUnique({
        where: { email: account.email },
      });

      if (existing && !existing.deletedAt) {
        console.log(`⏭️  Skipping ${account.email} - already exists`);
        continue;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);
      const levelGroup = await getLevelGroup(account.gradeLevel);

      // Create or restore user
      const user = existing && existing.deletedAt
        ? await prisma.user.update({
            where: { id: existing.id },
            data: {
              firstName: account.firstName,
              middleName: account.middleName,
              lastName: account.lastName,
              passwordHash,
              role: account.role,
              status: 'Active',
              emailVerified: true, // ✅ PRE-VERIFIED
              emailVerifyToken: null,
              emailVerifyExpires: null,
              deletedAt: null,
            },
          })
        : await prisma.user.create({
            data: {
              firstName: account.firstName,
              middleName: account.middleName,
              lastName: account.lastName,
              email: account.email,
              passwordHash,
              role: account.role,
              status: 'Active',
              emailVerified: true, // ✅ PRE-VERIFIED
              emailVerifyToken: null,
              emailVerifyExpires: null,
            },
          });

      // Create or update applicant profile
      await prisma.applicantProfile.upsert({
        where: { userId: user.id },
        update: {
          gradeLevel: account.gradeLevel,
          levelGroup,
        },
        create: {
          userId: user.id,
          gradeLevel: account.gradeLevel,
          levelGroup,
        },
      });

      console.log(`✅ Created: ${account.firstName} ${account.lastName}`);
      console.log(`   Email: ${account.email}`);
      console.log(`   Grade: ${account.gradeLevel}`);
      console.log(`   School Stage: ${account.schoolStage}`);
      console.log(`   Workflow: ${account.workflow}`);
      console.log(`   Password: ${TEST_PASSWORD}`);
      console.log(`   Status: Email Verified ✓\n`);
    } catch (error) {
      console.error(`❌ Error creating ${account.email}:`, error.message);
    }
  }

  console.log('✨ Seeding complete!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('TEST ACCOUNT SUMMARY');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('📌 PRESCHOOL & ELEMENTARY (No Exams - Straight to Admissions):\n');
  TEST_ACCOUNTS
    .filter(a => a.schoolStage === 'Preschool' || a.schoolStage === 'Grade School')
    .forEach(a => {
      console.log(`• ${a.firstName} ${a.lastName} (${a.gradeLevel})`);
      console.log(`  Email: ${a.email}`);
      console.log(`  Expected Path: Registration → Application Form → Submit\n`);
    });

  console.log('\n📌 JUNIOR HIGH & SENIOR HIGH (Exams FIRST - Then Admissions):\n');
  TEST_ACCOUNTS
    .filter(a => a.schoolStage === 'Junior High School' || a.schoolStage === 'Senior High School')
    .forEach(a => {
      console.log(`• ${a.firstName} ${a.lastName} (${a.gradeLevel})`);
      console.log(`  Email: ${a.email}`);
      console.log(`  Expected Path: Registration → View Exam Schedule → Take Exam → Application Form → Submit\n`);
    });

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`Common Password for All Test Accounts: ${TEST_PASSWORD}`);
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(0);
}

seedTestAccounts().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
