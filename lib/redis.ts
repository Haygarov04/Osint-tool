import { Redis } from "@upstash/redis";
import { hasUpstash } from "./config";

// Ленив singleton — клиентът се създава при първо ползване, а не при импорт,
// за да не чупи build-а, ако env променливите ги няма още.
let client: Redis | null = null;

export function getRedis(): Redis {
  if (!hasUpstash()) {
    throw new Error(
      "Липсват UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. " +
        "Добави Upstash storage във Vercel или попълни .env.local за локален дев."
    );
  }
  if (!client) {
    client = Redis.fromEnv();
  }
  return client;
}
