import { describe, expect, it, vi } from "vitest";
import { CACHE_TTL_MS, GithubError, createGithubService, type CacheStore, type RepoInsights } from "@/server/github/service";

const ghBody = {
  full_name: "Owner/Repo", html_url: "https://github.com/Owner/Repo", description: "desc",
  stargazers_count: 10, forks_count: 2, open_issues_count: 3, subscribers_count: 4, language: "TypeScript",
  pushed_at: "2026-10-01T00:00:00Z",
};
const ok = (body: unknown = ghBody) => new Response(JSON.stringify(body), { status: 200 });
const status = (s: number, headers: Record<string, string> = {}) => new Response("{}", { status: s, headers });

function memStore(): CacheStore & { rows: Map<string, { payload: RepoInsights; fetchedAt: Date; expiresAt: Date }> } {
  const rows = new Map();
  return { rows, get: async (r) => rows.get(r) ?? null, set: async (r, payload, fetchedAt, expiresAt) => void rows.set(r, { payload, fetchedAt, expiresAt }) };
}

function setup(fetchImpl: () => Promise<Response>) {
  let t = new Date("2026-10-06T10:00:00Z").getTime();
  const store = memStore();
  const fetchFn = vi.fn(fetchImpl) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  const svc = createGithubService({ fetchFn, now: () => new Date(t), store, token: undefined });
  return { svc, store, fetchFn: fetchFn as ReturnType<typeof vi.fn>, advance: (ms: number) => (t += ms) };
}

describe("github caching (5 minutes)", () => {
  it("first request fetches, requests within 5 min hit the cache", async () => {
    const { svc, fetchFn, advance } = setup(async () => ok());
    const a = await svc.getInsights("Owner/Repo");
    expect(a.source).toBe("fresh");
    advance(CACHE_TTL_MS - 1000);
    const b = await svc.getInsights("OWNER/repo");
    expect(b.source).toBe("cache");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("refreshes after 5 minutes", async () => {
    const { svc, fetchFn, advance } = setup(async () => ok());
    await svc.getInsights("owner/repo");
    advance(CACHE_TTL_MS + 1);
    expect((await svc.getInsights("owner/repo")).source).toBe("fresh");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("serves stale data when refresh fails (network / 5xx / rate limit / bad payload)", async () => {
    for (const failure of [
      () => Promise.reject(new Error("boom")),
      async () => status(500),
      async () => status(403, { "x-ratelimit-remaining": "0" }),
      async () => ok({ nonsense: true }),
    ]) {
      let fail = false;
      const { svc, advance } = setup(async () => (fail ? failure() : ok()));
      await svc.getInsights("owner/repo");
      advance(CACHE_TTL_MS + 1);
      fail = true;
      const r = await svc.getInsights("owner/repo");
      expect(r.source).toBe("stale");
      expect(r.warning).toBeTruthy();
      expect(r.insights.stars).toBe(10);
    }
  });

  it("does not serve stale data if the repo is now gone (404)", async () => {
    let gone = false;
    const { svc, advance } = setup(async () => (gone ? status(404) : ok()));
    await svc.getInsights("owner/repo");
    advance(CACHE_TTL_MS + 1);
    gone = true;
    await expect(svc.getInsights("owner/repo")).rejects.toMatchObject({ code: "REPO_NOT_FOUND" });
  });

  it("is not broken by a failing cache store", async () => {
    const store: CacheStore = { get: async () => { throw new Error("db down"); }, set: async () => { throw new Error("db down"); } };
    const svc = createGithubService({ fetchFn: (async () => ok()) as unknown as typeof fetch, store });
    expect((await svc.getInsights("owner/repo")).source).toBe("fresh");
  });
});

describe("github error mapping", () => {
  const cases: [string, () => Promise<Response>, string, number][] = [
    ["404 not found/private", async () => status(404), "REPO_NOT_FOUND", 404],
    ["403 rate limited", async () => status(403, { "x-ratelimit-remaining": "0" }), "RATE_LIMITED", 429],
    ["429", async () => status(429), "RATE_LIMITED", 429],
    ["403 secondary limit (Retry-After)", async () => status(403, { "retry-after": "30" }), "RATE_LIMITED", 429],
    ["403 inaccessible", async () => status(403), "REPO_NOT_FOUND", 404],
    ["401 bad token", async () => status(401), "GITHUB_CONFIG", 502],
    ["500", async () => status(500), "GITHUB_UNAVAILABLE", 502],
    ["network failure", () => Promise.reject(new TypeError("fetch failed")), "GITHUB_UNAVAILABLE", 502],
    ["incomplete payload", async () => ok({ full_name: "a/b" }), "UNEXPECTED_RESPONSE", 502],
    ["non-JSON body", async () => new Response("<html>", { status: 200 }), "UNEXPECTED_RESPONSE", 502],
  ];
  it.each(cases)("%s", async (_n, impl, code, http) => {
    const { svc } = setup(impl);
    const err = await svc.getInsights("owner/repo").catch((e) => e);
    expect(err).toBeInstanceOf(GithubError);
    expect(err).toMatchObject({ code, httpStatus: http });
  });

  it("rejects invalid repo input before calling GitHub", async () => {
    const { svc, fetchFn } = setup(async () => ok());
    await expect(svc.getInsights("not/a/valid/repo")).rejects.toMatchObject({ code: "INVALID_REPO", httpStatus: 400 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("falls back from subscribers_count to watchers_count and tolerates null language", async () => {
    const { svc } = setup(async () => ok({ ...ghBody, subscribers_count: undefined, watchers_count: 7, language: null }));
    const r = await svc.getInsights("owner/repo");
    expect(r.insights.watchers).toBe(7);
    expect(r.insights.language).toBeNull();
  });
});
