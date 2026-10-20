export function allowedOrigin(request) {
  const origin = request.headers.get("origin");
  const origins = (process.env.FRONTEND_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim());
  return !origin || origins.includes(origin);
}
export default function corsHeaders(request) {
  const origin = request?.headers.get("origin");
  return {
    ...(origin && allowedOrigin(request)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
