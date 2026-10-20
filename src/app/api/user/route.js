import { publicUser, requireUser } from "@/lib/auth";
import { handler, successResponse } from "@/lib/utils";
// The collection endpoint exposes only the caller, never a directory of private accounts.
export const GET = handler(async (request) =>
  successResponse(
    { users: [publicUser(await requireUser(request))] },
    200,
    request,
  ),
);
