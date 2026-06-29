'use client';

import type { Entitlement, UserProfile } from '@yenetta/shared';
import { API_BASE } from './config';

const ACCESS_KEY = 'yenetta.access';
const REFRESH_KEY = 'yenetta.refresh';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export function getTokens(): Tokens | null {
  if (typeof window === 'undefined') return null;
  const accessToken = localStorage.getItem(ACCESS_KEY);
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export function setTokens(tokens: Tokens): void {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function refreshTokens(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens) return false;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  setTokens((await res.json()) as Tokens);
  return true;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  isForm?: boolean;
  retry?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, isForm = false, retry = true } = options;
  const headers: Record<string, string> = {};
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const tokens = getTokens();
    if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? (body as BodyInit) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && retry && (await refreshTokens())) {
    return apiFetch<T>(path, { ...options, retry: false });
  }
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Typed endpoints ────────────────────────────────────────────────────────

export interface MeResponse {
  user: UserProfile;
  entitlement: Entitlement;
}

export interface LoginResponse extends MeResponse, Tokens {}

export interface CitedSource {
  chapterId: string | null;
  chapterTitle: string | null;
  type: string;
  year: number | null;
}

export interface ChatResponse {
  conversationId: string;
  answer: string;
  sources: CitedSource[];
  grounded: boolean;
  cached: boolean;
}

export interface Subject {
  id: string;
  name: string;
  grade: number;
  stream: string;
}

export interface Chapter {
  id: string;
  subjectId: string;
  grade: number;
  unitNo: number;
  title: string;
  objectives: string[];
}

export const api = {
  requestOtp: (phone: string) =>
    apiFetch<{ expiresAt: string; devCode?: string }>('/auth/otp/request', {
      method: 'POST',
      body: { phone },
      auth: false,
    }),
  verifyOtp: (phone: string, code: string) =>
    apiFetch<LoginResponse>('/auth/otp/verify', {
      method: 'POST',
      body: { phone, code },
      auth: false,
    }),
  me: () => apiFetch<MeResponse>('/users/me'),
  updateProfile: (data: Partial<Pick<UserProfile, 'name' | 'grade' | 'stream' | 'locale'>>) =>
    apiFetch<MeResponse>('/users/me', { method: 'PATCH', body: data }),

  subjects: (grade?: number) => apiFetch<Subject[]>(`/subjects${grade ? `?grade=${grade}` : ''}`),
  chapters: (subjectId: string) => apiFetch<Chapter[]>(`/subjects/${subjectId}/chapters`),

  chat: (
    message: string,
    scope?: Record<string, unknown>,
    conversationId?: string,
    language?: 'en' | 'am',
  ) =>
    apiFetch<ChatResponse>('/chat', {
      method: 'POST',
      body: { message, scope, conversationId, language },
    }),

  studyContent: (chapterId: string, type: 'summary' | 'notes' | 'flashcards') =>
    apiFetch<{ type: string; content: Record<string, unknown>; cached: boolean }>(
      `/chapters/${chapterId}/${type}`,
    ),
  quiz: (chapterId: string) =>
    apiFetch<{
      id: string;
      title: string;
      questions: { id: string; stem: string; options: string[] }[];
    }>(`/chapters/${chapterId}/quiz`),
  submitQuiz: (quizId: string, answers: { questionId: string; answer: string }[]) =>
    apiFetch<GradedResult>(`/quizzes/${quizId}/attempts`, { method: 'POST', body: { answers } }),

  papers: () => apiFetch<ExamPaper[]>('/exams/papers'),
  practice: (filter: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries(filter).filter(([, v]) => v !== undefined) as [string, string][],
    ).toString();
    return apiFetch<PracticeQuestion[]>(`/exams/practice${qs ? `?${qs}` : ''}`);
  },
  submitPractice: (answers: { questionId: string; answer: string }[]) =>
    apiFetch<GradedResult>('/exams/practice/submit', { method: 'POST', body: { answers } }),
  mocks: () => apiFetch<MockExam[]>('/exams/mocks'),
  startMock: (id: string) =>
    apiFetch<{ attemptId: string; durationSeconds: number; questions: PracticeQuestion[] }>(
      `/exams/mocks/${id}/start`,
      { method: 'POST', body: {} },
    ),
  submitMock: (
    attemptId: string,
    answers: { questionId: string; answer: string }[],
    durationSeconds: number,
  ) =>
    apiFetch<GradedResult>(`/exams/mocks/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: { answers, durationSeconds },
    }),

  progress: () => apiFetch<ProgressSummary>('/progress'),

  checkout: () => apiFetch<{ checkoutUrl: string; txRef: string }>('/payments/checkout', { method: 'POST', body: {} }),
  redeemVoucher: (code: string) =>
    apiFetch<{ ok: boolean }>('/payments/voucher', { method: 'POST', body: { code } }),
};

export interface GradedResult {
  total: number;
  correct: number;
  scoreFraction: number;
  results: {
    questionId: string;
    correct: boolean;
    correctAnswer: string;
    explanation: string | null;
  }[];
}

export interface PracticeQuestion {
  id: string;
  stem: string;
  options: string[];
  year?: number;
  chapterId?: string | null;
}

export interface ExamPaper {
  id: string;
  year: number;
  stream: string;
  subject?: { name: string; grade: number };
}

export interface MockExam {
  id: string;
  title: string;
  durationSeconds: number;
  year: number | null;
}

export interface ProgressSummary {
  progress: { chapterId: string; mastery: number; lastStudied: string | null }[];
  weakAreas: { chapterId: string; mastery: number }[];
}
