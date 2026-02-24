/**
 * API Client for EcoQuant Backend
 *
 * Uses Axios with interceptors for JWT token management
 * and automatic error handling.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Create Axios instance
export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Request Interceptor - Add JWT Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor - Handle Errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        // Redirect to login if not already there
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// API Error type
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = "ApiError";
  }
}

export type BacktestStatusValue =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

type BacktestMetricKey =
  | "total_return"
  | "cagr"
  | "sharpe_ratio"
  | "sortino_ratio"
  | "calmar_ratio"
  | "mdd"
  | "total_trades"
  | "winning_trades"
  | "losing_trades"
  | "win_rate"
  | "avg_win"
  | "avg_loss"
  | "profit_factor";

type BacktestPayload = {
  metrics?: Record<string, unknown> | null;
  [key: string]: unknown;
};

const NUMERIC_METRIC_KEYS: BacktestMetricKey[] = [
  "total_return",
  "cagr",
  "sharpe_ratio",
  "sortino_ratio",
  "calmar_ratio",
  "mdd",
  "win_rate",
  "avg_win",
  "avg_loss",
  "profit_factor",
];

const INTEGER_METRIC_KEYS: BacktestMetricKey[] = [
  "total_trades",
  "winning_trades",
  "losing_trades",
];

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toInteger(value: unknown): number | undefined {
  const n = toNumber(value);
  return n === undefined ? undefined : Math.trunc(n);
}

function pickTopLevelOrMetric(
  payload: BacktestPayload,
  key: BacktestMetricKey
): unknown {
  const topLevel = payload[key];
  if (topLevel !== null && topLevel !== undefined) {
    return topLevel;
  }
  const nestedMetric = payload.metrics?.[key];
  if (nestedMetric !== null && nestedMetric !== undefined) {
    return nestedMetric;
  }
  return undefined;
}

export function normalizeBacktestStatus(status: unknown): BacktestStatusValue {
  const normalized = String(status ?? "").toLowerCase();
  switch (normalized) {
    case "pending":
    case "running":
    case "completed":
    case "failed":
    case "cancelled":
      return normalized;
    default:
      return "pending";
  }
}

export function normalizeBacktestResult<T extends BacktestPayload>(
  payload: T
): T & BacktestResult {
  const normalized: BacktestPayload = {
    ...payload,
    status: normalizeBacktestStatus(payload.status),
  };

  for (const key of NUMERIC_METRIC_KEYS) {
    normalized[key] = toNumber(pickTopLevelOrMetric(payload, key));
  }

  for (const key of INTEGER_METRIC_KEYS) {
    normalized[key] = toInteger(pickTopLevelOrMetric(payload, key));
  }

  return normalized as T & BacktestResult;
}

// API Methods
export const api = {
  // Direct axios methods for flexibility
  get: apiClient.get.bind(apiClient),
  post: apiClient.post.bind(apiClient),
  put: apiClient.put.bind(apiClient),
  patch: apiClient.patch.bind(apiClient),
  delete: apiClient.delete.bind(apiClient),

  // Auth
  auth: {
    login: async (email: string, password: string) => {
      // Backend expects JSON with email and password
      const response = await apiClient.post<{
        access_token: string;
        refresh_token: string;
        token_type: string;
        expires_in: number;
      }>("/auth/login", {
        email,
        password,
      });
      return response.data;
    },

    register: async (email: string, password: string, fullName?: string) => {
      const response = await apiClient.post<{
        id: number;
        email: string;
        full_name?: string;
        is_active: boolean;
        created_at: string;
      }>("/auth/register", {
        email,
        password,
        full_name: fullName,
      });
      return response.data;
    },

    checkEmail: async (email: string) => {
      // Try to check if email exists by attempting a lightweight call
      // Since we don't have a dedicated endpoint, we'll handle this in the component
      // by catching 409 errors during registration
      try {
        const response = await apiClient.get<{ exists: boolean }>("/auth/check-email", {
          params: { email },
        });
        return response.data;
      } catch {
        // If endpoint doesn't exist (404), assume email check not available
        return { exists: false };
      }
    },

    me: async () => {
      const response = await apiClient.get<{ id: number; email: string; full_name?: string }>("/auth/me");
      return response.data;
    },

    // Google OAuth
    getGoogleAuthUrl: async () => {
      const response = await apiClient.get<{ url: string; state: string }>("/auth/google");
      return response.data;
    },

    googleCallback: async (code: string, redirectUri: string) => {
      const response = await apiClient.post<{
        access_token: string;
        refresh_token: string;
        token_type: string;
        expires_in: number;
      }>("/auth/google/callback", {
        code,
        redirect_uri: redirectUri,
      });
      return response.data;
    },
  },

  // Strategies
  strategies: {
    list: async (page = 1, pageSize = 10) => {
      const response = await apiClient.get<{
        items: Strategy[];
        total: number;
        page: number;
        page_size: number;
      }>("/strategies", {
        params: { page, page_size: pageSize },
      });
      return response.data;
    },

    get: async (id: number) => {
      const response = await apiClient.get<Strategy>(`/strategies/${id}`);
      return response.data;
    },

    create: async (data: CreateStrategyInput) => {
      const response = await apiClient.post<Strategy>("/strategies", data);
      return response.data;
    },

    update: async (id: number, data: Partial<CreateStrategyInput>) => {
      const response = await apiClient.patch<Strategy>(`/strategies/${id}`, data);
      return response.data;
    },

    delete: async (id: number) => {
      await apiClient.delete(`/strategies/${id}`);
    },
  },

  // Backtests
  backtests: {
    list: async (strategyId?: number, page = 1, pageSize = 10) => {
      const response = await apiClient.get<{
        items: BacktestPayload[];
        total: number;
        page: number;
        page_size: number;
      }>("/backtest", {
        params: {
          ...(strategyId ? { strategy_id: strategyId } : {}),
          page,
          page_size: pageSize,
        },
      });
      return {
        ...response.data,
        items: response.data.items.map((item) => normalizeBacktestResult(item)),
      };
    },

    get: async (id: number) => {
      const response = await apiClient.get<BacktestPayload>(`/backtest/${id}`);
      return normalizeBacktestResult(response.data);
    },

    run: async (data: RunBacktestInput) => {
      const response = await apiClient.post<{ backtest_id: number; task_id: string; status: string }>(
        "/backtest/run",
        data
      );
      return {
        ...response.data,
        status: normalizeBacktestStatus(response.data.status),
      };
    },

    status: async (backtestId: number) => {
      const response = await apiClient.get<{
        backtest_id: number;
        task_id: string | null;
        status: string;
        progress: number;
        message: string | null;
        started_at: string | null;
        completed_at: string | null;
      }>(`/backtest/${backtestId}/status`);
      return {
        ...response.data,
        status: normalizeBacktestStatus(response.data.status),
      };
    },

    create: async (data: CreateBacktestInput) => {
      const response = await apiClient.post<{ id: number; task_id: string }>("/backtest", data);
      return response.data;
    },
  },

  // News
  news: {
    list: async (ticker?: string, page = 1, pageSize = 20) => {
      const response = await apiClient.get<{
        items: NewsArticle[];
        total: number;
        page: number;
        page_size: number;
      }>("/news", {
        params: {
          ...(ticker ? { ticker } : {}),
          page,
          page_size: pageSize,
        },
      });
      return response.data;
    },

    fetch: async (ticker: string) => {
      const response = await apiClient.post<{ task_id: string }>(`/news/fetch/${ticker}`);
      return response.data;
    },
  },

  // Analysis
  analysis: {
    liveSignal: async (strategyId: number, ticker: string) => {
      const response = await apiClient.post<LiveSignalResponse>("/analysis/live_signal", {
        strategy_id: strategyId,
        ticker,
      });
      return response.data;
    },

    marketData: async (ticker: string) => {
      const response = await apiClient.get<MarketData>(`/analysis/market/${ticker}`);
      return response.data;
    },
  },
};

// Types
export interface Strategy {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  strategy_type: string;
  status: string;
  symbols?: string;
  logic_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateStrategyInput {
  name: string;
  description?: string;
  strategy_type: string;
  symbols?: string;
  logic_config: Record<string, unknown>;
}

export interface BacktestResult {
  id: number;
  strategy_id: number;
  task_id?: string;
  status: BacktestStatusValue;
  start_date: string;
  end_date: string;
  initial_capital: number;
  final_value?: number;
  total_return?: number;
  cagr?: number;
  sharpe_ratio?: number;
  sortino_ratio?: number;
  calmar_ratio?: number;
  mdd?: number;
  total_trades?: number;
  winning_trades?: number;
  losing_trades?: number;
  win_rate?: number;
  avg_win?: number;
  avg_loss?: number;
  profit_factor?: number;
  equity_curve?: { date: string; value: number; drawdown?: number }[];
  metrics?: BacktestMetrics;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  execution_time_seconds?: number;
}

export interface BacktestMetrics {
  total_return?: number;
  cagr?: number;
  sharpe_ratio?: number;
  sortino_ratio?: number;
  calmar_ratio?: number;
  mdd?: number;
  total_trades?: number;
  winning_trades?: number;
  losing_trades?: number;
  win_rate?: number;
  avg_win?: number;
  avg_loss?: number;
  profit_factor?: number;
}

export interface CreateBacktestInput {
  strategy_id: number;
  symbols: string[];
  start_date: string;
  end_date: string;
  initial_capital?: number;
  commission?: number;
}

export interface RunBacktestInput {
  strategy_id: number;
  symbols: string[];
  start_date: string;
  end_date: string;
  initial_capital?: number;
  commission?: number;
  position_size?: number;
  config_overrides?: Record<string, unknown>;
}

export interface NewsArticle {
  id: number;
  ticker: string;
  title: string;
  url: string;
  published_at?: string;
  sentiment_score?: number;
  summary?: string;
  ai_model?: string;
  created_at: string;
}

// Analysis Types
export interface MarketData {
  ticker: string;
  current_price: number;
  previous_close: number;
  change_percent: number;
  volume: number;
  day_high: number;
  day_low: number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
}

export interface SentimentData {
  avg_sentiment: number;
  sentiment_label: string;
  news_count: number;
  latest_news: Array<{
    title: string;
    sentiment: number | null;
    published_at: string | null;
  }>;
}

export interface TechnicalData {
  fast_ma: number;
  slow_ma: number;
  ma_spread_percent: number;
  trend: string;
  crossover_status: string;
}

export interface LiveSignalResponse {
  signal: "BUY" | "SELL" | "HOLD";
  signal_strength: number;
  confidence: string;
  reasoning: string[];
  market_data: MarketData;
  sentiment_data?: SentimentData;
  technical_data?: TechnicalData;
  strategy_name: string;
  timestamp: string;
}

export default api;
