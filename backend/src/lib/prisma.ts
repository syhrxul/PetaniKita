import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { setTimeout as sleep } from "node:timers/promises";

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST ?? "100.107.202.80",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "arul",
  database: process.env.DB_NAME ?? "harvestos",
  connectionLimit: 10,
  acquireTimeout: 30000,
  connectTimeout: 15000,
  idleTimeout: 60000,
});

export const prisma = new PrismaClient({
  adapter,
  log: ["error"],
});

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

const RETRYABLE_ERRORS = [
  "pool timeout",
  "failed to retrieve a connection",
  "ECONNREFUSED",
  "ECONNRESET",
  "40001",
  "deadlock",
];

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return RETRYABLE_ERRORS.some((pattern) => msg.includes(pattern));
}

export async function withRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err: unknown) {
      lastError = err;

      if (!isRetryableError(err)) {
        throw err;
      }

      if (attempt === MAX_RETRIES) {
        console.error(`[Prisma] ${label} failed after ${MAX_RETRIES} attempts`);
        throw err;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.warn(`[Prisma] ${label} attempt ${attempt}/${MAX_RETRIES} failed. Retrying in ${Math.round(delay)}ms...`);

      try {
        await prisma.$disconnect();
      } catch {
        // ignore
      }

      await sleep(delay);

      try {
        await prisma.$connect();
      } catch {
        // ignore, will retry
      }
    }
  }

  throw lastError;
}
