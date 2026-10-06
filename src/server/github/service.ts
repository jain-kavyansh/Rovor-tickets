import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { githubCache } from "@/server/db/schema";
import { InvalidRepoError, normalizeRepo } from "./repo";

export const CACHE_TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 5000;

export type RepoInsights = {
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  language: string | null;
  pushedAt: string;
};

export type GithubErrorCode =
  | "INVALID_REPO"
  | "REPO_NOT_FOUND"
  | "RATE_LIMITED"
  | "GITHUB_UNAVAILABLE"
  | "UNEXPECTED_RESPONSE"
  | "GITHUB_CONFIG";

export class GithubError extends Error {
  constructor(public code: GithubErrorCode, message: string, public httpStatus: number) {
    super(message);
  }
}

export type InsightsResult = {
  insights: RepoInsights;
  fetchedAt: string;
  expiresAt: string;
  /** "fresh" = just fetched, "cache" = served from valid cache, "stale" = GitHub failed, old data served */
  source: "fresh" | "cache" | "stale";
  warning?: string;
};

export interface CacheStore {
  get(repo: string): Promise<{ payload: RepoInsights; fetchedAt: Date; expiresAt: Date } | null>;
  set(repo: string, payload: RepoInsights, fetchedAt: Date, expiresAt: Date): Promise<void>;
}

export const dbCacheStore: CacheStore = {
  async get(repo) {
    const [row] = await db.select().from(githubCache).where(eq(githubCache.repo, repo)).limit(1);
    return row ? { payload: row.payload as RepoInsights, fetchedAt: row.fetchedAt, expiresAt: row.expiresAt } : null;
  },
  async set(repo, payload, fetchedAt, expiresAt) {
    await db
      .insert(githubCache)
      .values({ repo, payload, fetchedAt, expiresAt })
      .onConflictDoUpdate({ target: githubCache.repo, set: { payload, fetchedAt, expiresAt } });
  },
};

const githubRepoSchema = z.object({
  full_name: z.string(),
  html_url: z.string().url(),
  description: z.string().nullable().optional(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  open_issues_count: z.number(),
  subscribers_count: z.number().optional(),
  watchers_count: z.number().optional(),
  language: z.string().nullable().optional(),
  pushed_at: z.string(),
});

type Deps = {
  fetchFn?: typeof fetch;
  now?: () => Date;
  store?: CacheStore;
  token?: string | undefined;
};

export function createGithubService(deps: Deps = {}) {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => new Date());
  const store = deps.store ?? dbCacheStore;
  const getToken = () => (deps.token !== undefined ? deps.token : process.env.GITHUB_TOKEN);

  async function fetchFromGithub(repo: string): Promise<RepoInsights> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "rovor-tickets",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetchFn(`https://api.github.com/repos/${repo}`, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      throw new GithubError("GITHUB_UNAVAILABLE", "Could not reach GitHub (network error or timeout)", 502);
    }

    if (res.status === 404) {
      throw new GithubError("REPO_NOT_FOUND", "Repository not found, deleted, or private", 404);
    }
    if (res.status === 401) {
      throw new GithubError("GITHUB_CONFIG", "GitHub credentials are invalid", 502);
    }
    // Primary limit: 403/429 + remaining=0. Secondary (abuse) limit: 403/429 + Retry-After.
    const limited = res.headers.get("x-ratelimit-remaining") === "0" || res.headers.has("retry-after");
    if (res.status === 429 || (res.status === 403 && limited)) {
      throw new GithubError("RATE_LIMITED", "GitHub rate limit reached. Try again shortly.", 429);
    }
    if (res.status === 403) {
      throw new GithubError("REPO_NOT_FOUND", "Repository is inaccessible", 404);
    }
    if (!res.ok) {
      throw new GithubError("GITHUB_UNAVAILABLE", `GitHub returned an error (${res.status})`, 502);
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new GithubError("UNEXPECTED_RESPONSE", "GitHub returned an unreadable response", 502);
    }
    const parsed = githubRepoSchema.safeParse(json);
    if (!parsed.success) {
      throw new GithubError("UNEXPECTED_RESPONSE", "GitHub returned incomplete repository data", 502);
    }
    const d = parsed.data;
    return {
      fullName: d.full_name,
      url: d.html_url,
      description: d.description ?? null,
      stars: d.stargazers_count,
      forks: d.forks_count,
      openIssues: d.open_issues_count,
      watchers: d.subscribers_count ?? d.watchers_count ?? 0,
      language: d.language ?? null,
      pushedAt: d.pushed_at,
    };
  }

  async function getInsights(input: string): Promise<InsightsResult> {
    let repo: string;
    try {
      repo = normalizeRepo(input).toLowerCase();
    } catch (e) {
      throw new GithubError("INVALID_REPO", e instanceof InvalidRepoError ? e.message : "Invalid repository", 400);
    }

    const t = now();
    let cached: Awaited<ReturnType<CacheStore["get"]>> = null;
    try {
      cached = await store.get(repo);
    } catch (e) {
      console.error("[github] cache read failed", e); // cache problems must never break the page
    }

    if (cached && cached.expiresAt.getTime() > t.getTime()) {
      return {
        insights: cached.payload,
        fetchedAt: cached.fetchedAt.toISOString(),
        expiresAt: cached.expiresAt.toISOString(),
        source: "cache",
      };
    }

    try {
      const insights = await fetchFromGithub(repo);
      const fetchedAt = now();
      const expiresAt = new Date(fetchedAt.getTime() + CACHE_TTL_MS);
      try {
        await store.set(repo, insights, fetchedAt, expiresAt);
      } catch (e) {
        console.error("[github] cache write failed", e);
      }
      return { insights, fetchedAt: fetchedAt.toISOString(), expiresAt: expiresAt.toISOString(), source: "fresh" };
    } catch (e) {
      // Repo gone/private: don't keep serving stale data as if it were valid.
      const serveStale = cached && e instanceof GithubError && e.code !== "REPO_NOT_FOUND" && e.code !== "INVALID_REPO";
      if (serveStale && cached) {
        return {
          insights: cached.payload,
          fetchedAt: cached.fetchedAt.toISOString(),
          expiresAt: cached.expiresAt.toISOString(),
          source: "stale",
          warning: `Showing cached data — GitHub refresh failed (${(e as GithubError).message}).`,
        };
      }
      throw e;
    }
  }

  return { getInsights };
}

export const githubService = createGithubService();
