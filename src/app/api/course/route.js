import { getDb } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { handler, readJson, successResponse, ApiError } from "@/lib/utils";
import { courseInput, courseView } from "@/models/course";
export const GET = handler(async (request) => {
  const user = await requireUser(request);
  const db = await getDb();
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() || "";
  if (query.length > 120) throw new ApiError(400, "Search is too long");
  const filter =
    user.role === "Teacher"
      ? { teacherId: user._id }
      : { status: { $ne: "Cancel" } };
  if (url.searchParams.get("enrolled") === "true") {
    if (user.role !== "Student")
      throw new ApiError(403, "Student account required");
    filter.studentIds = user._id;
  }
  if (query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = { $regex: escaped, $options: "i" };
    const teachers = await db
      .collection("users")
      .find({ role: "Teacher", username: regex }, { projection: { _id: 1 } })
      .toArray();
    filter.$or = [
      { name: regex },
      { teacherId: { $in: teachers.map((t) => t._id) } },
    ];
  }
  const courses = await db
    .collection("courses")
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .toArray();
  const teachers = await db
    .collection("users")
    .find(
      { _id: { $in: courses.map((c) => c.teacherId) } },
      { projection: { username: 1 } },
    )
    .toArray();
  return successResponse(
    {
      courses: courses.map((c) =>
        courseView(
          c,
          user,
          teachers.find((t) => t._id.equals(c.teacherId)),
        ),
      ),
    },
    200,
    request,
  );
});
export const POST = handler(async (request) => {
  const user = await requireUser(request, "Teacher");
  const data = courseInput(await readJson(request));
  const course = {
    ...data,
    teacherId: user._id,
    studentIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await (await getDb()).collection("courses").insertOne(course);
  return successResponse(
    { course: courseView({ ...course, _id: result.insertedId }, user, user) },
    201,
    request,
  );
});
