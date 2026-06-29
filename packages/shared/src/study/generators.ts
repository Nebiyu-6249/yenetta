/**
 * Deterministic, extractive study-content generators (BUILD_BRIEF §6, §8).
 * They operate over retrieved chapter text and are cached per chapter, so each
 * is produced once and served to all students at $0 AI cost. When OpenAI is
 * configured these can be swapped for abstractive generation behind the same
 * shapes. Pure + isomorphic (also used offline on mobile).
 */

export interface GeneratedFlashcard {
  front: string;
  back: string;
}

export interface GeneratedQuizQuestion {
  stem: string;
  options: string[];
  answer: string;
  explanation?: string;
}

const ARTICLES = /^(the|a|an)\s+/i;
const DEFINITION_SPLIT = /\s+(is|are|means|refers to)\s+/i;

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
}

/** A short extractive summary: the first few topic sentences. */
export function buildSummary(text: string, maxSentences = 3): string {
  return splitSentences(text).slice(0, maxSentences).join(' ');
}

/** Bulleted study notes — one salient sentence per bullet. */
export function buildNotes(text: string, maxNotes = 6): string[] {
  return splitSentences(text).slice(0, maxNotes);
}

interface Definition {
  term: string;
  sentence: string;
}

function extractDefinition(sentence: string): Definition | null {
  const match = sentence.match(DEFINITION_SPLIT);
  if (!match || match.index === undefined) return null;
  const subject = sentence.slice(0, match.index).replace(ARTICLES, '').trim();
  const words = subject.split(/\s+/);
  if (subject.length < 2 || words.length > 6) return null;
  return { term: subject, sentence };
}

/** Q/A flashcards from definitional sentences ("X is/are/means …"). */
export function buildFlashcards(text: string, maxCards = 6): GeneratedFlashcard[] {
  const cards: GeneratedFlashcard[] = [];
  const seen = new Set<string>();
  for (const sentence of splitSentences(text)) {
    const def = extractDefinition(sentence);
    if (!def) continue;
    const key = def.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push({
      front: `What ${/s$/.test(def.term) ? 'are' : 'is'} ${def.term}?`,
      back: def.sentence,
    });
    if (cards.length >= maxCards) break;
  }
  return cards;
}

function pickDistractors(answer: string, pool: string[], count: number): string[] {
  const lower = answer.toLowerCase();
  const unique = [
    ...new Set(pool.map((p) => p.trim()).filter((p) => p && p.toLowerCase() !== lower)),
  ];
  // Deterministic order (stable across runs) by a simple char-sum key.
  unique.sort((a, b) => keyOf(a) - keyOf(b) || a.localeCompare(b));
  return unique.slice(0, count);
}

function keyOf(s: string): number {
  let k = 0;
  for (let i = 0; i < s.length; i++) k = (k + s.charCodeAt(i) * (i + 1)) % 100000;
  return k;
}

/**
 * Fill-in-the-blank MCQs from definitional sentences. `distractorPool` supplies
 * wrong-answer terms (e.g. key terms from other chapters).
 */
export function buildQuiz(
  text: string,
  distractorPool: string[],
  maxQuestions = 5,
): GeneratedQuizQuestion[] {
  const questions: GeneratedQuizQuestion[] = [];
  const flashcards = buildFlashcards(text, maxQuestions * 2);
  const terms = flashcards.map((f) => f.front.replace(/^What (is|are)\s+/i, '').replace(/\?$/, ''));

  for (let i = 0; i < flashcards.length && questions.length < maxQuestions; i++) {
    const card = flashcards[i]!;
    const term = terms[i]!;
    const blanked = card.back.replace(new RegExp(term, 'i'), '_____');
    if (!blanked.includes('_____')) continue;
    const distractors = pickDistractors(term, [...terms, ...distractorPool], 3);
    if (distractors.length < 2) continue;
    const options = [term, ...distractors].sort(
      (a, b) => keyOf(a) - keyOf(b) || a.localeCompare(b),
    );
    questions.push({
      stem: `Fill in the blank: ${blanked}`,
      options,
      answer: term,
      explanation: card.back,
    });
  }
  return questions;
}
