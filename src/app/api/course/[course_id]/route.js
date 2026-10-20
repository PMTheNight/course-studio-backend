import { getDb } from "@/lib/mongodb";
import { requireUser, publicUser } from "@/lib/auth";
import { handler, readJson, successResponse, ApiError } from "@/lib/utils";
import { courseInput, courseView, objectId } from "@/models/course";
export const GET = handler(async (request, { params }) => {
  const user = await requireUser(request);
  const db = await getDb();
  const filter = { _id: objectId((await params).course_id) };
  if (user.role === "Teacher") filter.teacherId = user._id;
  else filter.status = { $ne: "Cancel" };
  const course = await db.collection("courses").findOne(filter);
  if (!course) throw new ApiError(404, "Course not found");
  const teacher = await db
    .collection("users")
    .findOne({ _id: course.teacherId });
  const view = courseView(course, user, teacher);
  if (user.role === "Teacher")
    view.students = (
      await db
        .collection("users")
        .find({ _id: { $in: course.studentIds } })
        .toArray()
    ).map(publicUser);
  return successResponse({ course: view }, 200, request);
});
const update = handler(async (request, { params }) => {
  const user = await requireUser(request, "Teacher");
  const data = courseInput(await readJson(request), request.method === "PATCH");
  const db = await getDb();
  const owned = {
    _id: objectId((await params).course_id),
    teacherId: user._id,
  };
  const filter = { ...owned };
  if (data.maxStudents !== undefined)
    filter.$expr = { $lte: [{ $size: "$studentIds" }, data.maxStudents] };
  const course = await db
    .collection("courses")
    .findOneAndUpdate(
      filter,
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
  if (!course) {
    if (!(await db.collection("courses").findOne(owned)))
      throw new ApiError(404, "Course not found");
    throw new ApiError(409, "Capacity cannot be below current enrollment");
  }
  return successResponse(
    { course: courseView(course, user, user) },
    200,
    request,
  );
});
export const PUT = update;
export const PATCH = update;
export const DELETE = handler(async (request, { params }) => {
  const user = await requireUser(request, "Teacher");
  const db = await getDb();
  const owned = {
    _id: objectId((await params).course_id),
    teacherId: user._id,
  };
  const result = await db
    .collection("courses")
    .deleteOne({ ...owned, studentIds: { $size: 0 } });
  if (!result.deletedCount) {
    if (!(await db.collection("courses").findOne(owned)))
      throw new ApiError(404, "Course not found");
    throw new ApiError(409, "Courses with enrolled students cannot be deleted");
  }
  return successResponse({ message: "Course deleted" }, 200, request);
});
