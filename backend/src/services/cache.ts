import Redis from 'ioredis';
import { env } from '../lib/env.js';

const ttlSeconds = env.CACHE_TTL_SECONDS ?? 3600;

class CacheClient {
  private readonly client: Redis | null;
  private readonly enabled: boolean;

  constructor() {
    if (!env.CACHE_URL) {
      this.client = null;
      this.enabled = false;
      return;
    }

    this.client = new Redis(env.CACHE_URL, {
      lazyConnect: true
    });
    this.enabled = true;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async connect(): Promise<void> {
    if (!this.client) {
      return;
    }

    if (this.client.status === 'wait' || this.client.status === 'end' || this.client.status === 'close') {
      await this.client.connect();
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    await this.connect();
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl = ttlSeconds): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.connect();
    if (ttl > 0) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    if (this.client.status === 'wait') {
      return;
    }

    await this.client.quit();
  }
}

export const cacheClient = new CacheClient();
