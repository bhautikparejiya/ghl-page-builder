import { Redis } from "@upstash/redis";
import fs from "node:fs";
import path from "node:path";

/**
 * Tiny JSON key-value store.
 * - Production (Vercel): Upstash Redis (KV_REST_API_URL / KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_*)
 * - Local dev: a JSON file in ./.data/db.json
 */
interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
}

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function redisStore(): KV {
  const redis = new Redis({ url: redisUrl!, token: redisToken! });
  return {
    async get<T>(key: string) {
      return ((await redis.get<T>(key)) ?? null) as T | null;
    },
    async set<T>(key: string, value: T) {
      await redis.set(key, value);
    },
    async del(key: string) {
      await redis.del(key);
    },
  };
}

function fileStore(): KV {
  if (process.env.VERCEL) {
    throw new Error("No Redis configured. Connect Upstash Redis to this Vercel project (see README).");
  }
  const file = path.join(process.cwd(), ".data", "db.json");
  const read = (): Record<string, unknown> => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return {};
    }
  };
  const write = (db: Record<string, unknown>) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db, null, 2));
  };
  return {
    async get<T>(key: string) {
      return (read()[key] as T) ?? null;
    },
    async set<T>(key: string, value: T) {
      const db = read();
      db[key] = value;
      write(db);
    },
    async del(key: string) {
      const db = read();
      delete db[key];
      write(db);
    },
  };
}

let instance: KV | null = null;
export function kv(): KV {
  if (!instance) instance = redisUrl && redisToken ? redisStore() : fileStore();
  return instance;
}
