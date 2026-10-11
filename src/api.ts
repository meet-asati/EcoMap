import { fetchAuthSession } from 'aws-amplify/auth';
import { API_URL } from './config';
import type { ActionInput, ActionResult, MetricKey } from '../shared/hotspots';

export interface Profile {
  displayName: string | null;
  totalScore: number;
  completed: Record<string, { choiceId?: string; points: number; correct?: number; at: string }>;
  metrics: Partial<Record<MetricKey, number>>;
}

export interface LeaderboardEntry { rank: number; displayName: string; totalScore: number; isMe: boolean }
export interface Leaderboard { entries: LeaderboardEntry[]; me: { displayName: string | null; totalScore: number } | null }

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new ApiError('Your session expired. Sign in again.', 401);

  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the EcoMap server. Check your connection and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { message?: string }).message ?? `Request failed with status ${res.status}.`, res.status);
  return data as T;
}

export const api = {
  me: () => call<Profile>('GET', '/me'),
  setName: (displayName: string) => call<Profile>('PUT', '/me', { displayName }),
  act: (input: ActionInput) => call<{ result: ActionResult; profile: Profile }>('POST', '/actions', input),
  reset: () => call<Profile>('POST', '/me/reset'),
  leaderboard: () => call<Leaderboard>('GET', '/leaderboard'),
};

export function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return 'Something went wrong. Try again.';
}
