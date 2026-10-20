import { publicUser, requireUser } from "@/lib/auth";
import { handler, successResponse } from "@/lib/utils";
export const GET = handler(async (request) =>
  successResponse(
    { user: publicUser(await requireUser(request)) },
    200,
    request,
  ),
);
