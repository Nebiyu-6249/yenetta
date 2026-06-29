import { randomUUID } from 'node:crypto';
import { PrismaClient, type Stream } from '@prisma/client';
import { deterministicEmbed, toPgVector } from '@yenetta/shared';

const prisma = new PrismaClient();

interface SeedChapter {
  unitNo: number;
  title: string;
  objectives: string[];
  /** Plausible curriculum prose, embedded so the tutor can ground answers. */
  content: string;
}

interface SeedSubject {
  name: string;
  grade: number;
  stream: Stream;
  chapters: SeedChapter[];
}

// Small, plausible curriculum so the app is fully usable end-to-end before the
// real OCR-ingested corpus exists. Content is synthetic placeholder prose.
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
        content:
          'Biology is the scientific study of living things. Its branches include botany (plants), zoology (animals), microbiology (microorganisms) and ecology (interactions with the environment). The scientific method is a systematic approach to answering questions: observe a phenomenon, ask a question, form a hypothesis, design and run an experiment, collect and analyse data, and draw a conclusion. A controlled experiment changes one variable while keeping others constant.',
      },
      {
        unitNo: 2,
        title: 'Cell Biology',
        objectives: ['Identify cell organelles', 'Compare plant and animal cells'],
        content:
          'The cell is the basic structural and functional unit of life. Animal and plant cells share organelles such as the nucleus, which contains DNA and controls the cell; mitochondria, which release energy through respiration; ribosomes, which build proteins; and the cell membrane, which controls what enters and leaves. Plant cells additionally have a rigid cell wall, a large central vacuole, and chloroplasts that carry out photosynthesis. Photosynthesis converts carbon dioxide and water into glucose using light energy.',
      },
      {
        unitNo: 3,
        title: 'Human Biology and Health',
        objectives: ['Outline the human digestive system', 'Explain balanced nutrition'],
        content:
          'The human digestive system breaks food into nutrients the body can absorb. Digestion begins in the mouth, continues in the stomach with acid and enzymes, and finishes in the small intestine where nutrients are absorbed into the blood. A balanced diet contains carbohydrates for energy, proteins for growth and repair, fats, vitamins, minerals, fibre and water. Deficiency diseases such as kwashiorkor result from too little protein.',
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
        content:
          'An acid is a substance that donates hydrogen ions (H+) in solution, while a base accepts them; the Arrhenius and Bronsted-Lowry definitions formalise this. The pH scale measures acidity from 0 to 14, where pH below 7 is acidic, 7 is neutral, and above 7 is basic. pH equals the negative logarithm of the hydrogen ion concentration, pH = -log[H+]. A neutralisation reaction between an acid and a base produces a salt and water.',
      },
      {
        unitNo: 2,
        title: 'Electrochemistry',
        objectives: ['Describe redox reactions', 'Explain electrolytic cells'],
        content:
          'Electrochemistry studies reactions that transfer electrons. In a redox reaction, oxidation is the loss of electrons and reduction is the gain of electrons. A galvanic (voltaic) cell converts chemical energy into electrical energy spontaneously, whereas an electrolytic cell uses electrical energy to drive a non-spontaneous reaction such as electrolysis. The electrode where oxidation occurs is the anode and the electrode where reduction occurs is the cathode.',
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
        content:
          'A relation is any set of ordered pairs, while a function is a relation in which each input maps to exactly one output. The set of inputs is the domain and the set of outputs is the range. A linear function has the form f(x) = mx + c, where m is the slope and c is the y-intercept; its graph is a straight line.',
      },
      {
        unitNo: 2,
        title: 'Polynomial Functions',
        objectives: ['Perform polynomial division', 'Find roots of polynomials'],
        content:
          'A polynomial function is a sum of terms with non-negative integer powers of x. The degree is the highest power. Polynomial long division and synthetic division divide one polynomial by another. The remainder theorem states that dividing P(x) by (x - a) gives a remainder of P(a); if P(a) = 0 then (x - a) is a factor and a is a root of the polynomial.',
      },
    ],
  },
];

interface SeedExamQuestion {
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
}

const EXAM = {
  subjectName: 'Chemistry',
  grade: 12,
  stream: 'natural' as Stream,
  year: 2015,
  chapterUnitNo: 1,
  questions: [
    {
      stem: 'What is the pH of a neutral aqueous solution at 25 degrees Celsius?',
      options: ['0', '7', '14', '1'],
      answer: '7',
      explanation: 'A neutral solution has equal H+ and OH- concentrations, giving pH = 7.',
    },
    {
      stem: 'Which reaction between an acid and a base produces a salt and water?',
      options: ['Combustion', 'Neutralisation', 'Oxidation', 'Polymerisation'],
      answer: 'Neutralisation',
      explanation: 'Neutralisation of an acid by a base yields a salt and water.',
    },
  ] satisfies SeedExamQuestion[],
};

const QUOTAS = [
  { tier: 'free' as const, feature: 'ai_chat', dailyCap: 20, monthlyCap: null },
  { tier: 'free' as const, feature: 'ai_generation', dailyCap: 20, monthlyCap: null },
  { tier: 'premium' as const, feature: 'ai_chat', dailyCap: 300, monthlyCap: null },
  { tier: 'premium' as const, feature: 'ai_generation', dailyCap: 300, monthlyCap: null },
];

async function insertChunk(params: {
  text: string;
  subjectId: string;
  chapterId: string | null;
  grade: number;
  type: 'curriculum' | 'exam_question';
  year: number | null;
}): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO content_chunks
       (id, text, embedding, "subjectId", "chapterId", grade, type, year, "createdAt")
     VALUES ($1, $2, $3::vector, $4, $5, $6, $7::"ContentType", $8, now())`,
    randomUUID(),
    params.text,
    toPgVector(deterministicEmbed(params.text)),
    params.subjectId,
    params.chapterId,
    params.grade,
    params.type,
    params.year,
  );
}

async function main(): Promise<void> {
  console.log('🌱 Seeding Yenetta sample dataset...');

  // Idempotent: clear seed-origin chunks (those without a source document).
  await prisma.$executeRawUnsafe(`DELETE FROM content_chunks WHERE "sourceDocumentId" IS NULL`);

  for (const subject of SUBJECTS) {
    const created = await prisma.subject.upsert({
      where: {
        name_grade_stream: { name: subject.name, grade: subject.grade, stream: subject.stream },
      },
      create: { name: subject.name, grade: subject.grade, stream: subject.stream },
      update: {},
    });

    for (const chapter of subject.chapters) {
      const ch = await prisma.chapter.upsert({
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

      await insertChunk({
        text: `${chapter.title}. ${chapter.content}`,
        subjectId: created.id,
        chapterId: ch.id,
        grade: subject.grade,
        type: 'curriculum',
        year: null,
      });
    }
    console.log(
      `  • ${subject.name} (G${subject.grade}/${subject.stream}) — ${subject.chapters.length} chapters + curriculum chunks`,
    );
  }

  // Sample past-exam paper (Chemistry G12, 2015) linked to a chapter.
  const examSubject = await prisma.subject.findFirstOrThrow({
    where: { name: EXAM.subjectName, grade: EXAM.grade, stream: EXAM.stream },
  });
  const examChapter = await prisma.chapter.findFirstOrThrow({
    where: { subjectId: examSubject.id, unitNo: EXAM.chapterUnitNo },
  });
  const paper = await prisma.examPaper.upsert({
    where: {
      year_stream_subjectId: { year: EXAM.year, stream: EXAM.stream, subjectId: examSubject.id },
    },
    create: { year: EXAM.year, stream: EXAM.stream, subjectId: examSubject.id },
    update: {},
  });
  await prisma.examQuestion.deleteMany({ where: { paperId: paper.id } });
  for (const q of EXAM.questions) {
    await prisma.examQuestion.create({
      data: {
        paperId: paper.id,
        subjectId: examSubject.id,
        chapterId: examChapter.id,
        stem: q.stem,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        year: EXAM.year,
      },
    });
    await insertChunk({
      text: `Exam ${EXAM.year}: ${q.stem} Answer: ${q.answer}. ${q.explanation}`,
      subjectId: examSubject.id,
      chapterId: examChapter.id,
      grade: EXAM.grade,
      type: 'exam_question',
      year: EXAM.year,
    });
  }
  console.log(
    `  • Sample exam paper ${EXAM.subjectName} ${EXAM.year} — ${EXAM.questions.length} questions`,
  );

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
