import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { seed } from "../scripts/seed.mjs";
let mongo,
  db,
  client,
  server,
  base,
  logs = "";
const users = {};
const secret = randomBytes(32).toString("hex");
const valid = {
  name: "Concurrency Workshop",
  duration: 4,
  topics: ["MongoDB", "Testing"],
  price: 49.99,
  maxStudents: 2,
  status: "Open",
};
async function request(
  path,
  { cookie, method = "GET", body, headers = {} } = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
    headers: response.headers,
  };
}
async function create(data = {}, cookie = users.teacher1.cookie) {
  const result = await request("/api/course", {
    method: "POST",
    cookie,
    body: { ...valid, ...data },
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.course;
}
before(
  async () => {
    mongo = await MongoMemoryServer.create({
      binary: {
        downloadDir:
          process.env.MONGOMS_DOWNLOAD_DIR || "/tmp/course-mongodb-binaries",
      },
    });
    client = await new MongoClient(mongo.getUri()).connect();
    db = client.db("course_tests");
    await seed(db);
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    base = `http://127.0.0.1:${port}`;
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "-p",
        String(port),
        "-H",
        "127.0.0.1",
      ],
      {
        env: {
          ...process.env,
          MONGODB_URI: mongo.getUri(),
          MONGODB_DB: "course_tests",
          JWT_SECRET: secret,
          FRONTEND_ORIGINS: "http://localhost:5173",
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    server.stdout.on("data", (data) => (logs += data));
    server.stderr.on("data", (data) => (logs += data));
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base)).ok) {
          ready = true;
          break;
        }
      } catch {}
      if (server.exitCode !== null) throw new Error(logs);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.ok(ready, logs);
    for (const role of ["student", "teacher"])
      for (let i = 1; i <= 3; i++) {
        const username = `${role}${i}`;
        const result = await request("/api/auth/login", {
          method: "POST",
          body: {
            login: i === 2 ? `${username}@example.com` : username,
            password: "CourseDemo2026!",
          },
        });
        assert.equal(result.status, 200, JSON.stringify(result.body));
        users[username] = {
          ...result.body.user,
          cookie: result.headers.get("set-cookie").split(";")[0],
        };
      }
  },
  { timeout: 180000 },
);
after(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
  await client?.close();
  await mongo?.stop();
});
test("authentication, cookie flags, session restoration and privacy", async () => {
  assert.equal((await request("/api/course")).status, 401);
  assert.equal(
    (
      await request("/api/course", {
        headers: { "x-user-id": users.teacher1.id, "x-user-role": "Teacher" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { login: "student1", password: "wrong" },
      })
    ).status,
    401,
  );
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { login: " STUDENT1 ", password: "CourseDemo2026!" },
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(login.headers.get("set-cookie"), /SameSite=lax/i);
  assert.match(login.headers.get("set-cookie"), /Secure/i);
  const me = await request("/api/auth/me", { cookie: users.student1.cookie });
  assert.equal(me.body.user.role, "Student");
  assert.equal(me.body.user.passwordHash, undefined);
  assert.equal(
    (
      await request(`/api/user/${users.student1.id}`, {
        cookie: users.student2.cookie,
      })
    ).status,
    403,
  );
  const list = await request("/api/user", { cookie: users.teacher1.cookie });
  assert.equal(list.body.users.length, 1);
  assert.equal(list.body.users[0].id, users.teacher1.id);
  const forged = jwt.sign({ id: users.teacher1.id }, "wrong-secret", {
    expiresIn: "1h",
  });
  assert.equal(
    (await request("/api/course", { cookie: `token=${forged}` })).status,
    401,
  );
  const expired = jwt.sign({ id: users.teacher1.id }, secret, {
    expiresIn: -1,
    issuer: "course-service",
    audience: "course-frontend",
  });
  assert.equal(
    (await request("/api/course", { cookie: `token=${expired}` })).status,
    401,
  );
  const unsignedSession = jwt.sign({ id: users.teacher1.id }, secret, {
    expiresIn: "1h",
    issuer: "course-service",
    audience: "course-frontend",
  });
  assert.equal(
    (await request("/api/course", { cookie: `token=${unsignedSession}` }))
      .status,
    401,
  );
});
test("role enforcement and teacher-owned create/read/update/delete", async () => {
  assert.equal(
    (
      await request("/api/course", {
        method: "POST",
        cookie: users.student1.cookie,
        body: valid,
      })
    ).status,
    403,
  );
  const course = await create();
  assert.equal(
    (
      await request(`/api/course/${course.id}`, {
        cookie: users.teacher2.cookie,
      })
    ).status,
    404,
  );
  for (const method of ["PUT", "PATCH", "DELETE"])
    assert.equal(
      (
        await request(`/api/course/${course.id}`, {
          method,
          cookie: users.teacher2.cookie,
          ...(method !== "DELETE"
            ? { body: method === "PUT" ? valid : { name: "Stolen" } }
            : {}),
        })
      ).status,
      404,
    );
  assert.equal(
    (
      await request(`/api/course/${course.id}`, {
        method: "PATCH",
        cookie: users.student1.cookie,
        body: { status: "Cancel" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/course/${course.id}/enroll`, {
        method: "POST",
        cookie: users.teacher1.cookie,
      })
    ).status,
    403,
  );
  const own = await request("/api/course", { cookie: users.teacher2.cookie });
  assert.ok(own.body.courses.every((c) => c.teacherId === users.teacher2.id));
  assert.equal(
    (
      await request(`/api/course/${course.id}`, {
        method: "PUT",
        cookie: users.teacher1.cookie,
        body: { ...valid, name: "Updated Workshop" },
      })
    ).body.course.name,
    "Updated Workshop",
  );
  assert.equal(
    (
      await request(`/api/course/${course.id}`, {
        method: "DELETE",
        cookie: users.teacher1.cookie,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/course/${course.id}`, {
        cookie: users.teacher1.cookie,
      })
    ).status,
    404,
  );
});
test("validation rejects malformed bodies, IDs, protected fields and literal search injection", async () => {
  for (const body of [
    { ...valid, teacherId: users.teacher2.id },
    { ...valid, studentIds: [] },
    { ...valid, status: "Invalid" },
    { ...valid, price: -2 },
    { ...valid, maxStudents: "2" },
    { ...valid, duration: 0 },
    { ...valid, topics: [] },
  ])
    assert.equal(
      (
        await request("/api/course", {
          method: "POST",
          cookie: users.teacher1.cookie,
          body,
        })
      ).status,
      400,
    );
  assert.equal(
    (await request("/api/course/invalid", { cookie: users.teacher1.cookie }))
      .status,
    400,
  );
  const raw = await fetch(base + "/api/course", {
    method: "POST",
    headers: {
      Cookie: users.teacher1.cookie,
      "Content-Type": "application/json",
    },
    body: "{",
  });
  assert.equal(raw.status, 400);
  const wrongType = await request("/api/course", {
    method: "POST",
    cookie: users.teacher1.cookie,
  });
  assert.equal(wrongType.status, 415);
  const search = await request("/api/course?q=" + encodeURIComponent(".*"), {
    cookie: users.student1.cookie,
  });
  assert.equal(search.status, 200);
  assert.equal(search.body.courses.length, 0);
});
test("course search, statuses, enrollment, roster privacy and non-empty deletion", async () => {
  const open = await create({ name: "Unique Searchable React" });
  const closed = await create({ status: "Close" });
  const cancelled = await create({ status: "Cancel" });
  const search = await request("/api/course?q=searchable", {
    cookie: users.student1.cookie,
  });
  assert.ok(search.body.courses.some((c) => c.id === open.id));
  const byTeacher = await request("/api/course?q=ACHER1", {
    cookie: users.student1.cookie,
  });
  assert.ok(byTeacher.body.courses.length);
  assert.ok(
    byTeacher.body.courses.every((c) => c.teacherId === users.teacher1.id),
  );
  const all = await request("/api/course", { cookie: users.student1.cookie });
  assert.ok(all.body.courses.some((c) => c.id === closed.id));
  assert.ok(!all.body.courses.some((c) => c.id === cancelled.id));
  assert.equal(
    (
      await request(`/api/course/${cancelled.id}`, {
        cookie: users.student1.cookie,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/course/${closed.id}/enroll`, {
        method: "POST",
        cookie: users.student1.cookie,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/api/course/${cancelled.id}/enroll`, {
        method: "POST",
        cookie: users.student1.cookie,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/course/${open.id}/enroll`, {
        method: "POST",
        cookie: users.student1.cookie,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request(`/api/course/${open.id}/enroll`, {
        method: "POST",
        cookie: users.student1.cookie,
      })
    ).status,
    409,
  );
  const roster = await request(`/api/course/${open.id}`, {
    cookie: users.teacher1.cookie,
  });
  assert.equal(roster.body.course.students[0].id, users.student1.id);
  assert.equal(roster.body.course.students[0].passwordHash, undefined);
  const studentView = await request(`/api/course/${open.id}`, {
    cookie: users.student2.cookie,
  });
  assert.equal(studentView.body.course.students, undefined);
  assert.equal(studentView.body.course.studentIds, undefined);
  const enrolled = await request("/api/course?enrolled=true", {
    cookie: users.student1.cookie,
  });
  assert.ok(enrolled.body.courses.some((c) => c.id === open.id));
  assert.equal(
    (
      await request(`/api/course/${open.id}`, {
        method: "DELETE",
        cookie: users.teacher1.cookie,
      })
    ).status,
    409,
  );
  await request(`/api/course/${open.id}`, {
    method: "PATCH",
    cookie: users.teacher1.cookie,
    body: { status: "Cancel" },
  });
  const hidden = await request("/api/course?enrolled=true", {
    cookie: users.student1.cookie,
  });
  assert.ok(!hidden.body.courses.some((c) => c.id === open.id));
});
test("concurrent enrollment cannot exceed capacity or duplicate a student", async () => {
  const one = await create({ maxStudents: 1 });
  const results = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      request(`/api/course/${one.id}/enroll`, {
        method: "POST",
        cookie: users[`student${(i % 3) + 1}`].cookie,
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.ok(results.every((r) => [201, 409].includes(r.status)));
  let doc = await db
    .collection("courses")
    .findOne({ _id: new ObjectId(one.id) });
  assert.equal(doc.studentIds.length, 1);
  const many = await create({ maxStudents: 100 });
  const duplicates = await Promise.all(
    Array.from({ length: 20 }, () =>
      request(`/api/course/${many.id}/enroll`, {
        method: "POST",
        cookie: users.student1.cookie,
      }),
    ),
  );
  assert.equal(duplicates.filter((r) => r.status === 201).length, 1);
  doc = await db.collection("courses").findOne({ _id: new ObjectId(many.id) });
  assert.equal(doc.studentIds.length, 1);
});
test("capacity changes, deletion and closing remain safe during enrollment races", async () => {
  const course = await create({ maxStudents: 2 });
  await request(`/api/course/${course.id}/enroll`, {
    method: "POST",
    cookie: users.student1.cookie,
  });
  await Promise.all([
    request(`/api/course/${course.id}/enroll`, {
      method: "POST",
      cookie: users.student2.cookie,
    }),
    request(`/api/course/${course.id}`, {
      method: "PATCH",
      cookie: users.teacher1.cookie,
      body: { maxStudents: 1 },
    }),
  ]);
  let doc = await db
    .collection("courses")
    .findOne({ _id: new ObjectId(course.id) });
  assert.ok(doc.studentIds.length <= doc.maxStudents);
  const full = await create({ maxStudents: 2 });
  await request(`/api/course/${full.id}/enroll`, {
    method: "POST",
    cookie: users.student1.cookie,
  });
  await request(`/api/course/${full.id}/enroll`, {
    method: "POST",
    cookie: users.student2.cookie,
  });
  assert.equal(
    (
      await request(`/api/course/${full.id}`, {
        method: "PATCH",
        cookie: users.teacher1.cookie,
        body: { maxStudents: 1 },
      })
    ).status,
    409,
  );
  const doomed = await create();
  const [enroll, remove] = await Promise.all([
    request(`/api/course/${doomed.id}/enroll`, {
      method: "POST",
      cookie: users.student1.cookie,
    }),
    request(`/api/course/${doomed.id}`, {
      method: "DELETE",
      cookie: users.teacher1.cookie,
    }),
  ]);
  assert.ok(
    (enroll.status === 201 && remove.status === 409) ||
      (enroll.status === 404 && remove.status === 200),
  );
  const closing = await create();
  await Promise.all([
    request(`/api/course/${closing.id}/enroll`, {
      method: "POST",
      cookie: users.student1.cookie,
    }),
    request(`/api/course/${closing.id}`, {
      method: "PATCH",
      cookie: users.teacher1.cookie,
      body: { status: "Close" },
    }),
  ]);
  doc = await db
    .collection("courses")
    .findOne({ _id: new ObjectId(closing.id) });
  assert.equal(doc.status, "Close");
  assert.equal(
    (
      await request(`/api/course/${closing.id}/enroll`, {
        method: "POST",
        cookie: users.student2.cookie,
      })
    ).status,
    409,
  );
});
test("CORS allows configured frontend, rejects others and supports unauthenticated preflight", async () => {
  const options = await request("/api/course", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.equal(options.status, 204);
  assert.equal(
    options.headers.get("access-control-allow-origin"),
    "http://localhost:5173",
  );
  assert.equal(
    (
      await request("/api/course", {
        cookie: users.student1.cookie,
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { login: "student1", password: "CourseDemo2026!" },
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(login.status, 403);
});
test("logout revokes the session even if its cookie is replayed", async () => {
  const result = await request("/api/auth/logout", {
    method: "POST",
    cookie: users.student3.cookie,
  });
  assert.equal(result.status, 200);
  assert.match(result.headers.get("set-cookie"), /Max-Age=0/i);
  assert.equal(
    (await request("/api/auth/me", { cookie: users.student3.cookie })).status,
    401,
  );
});
test("seed is idempotent and passwords are hashed", async () => {
  await seed(db);
  assert.equal(await db.collection("users").countDocuments(), 6);
  const user = await db.collection("users").findOne({ username: "student1" });
  assert.match(user.passwordHash, /^\$2b\$/);
  assert.equal(user.password, undefined);
});
