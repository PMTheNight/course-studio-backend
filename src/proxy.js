import { NextResponse } from "next/server";
import { verifyJWT } from "./lib/auth.js";
import corsHeaders, { allowedOrigin } from "./lib/cors.js";
import { errorResponse } from "./lib/utils.js";

export function proxy(request) {
  if (!allowedOrigin(request))
    return errorResponse("Origin is not allowed", 403, request);
  if (request.method === "OPTIONS")
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  const publicPath = request.nextUrl.pathname === "/api/auth/login";
  if (!publicPath && !verifyJWT(request))
    return errorResponse("Please sign in", 401, request);
  // Route handlers verify the database session and roles independently; never trust client user headers.
  return NextResponse.next();
}
export const config = { matcher: ["/api/:path*"] };
