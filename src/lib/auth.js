import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb.js";
import { ApiError } from "./utils.js";
export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 8,
});
function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error("JWT_SECRET must have at least 32 characters");
  return process.env.JWT_SECRET;
}
export function sessionHash(token) {
  return createHash("sha256").update(token).digest("hex");
}
export function verifyJWT(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return null;
    return jwt.verify(token, secret(), {
      algorithms: ["HS256"],
      issuer: "course-service",
      audience: "course-frontend",
    });
  } catch {
    return null;
  }
}
export function signJWT(id, sessionId) {
  return jwt.sign({ id: id.toString(), jti: sessionId }, secret(), {
    expiresIn: "8h",
    issuer: "course-service",
    audience: "course-frontend",
    algorithm: "HS256",
  });
}
export function publicUser(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
  };
}
export async function requireUser(req, role) {
  const payload = verifyJWT(req);
  if (!payload || !ObjectId.isValid(payload.id))
    throw new ApiError(401, "Please sign in");
  const db = await getDb();
  const session = await db
    .collection("sessions")
    .findOne({
      _id: sessionHash(req.cookies.get("token").value),
      expiresAt: { $gt: new Date() },
    });
  if (!session)
    throw new ApiError(401, "Your session has expired. Please sign in");
  const user = await db
    .collection("users")
    .findOne({ _id: new ObjectId(payload.id) });
  if (!user) throw new ApiError(401, "Please sign in");
  if (role && user.role !== role)
    throw new ApiError(403, `This action requires a ${role} account`);
  return user;
}
