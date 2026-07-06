import { Redis } from "@upstash/redis";
import { hasUpstash, redisToken, redisUrl } from "./config";

// Ленив singleton — клиентът се създава при първо ползване, а не при импорт,
// за да не чупи build-а, ако env променливите ги няма още.
let client: Redis | null = null;

export function getRedis(): Redis {
  if (!hasUpstash()) {
    throw new Error(
      "Липсват Upstash кредитали (UPSTASH_REDIS_REST_URL/TOKEN или KV_REST_API_URL/TOKEN). " +
        "Свържи Upstash storage във Vercel или попълни .env.local за локален дев."
    );
  }
  if (!client) {
    client = new Redis({ url: redisUrl(), token: redisToken() });
  }
  return client;
}
