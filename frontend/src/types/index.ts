/* ── Domain types for PromptAds AI ────────────────────────────────────── */

// ── Auth ─────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  company_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  company_name: string;
  is_active: boolean;
}

// ── Ads ──────────────────────────────────────────────────────────────────

export type AdStatus = "draft" | "active" | "paused" | "archived";

export interface Ad {
  id: string;
  advertiser_id: string;
  title: string;
  description: string;
  product_url: string;
  image_url?: string | null;
  category: string;
  keywords: string[];
  bid_amount: number;
  status: AdStatus;
  created_at: string;
}

export interface AdCreate {
  title: string;
  description: string;
  product_url: string;
  image_url?: string;
  category?: string;
  keywords?: string[];
  bid_amount?: number;
  status?: AdStatus;
}

export interface AdUpdate {
  title?: string;
  description?: string;
  product_url?: string;
  image_url?: string;
  category?: string;
  keywords?: string[];
  bid_amount?: number;
  status?: AdStatus;
}

// ── Analytics ────────────────────────────────────────────────────────────

export interface AdAnalytics {
  ad_id: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

// ── Engine ────────────────────────────────────────────────────────────────

export interface MatchRequest {
  user_prompt: string;
  top_k?: number;
  relevance_weight?: number;
  bid_weight?: number;
}

export interface MatchResponse {
  ad_id: string;
  title: string;
  description: string;
  text: string;
  product_url: string;
  image_url?: string | null;
  relevance_score: number;
  bid_amount: number;
  final_score: number;
}

export interface MatchMultiResponse {
  ads: MatchResponse[];
  total_candidates: number;
  pipeline_latency_ms: number;
}

// ── Dashboard ────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_ads: number;
  active_ads: number;
  total_impressions: number;
  total_clicks: number;
  overall_ctr: number;
  total_spend: number;
}

export interface ChartDataPoint {
  name: string;
  impressions: number;
  clicks: number;
  ctr: number;
}
