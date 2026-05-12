// In-memory rate limiter — resets when the server restarts.
// For persistent limits across restarts, swap the Map for a Redis/Upstash store.
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CALLS  = 20;                   // max API calls per IP per day

const ipLog = new Map(); // { ip: { count, windowStart } }

function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipLog.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    ipLog.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= MAX_CALLS) return true;

  entry.count += 1;
  return false;
}

// Clean up stale entries every hour to avoid memory leaks
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, entry] of ipLog) {
    if (entry.windowStart < cutoff) ipLog.delete(ip);
  }
}, 60 * 60 * 1000);

export async function POST(req) {
  // Get real IP (works on Vercel; falls back to header or unknown)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return Response.json(
      { error: "Daily limit reached. Come back tomorrow!" },
      { status: 429 }
    );
  }

  const body = await req.json();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
