import "server-only";

// Minimal in-memory rate limiter (sliding window). Per serverless instance —
// not a hard global guarantee, but it turns "trivially scriptable" into
// "annoying and slow", which is the right bar for a classroom platform.
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) buckets.clear(); // crude memory guard
  return true;
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
}
