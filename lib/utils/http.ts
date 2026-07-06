import { config } from "../config";
import { getRedis } from "../redis";
import { hasUpstash } from "../config";

interface FetchOpts {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  // TTL за кеширане в Redis (сек). 0 = без кеш.
  cacheTtl?: number;
  method?: "GET" | "POST";
  body?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Сваля страница и връща HTML + крайния URL след пренасочвания (за SSL детекция).
export async function fetchPage(
  url: string,
  { timeoutMs = 10000 }: { timeoutMs?: number } = {}
): Promise<{ html: string; finalUrl: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": config.userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return { html: await res.text(), finalUrl: res.url || url };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// Сваля суров текст/HTML (за скролване на сайтове). Кратък таймаут, 1 повторение.
export async function fetchText(
  url: string,
  { timeoutMs = 10000, retries = 1 }: { timeoutMs?: number; retries?: number } = {}
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": config.userAgent,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) await sleep(500);
    }
  }
  throw new Error(`fetchText ${url}: ${String(lastErr)}`);
}

function cacheKey(url: string, body?: string): string {
  // Проста детерминирана дължина — достатъчна за ключ.
  const raw = url + (body ?? "");
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h << 5) - h + raw.charCodeAt(i);
    h |= 0;
  }
  return `cache:${h}`;
}

// GET/POST с exponential backoff, таймаут и по избор Redis кеш.
export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchOpts = {}
): Promise<T> {
  const {
    headers = {},
    timeoutMs = 30000,
    retries = 3,
    cacheTtl = 0,
    method = "GET",
    body,
  } = opts;

  const key = cacheKey(url, body);
  if (cacheTtl > 0 && hasUpstash()) {
    try {
      const cached = await getRedis().get<T>(key);
      if (cached !== null && cached !== undefined) return cached;
    } catch {
      // кешът е best-effort — при проблем просто продължаваме
    }
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: { "User-Agent": config.userAgent, ...headers },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as T;
      if (cacheTtl > 0 && hasUpstash()) {
        try {
          await getRedis().set(key, data, { ex: cacheTtl });
        } catch {
          /* best-effort */
        }
      }
      return data;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await sleep(500 * Math.pow(2, attempt)); // 0.5s, 1s, 2s
      }
    }
  }
  throw new Error(
    `Заявката към ${url} се провали след ${retries + 1} опита: ${String(
      lastErr
    )}`
  );
}
