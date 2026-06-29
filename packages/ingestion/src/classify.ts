import { cosineSimilarity } from '@yenetta/shared';

/**
 * Classifies a document to a curriculum chapter (and exam year if present).
 * Uses embedding similarity between the document and each chapter's
 * title+objectives as the classifier — swappable for a chat-based classifier.
 */

export interface ClassifiableChapter {
  id: string;
  subjectId: string;
  grade: number;
  title: string;
  objectives: string[];
}

export interface Classification {
  subjectId: string | null;
  chapterId: string | null;
  grade: number | null;
  year: number | null;
}

export type EmbedFn = (texts: string[]) => Promise<number[][]>;

function detectYear(text: string): number | null {
  const matches = text.match(/\b(19[89]\d|20[0-4]\d)\b/g);
  if (!matches) return null;
  // Pick the most recent plausible exam year.
  return Math.max(...matches.map(Number));
}

export async function classifyDocument(
  text: string,
  chapters: ClassifiableChapter[],
  embed: EmbedFn,
  overrides: Partial<Pick<Classification, 'subjectId' | 'chapterId' | 'year'>> = {},
): Promise<Classification> {
  const year = overrides.year ?? detectYear(text);

  // Explicit chapter override wins (admin picked it on upload).
  if (overrides.chapterId) {
    const picked = chapters.find((c) => c.id === overrides.chapterId);
    return {
      chapterId: overrides.chapterId,
      subjectId: picked?.subjectId ?? overrides.subjectId ?? null,
      grade: picked?.grade ?? null,
      year,
    };
  }

  const candidates = overrides.subjectId
    ? chapters.filter((c) => c.subjectId === overrides.subjectId)
    : chapters;

  if (candidates.length === 0) {
    return { subjectId: overrides.subjectId ?? null, chapterId: null, grade: null, year };
  }

  const sample = text.slice(0, 2000);
  const chapterTexts = candidates.map((c) => `${c.title}. ${c.objectives.join('. ')}`);
  const vectors = await embed([sample, ...chapterTexts]);
  const docVec = vectors[0]!;

  let bestIdx = -1;
  let bestSim = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const sim = cosineSimilarity(docVec, vectors[i + 1]!);
    if (sim > bestSim) {
      bestSim = sim;
      bestIdx = i;
    }
  }

  const best = candidates[bestIdx];
  return {
    subjectId: best?.subjectId ?? overrides.subjectId ?? null,
    chapterId: best?.id ?? null,
    grade: best?.grade ?? null,
    year,
  };
}
