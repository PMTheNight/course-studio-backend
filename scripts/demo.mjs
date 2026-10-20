import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { seed } from "./seed.mjs";
// Disposable local demo only. Production always uses the configured persistent MongoDB.
const mongo = await MongoMemoryServer.create({
  binary: { downloadDir: "/tmp/course-mongodb-binaries" },
});
const client = await new MongoClient(mongo.getUri()).connect();
await seed(client.db("course_demo"));
await client.close();
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "-p",
    "3000",
    "-H",
    "127.0.0.1",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      MONGODB_URI: mongo.getUri(),
      MONGODB_DB: "course_demo",
      JWT_SECRET: randomBytes(32).toString("hex"),
      FRONTEND_ORIGINS: "http://localhost:5173,http://127.0.0.1:5173",
      NEXT_TELEMETRY_DISABLED: "1",
      WATCHPACK_POLLING: "true",
    },
  },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.kill("SIGTERM");
  await mongo.stop();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", async (code) => {
  await stop();
  process.exitCode = code || 0;
});
console.log(
  "Disposable demo database seeded. Start the React frontend separately. Login: student1 / CourseDemo2026! (or teacher1).",
);
