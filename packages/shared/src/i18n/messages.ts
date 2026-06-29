/**
 * UI string catalog for English + Amharic (BUILD_BRIEF §M7). Isomorphic — web
 * and mobile both translate through `t()`. Amharic uses Noto Sans Ethiopic.
 */

import type { Locale } from '../types/domain';

export type MessageKey =
  | 'tagline'
  | 'navTutor'
  | 'navStudy'
  | 'navPractice'
  | 'navDashboard'
  | 'navProfile'
  | 'login'
  | 'sendCode'
  | 'verify'
  | 'summary'
  | 'notes'
  | 'flashcards'
  | 'quiz'
  | 'score'
  | 'upgrade'
  | 'premium'
  | 'free'
  | 'premiumRequired'
  | 'explainInAmharic'
  | 'studyPlan'
  | 'streak'
  | 'xp'
  | 'level'
  | 'leaderboard'
  | 'weakAreas'
  | 'progress'
  | 'askTutor'
  | 'examDate'
  | 'generatePlan';

type Catalog = Record<MessageKey, string>;

const en: Catalog = {
  tagline: 'AI study companion for Ethiopian students',
  navTutor: 'Tutor',
  navStudy: 'Study',
  navPractice: 'Exam Practice',
  navDashboard: 'Dashboard',
  navProfile: 'Profile',
  login: 'Log in',
  sendCode: 'Send code',
  verify: 'Verify & continue',
  summary: 'Summary',
  notes: 'Notes',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
  score: 'Score',
  upgrade: 'Upgrade to Premium',
  premium: 'Premium',
  free: 'Free',
  premiumRequired: 'Premium subscription required',
  explainInAmharic: 'Explain in Amharic',
  studyPlan: 'Study plan',
  streak: 'Streak',
  xp: 'XP',
  level: 'Level',
  leaderboard: 'Leaderboard',
  weakAreas: 'Focus areas',
  progress: 'Progress',
  askTutor: 'Ask your tutor anything',
  examDate: 'Exam date',
  generatePlan: 'Generate plan',
};

const am: Catalog = {
  tagline: 'ለኢትዮጵያ ተማሪዎች የ AI ጥናት አጋዥ',
  navTutor: 'አስተማሪ',
  navStudy: 'ጥናት',
  navPractice: 'የፈተና ልምምድ',
  navDashboard: 'ዳሽቦርድ',
  navProfile: 'መገለጫ',
  login: 'ግባ',
  sendCode: 'ኮድ ላክ',
  verify: 'አረጋግጥና ቀጥል',
  summary: 'ማጠቃለያ',
  notes: 'ማስታወሻዎች',
  flashcards: 'ካርዶች',
  quiz: 'ፈተና',
  score: 'ውጤት',
  upgrade: 'ወደ ፕሪሚየም አሻሽል',
  premium: 'ፕሪሚየም',
  free: 'ነጻ',
  premiumRequired: 'የፕሪሚየም ምዝገባ ያስፈልጋል',
  explainInAmharic: 'በአማርኛ አስረዳ',
  studyPlan: 'የጥናት እቅድ',
  streak: 'ተከታታይ ቀናት',
  xp: 'ነጥብ',
  level: 'ደረጃ',
  leaderboard: 'የውጤት ሰንጠረዥ',
  weakAreas: 'ትኩረት የሚሹ',
  progress: 'እድገት',
  askTutor: 'አስተማሪህን ማንኛውንም ጠይቅ',
  examDate: 'የፈተና ቀን',
  generatePlan: 'እቅድ አመንጭ',
};

export const messages: Record<Locale, Catalog> = { en, am };

export function t(locale: Locale, key: MessageKey): string {
  return messages[locale]?.[key] ?? en[key];
}
