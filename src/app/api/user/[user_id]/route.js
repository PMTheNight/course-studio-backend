import { publicUser, requireUser } from "@/lib/auth";
import { handler, successResponse, ApiError } from "@/lib/utils";
export const GET = handler(async (request, { params }) => {
  const user = await requireUser(request);
  const { user_id } = await params;
  if (user._id.toString() !== user_id)
    throw new ApiError(403, "You can only view your own profile");
  return successResponse({ user: publicUser(user) }, 200, request);
});
