import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { handler, successResponse } from "@/lib/utils";
import { enrollCourse, objectId } from "@/models/course";
export const POST = handler(async (request, { params }) => {
  const user = await requireUser(request, "Student");
  await enrollCourse(
    await getDb(),
    objectId((await params).course_id),
    user._id,
  );
  return successResponse({ message: "You are enrolled" }, 201, request);
});
