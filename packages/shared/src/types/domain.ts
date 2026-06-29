/**
 * Core domain types shared by api, web, and mobile.
 * These mirror the data model in docs/BUILD_BRIEF.md (§5) and will grow
 * as later milestones land. Kept intentionally small for M0.
 */

export type Grade = 9 | 10 | 11 | 12;

export type Stream = 'natural' | 'social' | 'both';

export type SubscriptionTier = 'free' | 'premium';

export type ContentType = 'curriculum' | 'exam_question';

export type Locale = 'en' | 'am';

export interface UserProfile {
  id: string;
  phone: string;
  name: string | null;
  grade: Grade | null;
  stream: Stream | null;
  locale: Locale;
  tier: SubscriptionTier;
}

export interface Subject {
  id: string;
  name: string;
  grade: Grade;
  stream: Stream;
}

export interface Chapter {
  id: string;
  subjectId: string;
  grade: Grade;
  unitNo: number;
  title: string;
  objectives: string[];
}

/** A retrieved source attached to a grounded tutor answer. */
export interface CitedSource {
  chapterId: string | null;
  chapterTitle: string | null;
  type: ContentType;
  year: number | null;
}
