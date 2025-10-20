import type {
  AnalyticsDailyTrend,
  AnalyticsSummary,
  ScoreDistributionBucket
} from '../types/index.js';

type CacheClient = {
  isEnabled(): boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del?(key: string): Promise<void>;
};

type CacheRecord<T> = {
  value: T;
  expiresAt: number;
};

const inMemoryCache = new Map<string, CacheRecord<unknown>>();
const DEFAULT_TTL_SECONDS = (() => {
  const raw = process.env.CACHE_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
})();

let cacheClientPromise: Promise<CacheClient | null> | null = null;

async function resolveCacheClient(): Promise<CacheClient | null> {
  if (!cacheClientPromise) {
    cacheClientPromise = import('./cache.js')
      .then((module) => module.cacheClient as CacheClient)
      .catch(() => null);
  }

  return cacheClientPromise;
}

function getCacheKey(...segments: Array<string | number>): string {
  return segments.join(':');
}

function getFromMemoryCache<T>(key: string): T | null {
  const record = inMemoryCache.get(key) as CacheRecord<T> | undefined;
  if (!record) {
    return null;
  }

  if (record.expiresAt < Date.now()) {
    inMemoryCache.delete(key);
    return null;
  }

  return record.value;
}

function setMemoryCache<T>(key: string, value: T, ttlSeconds: number): void {
  if (ttlSeconds <= 0) {
    inMemoryCache.delete(key);
    return;
  }

  const expiresAt = Date.now() + ttlSeconds * 1000;
  inMemoryCache.set(key, { value, expiresAt });
}

async function getOrSetCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const memoryHit = getFromMemoryCache<T>(key);
  if (memoryHit !== null) {
    return memoryHit;
  }

  const cacheClient = await resolveCacheClient();
  if (cacheClient?.isEnabled()) {
    try {
      const cachedValue = await cacheClient.get(key);
      if (cachedValue) {
        const parsed = JSON.parse(cachedValue) as T;
        setMemoryCache(key, parsed, ttlSeconds);
        return parsed;
      }
    } catch {
      // ignore cache errors to keep API responsive
    }
  }

  const value = await fetcher();
  try {
    setMemoryCache(key, value, ttlSeconds);
    if (cacheClient?.isEnabled()) {
      await cacheClient.set(key, JSON.stringify(value), ttlSeconds);
    }
  } catch {
    // ignore cache errors
  }

  return value;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const cacheKey = getCacheKey('analytics', 'summary');
  return getOrSetCache(cacheKey, DEFAULT_TTL_SECONDS, async () => {
    const { fetchAnalyticsSummary } = await import('../lib/analytics.js');
    const summary = await fetchAnalyticsSummary();
    return summary;
  });
}

export async function getScoreTrends(days: number): Promise<AnalyticsDailyTrend[]> {
  const normalizedDays = Math.min(Math.max(Math.trunc(days), 1), 90);
  const cacheKey = getCacheKey('analytics', 'trends', normalizedDays);
  return getOrSetCache(cacheKey, DEFAULT_TTL_SECONDS, async () => {
    const { fetchDailyTrends } = await import('../lib/analytics.js');
    const trend = await fetchDailyTrends(normalizedDays);
    return trend;
  });
}

export async function getScoreDistribution(): Promise<ScoreDistributionBucket[]> {
  const cacheKey = getCacheKey('analytics', 'distribution');
  return getOrSetCache(cacheKey, DEFAULT_TTL_SECONDS, async () => {
    const { fetchScoreDistribution } = await import('../lib/analytics.js');
    const distribution = await fetchScoreDistribution();
    return distribution;
  });
}

export async function clearAnalyticsCache(): Promise<void> {
  inMemoryCache.clear();
  const cacheClient = await resolveCacheClient();
  if (!cacheClient?.isEnabled()) {
    return;
  }

  await Promise.all([
    cacheClient.del?.(getCacheKey('analytics', 'summary')),
    cacheClient.del?.(getCacheKey('analytics', 'distribution'))
  ]);

  // trends caches are namespaced per day range; best effort removal
  const trendKeys = Array.from({ length: 90 }, (_, index) => getCacheKey('analytics', 'trends', index + 1));
  await Promise.all(trendKeys.map((trendKey) => cacheClient.del?.(trendKey)));
}
