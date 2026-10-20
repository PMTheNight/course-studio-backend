import { NextResponse } from "next/server";
import corsHeaders, { allowedOrigin } from "./cors.js";
import { ApiError } from "./errors.js";
export { ApiError } from "./errors.js";
export function errorResponse(message, status, request) {
  return NextResponse.json(
    { message },
    { status, headers: corsHeaders(request) },
  );
}
export function successResponse(data, status = 200, request) {
  return NextResponse.json(data, { status, headers: corsHeaders(request) });
}
export function printExceptionLog(message, error) {
  console.error(message, error.message);
}
export function handler(fn) {
  return async (request, context) => {
    try {
      if (!allowedOrigin(request))
        throw new ApiError(403, "Origin is not allowed");
      return await fn(request, context);
    } catch (error) {
      if (error instanceof ApiError)
        return errorResponse(error.message, error.status, request);
      if (error.code === 11000)
        return errorResponse("That value is already in use", 409, request);
      printExceptionLog("API request failed", error);
      return errorResponse(
        "Service unavailable. Please try again.",
        503,
        request,
      );
    }
  };
}
export async function readJson(request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "Use application/json");
  const raw = await request.text();
  if (raw.length > 20000) throw new ApiError(413, "Request is too large");
  try {
    const data = JSON.parse(raw);
    if (!data || Array.isArray(data) || typeof data !== "object")
      throw new Error();
    return data;
  } catch {
    throw new ApiError(400, "Invalid JSON object");
  }
}
