import type { Entitlement, SubmittedAnswer, UserProfile } from '@yenetta/shared';
import type { CachedQuestion } from './offline/types';
import type { RemoteApi } from './offline/remote';
import { clearTokens, getTokens, setTokens, type Tokens } from './tokens';

const API_BASE = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'}/api`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function refresh(): Promise<boolean> {
  const tokens = await getTokens();
  if (!tokens) return false;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) {
    await clearTokens();
    return false;
  }
  await setTokens((await res.json()) as Tokens);
  return true;
}

interface Options {
  method?: string;
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
}

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, auth = true, retry = true } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const tokens = await getTokens();
    if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && auth && retry && (await refresh())) {
    return request<T>(path, { ...options, retry: false });
  }
  if (!res.ok) throw new ApiError(res.status, (await res.text()) || res.statusText);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface MeResponse {
  user: UserProfile;
  entitlement: Entitlement;
}
export interface LoginResponse extends MeResponse, Tokens {}
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
export interface ChatResponse {
  conversationId: string;
  answer: string;
  sources: { chapterTitle: string | null; year: number | null; type: string }[];
  grounded: boolean;
}

/** API client; also satisfies the offline `RemoteApi` contract. */
export const api = {
  requestOtp: (phone: string) =>
    request<{ expiresAt: string; devCode?: string }>('/auth/otp/request', {
      method: 'POST',
      body: { phone },
      auth: false,
    }),
  verifyOtp: (phone: string, code: string) =>
    request<LoginResponse>('/auth/otp/verify', {
      method: 'POST',
      body: { phone, code },
      auth: false,
    }),
  me: () => request<MeResponse>('/users/me'),

  subjects: () => request<Subject[]>('/subjects'),
  chapters: (subjectId: string) => request<Chapter[]>(`/subjects/${subjectId}/chapters`),

  chat: (message: string, conversationId?: string) =>
    request<ChatResponse>('/chat', { method: 'POST', body: { message, conversationId } }),

  // RemoteApi surface (used by the offline services)
  studyContent: (chapterId: string, type: 'summary' | 'notes' | 'flashcards') =>
    request<{ content: Record<string, unknown> }>(`/chapters/${chapterId}/${type}`),
  downloadQuestions: (filter: { year?: number; chapterId?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(filter).filter(([, v]) => v !== undefined) as [string, string][],
    ).toString();
    return request<CachedQuestion[]>(`/exams/practice/download${qs ? `?${qs}` : ''}`);
  },
  submitPractice: (answers: SubmittedAnswer[]) =>
    request('/exams/practice/submit', { method: 'POST', body: { answers } }),
  submitQuiz: (quizId: string, answers: SubmittedAnswer[]) =>
    request(`/quizzes/${quizId}/attempts`, { method: 'POST', body: { answers } }),

  progress: () => request<{ progress: { chapterId: string; mastery: number }[] }>('/progress'),

  checkout: () =>
    request<{ checkoutUrl: string; txRef: string }>('/payments/checkout', { method: 'POST', body: {} }),
  redeemVoucher: (code: string) =>
    request<{ ok: boolean }>('/payments/voucher', { method: 'POST', body: { code } }),
  entitlementToken: () =>
    request<{ token: string; tokenExpiresAt: string; entitlement: { tier: string } }>(
      '/entitlements/token',
    ),
} satisfies RemoteApi & Record<string, unknown>;
