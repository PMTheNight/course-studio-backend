import { ObjectId } from "mongodb";
import { ApiError } from "../lib/errors.js";
export function objectId(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{24}$/i.test(value))
    throw new ApiError(400, "Invalid ID");
  return new ObjectId(value);
}
export function courseInput(data, partial = false) {
  const fields = [
    "name",
    "duration",
    "topics",
    "price",
    "maxStudents",
    "status",
  ];
  if (Object.keys(data).some((key) => !fields.includes(key)))
    throw new ApiError(400, "Unknown or protected course field");
  const result = {};
  for (const field of fields) {
    if (!(field in data)) {
      if (partial) continue;
      throw new ApiError(400, `${field} is required`);
    }
    const value = data[field];
    if (field === "name") {
      if (
        typeof value !== "string" ||
        !value.trim() ||
        value.trim().length > 120
      )
        throw new ApiError(400, "Course name must be 1–120 characters");
      result[field] = value.trim();
    } else if (field === "topics") {
      if (
        !Array.isArray(value) ||
        !value.length ||
        value.length > 30 ||
        value.some(
          (t) => typeof t !== "string" || !t.trim() || t.trim().length > 100,
        )
      )
        throw new ApiError(400, "Provide 1–30 topics, each 1–100 characters");
      result[field] = [...new Set(value.map((t) => t.trim()))];
    } else if (field === "status") {
      if (!["Open", "Close", "Cancel"].includes(value))
        throw new ApiError(400, "Status must be Open, Close, or Cancel");
      result[field] = value;
    } else {
      const max =
        field === "price" ? 1000000 : field === "duration" ? 3650 : 10000;
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < (field === "price" ? 0 : 1) ||
        value > max ||
        (field !== "price" && !Number.isInteger(value))
      )
        throw new ApiError(400, `Invalid ${field}`);
      if (
        field === "price" &&
        Math.abs(value * 100 - Math.round(value * 100)) > 0.000001
      )
        throw new ApiError(400, "Price allows at most two decimals");
      result[field] = value;
    }
  }
  if (!Object.keys(result).length)
    throw new ApiError(400, "No fields to update");
  return result;
}
export function courseView(course, user, teacher) {
  return {
    id: course._id.toString(),
    name: course.name,
    duration: course.duration,
    topics: course.topics,
    price: course.price,
    maxStudents: course.maxStudents,
    status: course.status,
    teacherId: course.teacherId.toString(),
    teacherName: teacher?.username || "Teacher",
    enrolledCount: course.studentIds.length,
    seatsRemaining: course.maxStudents - course.studentIds.length,
    enrolled: course.studentIds.some((id) => id.equals(user._id)),
  };
}
export async function enrollCourse(db, id, studentId) {
  // A single document is the serialization point for enrollment, status, capacity and deletion.
  const result = await db.collection("courses").findOneAndUpdate(
    {
      _id: id,
      status: "Open",
      studentIds: { $ne: studentId },
      $expr: { $lt: [{ $size: "$studentIds" }, "$maxStudents"] },
    },
    { $addToSet: { studentIds: studentId }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (result) return result;
  const course = await db.collection("courses").findOne({ _id: id });
  if (!course || course.status === "Cancel")
    throw new ApiError(404, "Course not found");
  if (course.studentIds.some((id) => id.equals(studentId)))
    throw new ApiError(409, "You are already enrolled in this course");
  throw new ApiError(
    409,
    course.status !== "Open"
      ? "This course is closed for enrollment"
      : "This course is full",
  );
}
