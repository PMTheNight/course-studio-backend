import bcrypt from "bcrypt";
import { randomUUID, createHash } from "node:crypto";
import { getDb } from "@/lib/mongodb";
import { cookieOptions, publicUser, signJWT, sessionHash } from "@/lib/auth";
import { handler, readJson, successResponse, ApiError } from "@/lib/utils";
export const POST = handler(async (request) => {
  const { login, password } = await readJson(request);
  if (
    typeof login !== "string" ||
    !login.trim() ||
    login.length > 254 ||
    typeof password !== "string" ||
    !password ||
    Buffer.byteLength(password) > 72
  )
    throw new ApiError(400, "Enter a valid username/email and password");
  const key = login.trim().toLowerCase();
  const db = await getDb();
  const window = Math.floor(Date.now() / 900000);
  const bucket = createHash("sha256").update(`${key}:${window}`).digest("hex");
  const attempts = await db
    .collection("loginAttempts")
    .findOneAndUpdate(
      { _id: bucket },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((window + 1) * 900000) },
      },
      { upsert: true, returnDocument: "after" },
    );
  if (attempts.count > 30)
    throw new ApiError(
      429,
      "Too many sign-in attempts. Try again in 15 minutes",
    );
  const user = await db
    .collection("users")
    .findOne({ $or: [{ username: key }, { email: key }] });
  const hash =
    user?.passwordHash ||
    "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
  const matches = await bcrypt.compare(password, hash);
  if (!user || !matches)
    throw new ApiError(401, "Invalid username/email or password");
  const token = signJWT(user._id, randomUUID());
  await db
    .collection("sessions")
    .insertOne({
      _id: sessionHash(token),
      userId: user._id,
      expiresAt: new Date(Date.now() + 8 * 3600000),
    });
  const response = successResponse({ user: publicUser(user) }, 200, request);
  response.cookies.set("token", token, cookieOptions());
  return response;
});
