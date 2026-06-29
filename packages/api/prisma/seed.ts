import { PrismaClient, type Stream } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedSubject {
  name: string;
  grade: number;
  stream: Stream;
  chapters: { unitNo: number; title: string; objectives: string[] }[];
}

// Small, plausible curriculum taxonomy so the API is queryable end-to-end in
// M1. The real OCR-ingested corpus + embeddings arrive in M2.
const SUBJECTS: SeedSubject[] = [
  {
    name: 'Biology',
    grade: 9,
    stream: 'natural',
    chapters: [
      {
        unitNo: 1,
        title: 'Biology and the Scientific Method',
        objectives: ['Describe the branches of biology', 'Apply the scientific method'],
      },
      {
        unitNo: 2,
        title: 'Cell Biology',
        objectives: ['Identify cell organelles', 'Compare plant and animal cells'],
      },
      {
        unitNo: 3,
        title: 'Human Biology and Health',
        objectives: ['Outline the human digestive system', 'Explain balanced nutrition'],
      },
    ],
  },
  {
    name: 'Chemistry',
    grade: 12,
    stream: 'natural',
    chapters: [
      {
        unitNo: 1,
        title: 'Acids, Bases and Salts',
        objectives: ['Define acids and bases', 'Calculate pH of solutions'],
      },
      {
        unitNo: 2,
        title: 'Electrochemistry',
        objectives: ['Describe redox reactions', 'Explain electrolytic cells'],
      },
    ],
  },
  {
    name: 'Mathematics',
    grade: 10,
    stream: 'both',
    chapters: [
      {
        unitNo: 1,
        title: 'Relations and Functions',
        objectives: ['Define relations and functions', 'Sketch linear functions'],
      },
      {
        unitNo: 2,
        title: 'Polynomial Functions',
        objectives: ['Perform polynomial division', 'Find roots of polynomials'],
      },
    ],
  },
];

// Per-tier usage caps (BUILD_BRIEF §8). Enforced server-side by entitlements.
const QUOTAS = [
  { tier: 'free' as const, feature: 'ai_chat', dailyCap: 20, monthlyCap: null },
  { tier: 'free' as const, feature: 'ai_generation', dailyCap: 20, monthlyCap: null },
  { tier: 'premium' as const, feature: 'ai_chat', dailyCap: 300, monthlyCap: null },
  { tier: 'premium' as const, feature: 'ai_generation', dailyCap: 300, monthlyCap: null },
];

async function main(): Promise<void> {
  console.log('🌱 Seeding Yenetta sample dataset...');

  for (const subject of SUBJECTS) {
    const created = await prisma.subject.upsert({
      where: {
        name_grade_stream: { name: subject.name, grade: subject.grade, stream: subject.stream },
      },
      create: { name: subject.name, grade: subject.grade, stream: subject.stream },
      update: {},
    });

    for (const chapter of subject.chapters) {
      await prisma.chapter.upsert({
        where: { subjectId_unitNo: { subjectId: created.id, unitNo: chapter.unitNo } },
        create: {
          subjectId: created.id,
          grade: subject.grade,
          unitNo: chapter.unitNo,
          title: chapter.title,
          objectives: chapter.objectives,
        },
        update: { title: chapter.title, objectives: chapter.objectives },
      });
    }
    console.log(
      `  • ${subject.name} (G${subject.grade}/${subject.stream}) — ${subject.chapters.length} chapters`,
    );
  }

  for (const quota of QUOTAS) {
    await prisma.quota.upsert({
      where: { tier_feature: { tier: quota.tier, feature: quota.feature } },
      create: quota,
      update: { dailyCap: quota.dailyCap, monthlyCap: quota.monthlyCap },
    });
  }
  console.log(`  • ${QUOTAS.length} quota rows`);

  console.log('✅ Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
