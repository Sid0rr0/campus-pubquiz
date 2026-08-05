import type {
  LoginResponse,
  MeResponse,
  RegisterResponse,
  UserRole,
  UsersListedPayload,
} from '@campus-pubquiz/types';
import { getBackendUrl } from '@/app/lib/backend-url';

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

interface ErrorBody {
  message?: string;
}

async function throwApiError(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as ErrorBody;
  throw new AuthApiError(body.message ?? fallback, response.status);
}

export async function register(username: string, password: string): Promise<RegisterResponse> {
  const response = await fetch(`${getBackendUrl()}/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) return throwApiError(response, 'Registration failed');
  return (await response.json()) as RegisterResponse;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${getBackendUrl()}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) return throwApiError(response, 'Login failed');
  return (await response.json()) as LoginResponse;
}

export async function logout(): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) return throwApiError(response, 'Logout failed');
}

export async function fetchMe(signal?: AbortSignal): Promise<MeResponse> {
  const response = await fetch(`${getBackendUrl()}/auth/me`, {
    credentials: 'include',
    signal,
  });
  if (!response.ok) return throwApiError(response, 'Could not load account');
  return (await response.json()) as MeResponse;
}

export async function fetchUsers(signal?: AbortSignal): Promise<UsersListedPayload> {
  const response = await fetch(`${getBackendUrl()}/users`, {
    credentials: 'include',
    signal,
  });
  if (!response.ok) return throwApiError(response, 'Could not load users');
  return (await response.json()) as UsersListedPayload;
}

export async function approveUser(userId: number, role: UserRole): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/users/${userId}/approve`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) return throwApiError(response, 'Could not approve user');
}

export async function deactivateUser(userId: number): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/users/${userId}/deactivate`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) return throwApiError(response, 'Could not deactivate user');
}
