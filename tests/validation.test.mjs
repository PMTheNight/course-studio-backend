import test from "node:test";
import assert from "node:assert/strict";
import { courseInput, objectId } from "../src/models/course.js";
const valid = {
  name: "  Web Development  ",
  duration: 7,
  topics: ["React", "React"],
  price: 19.99,
  maxStudents: 3,
  status: "Open",
};
test("course fields are normalized and topics deduplicated", () => {
  assert.deepEqual(courseInput(valid), {
    ...valid,
    name: "Web Development",
    topics: ["React"],
  });
});
test("rejects invalid, coerced, missing and protected fields", () => {
  for (const data of [
    { ...valid, teacherId: "spoof" },
    { ...valid, studentIds: [] },
    { ...valid, status: "open" },
    { ...valid, duration: 1.5 },
    { ...valid, maxStudents: "3" },
    { ...valid, maxStudents: 0 },
    { ...valid, price: -1 },
    { ...valid, price: 0.123 },
    { ...valid, topics: [""] },
    { ...valid, name: " " },
    { name: "only" },
  ])
    assert.throws(() => courseInput(data), { status: 400 });
});
test("partial updates accept only provided fields", () => {
  assert.deepEqual(courseInput({ status: "Close" }, true), { status: "Close" });
  assert.throws(() => courseInput({}, true), { status: 400 });
});
test("IDs are strict MongoDB ObjectIds", () => {
  assert.equal(
    objectId("123456789012345678901234").toString(),
    "123456789012345678901234",
  );
  for (const value of ["invalid", null, {}, 123, "123456789012"])
    assert.throws(() => objectId(value), { status: 400 });
});
