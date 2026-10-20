import bcrypt from "bcrypt";
import { MongoClient } from "mongodb";
import { ensureIndexes } from "../src/models/user.js";
export async function seed(db) {
  await ensureIndexes(db);
  const passwordHash = await bcrypt.hash("CourseDemo2026!", 12);
  for (const role of ["Student", "Teacher"]) {
    for (let i = 1; i <= 3; i++) {
      const username = `${role.toLowerCase()}${i}`;
      await db
        .collection("users")
        .updateOne(
          { username },
          {
            $setOnInsert: {
              username,
              email: `${username}@example.com`,
              role,
              passwordHash,
              createdAt: new Date(),
            },
          },
          { upsert: true },
        );
    }
  }
  const names = [
    "Modern Web Development",
    "Designing Digital Experiences",
    "Practical Data Analysis",
  ];
  for (let i = 1; i <= 3; i++) {
    const teacher = await db
      .collection("users")
      .findOne({ username: `teacher${i}` });
    await db.collection("courses").updateOne(
      { seedKey: `demo-${i}` },
      {
        $setOnInsert: {
          seedKey: `demo-${i}`,
          name: names[i - 1],
          duration: 10 + i * 5,
          topics: [
            ["React", "Next.js", "MongoDB"],
            ["Research", "Prototyping", "Accessibility"],
            ["Python", "Statistics", "Visualization"],
          ][i - 1],
          price: 99 + i * 50,
          maxStudents: 12,
          status: i === 3 ? "Close" : "Open",
          teacherId: teacher._id,
          studentIds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }
}
if (process.argv[1]?.endsWith("seed.mjs")) {
  if (!process.env.MONGODB_URI)
    throw new Error("Set MONGODB_URI before seeding");
  const client = await new MongoClient(process.env.MONGODB_URI).connect();
  try {
    await seed(client.db(process.env.MONGODB_DB || "online_courses"));
    console.log(
      "Seeded 3 students, 3 teachers and 3 sample courses; existing records preserved.",
    );
  } finally {
    await client.close();
  }
}
