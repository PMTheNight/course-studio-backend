import { getDb } from "@/lib/mongodb";
import { cookieOptions, sessionHash } from "@/lib/auth";
import { handler, successResponse } from "@/lib/utils";
export const POST = handler(async (request) => {
  const token = request.cookies.get("token")?.value;
  if (token)
    await (await getDb())
      .collection("sessions")
      .deleteOne({ _id: sessionHash(token) });
  const response = successResponse({ message: "Signed out" }, 200, request);
  response.cookies.set("token", "", { ...cookieOptions(), maxAge: 0 });
  return response;
});
