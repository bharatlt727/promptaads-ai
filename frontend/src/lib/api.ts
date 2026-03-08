/* ── API client for PromptAds AI backend ─────────────────────────────── */

import type {
  Ad,
  AdAnalytics,
  AdCreate,
  AdUpdate,
  LoginRequest,
  MatchMultiResponse,
  MatchRequest,
  MatchResponse,
  RegisterRequest,
  TokenResponse,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Helpers ──────────────────────────────────────────────────────────────

interface FetchOptions extends RequestInit {
  token?: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { token, headers: custom, ...rest } = opts;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(custom as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { headers, ...rest });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(body.detail || `API Error ${res.status}`, res.status);
  }

  return res.json();
}

// ── Token helpers ────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string): void {
  localStorage.setItem("token", token);
}

export function clearToken(): void {
  localStorage.removeItem("token");
}

// ── Auth ─────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: RegisterRequest) =>
    apiFetch<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: LoginRequest) =>
    apiFetch<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Ads ──────────────────────────────────────────────────────────────────

export const adsApi = {
  list: (token: string) =>
    apiFetch<Ad[]>("/ads/list", { token }),

  create: (token: string, data: AdCreate) =>
    apiFetch<Ad>("/ads/create", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  update: (token: string, adId: string, data: AdUpdate) =>
    apiFetch<Ad>(`/ads/update/${adId}`, {
      method: "PUT",
      token,
      body: JSON.stringify(data),
    }),

  delete: (token: string, adId: string) =>
    apiFetch<{ detail: string }>(`/ads/delete/${adId}`, {
      method: "DELETE",
      token,
    }),
};

// ── Analytics ────────────────────────────────────────────────────────────

export const analyticsApi = {
  impression: (adId: string) =>
    apiFetch<AdAnalytics>("/analytics/impression", {
      method: "POST",
      body: JSON.stringify({ ad_id: adId }),
    }),

  click: (adId: string) =>
    apiFetch<AdAnalytics>("/analytics/click", {
      method: "POST",
      body: JSON.stringify({ ad_id: adId }),
    }),
};

// ── Engine ────────────────────────────────────────────────────────────────

export const engineApi = {
  matchAd: (data: MatchRequest) =>
    apiFetch<MatchResponse>("/engine/match-ad", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  matchAds: (data: MatchRequest & { n?: number }) =>
    apiFetch<MatchMultiResponse>("/engine/match-ads", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Health ────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => apiFetch<{ status: string }>("/health"),
};
