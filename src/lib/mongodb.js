import { MongoClient } from "mongodb";

export function getClientPromise() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  if (!globalThis.courseMongoPromise) {
    const client = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    globalThis.courseMongoPromise = client.connect().catch((error) => {
      globalThis.courseMongoPromise = undefined;
      throw error;
    });
  }
  return globalThis.courseMongoPromise;
}
export async function getDb() {
  return (await getClientPromise()).db(
    process.env.MONGODB_DB || "online_courses",
  );
}
