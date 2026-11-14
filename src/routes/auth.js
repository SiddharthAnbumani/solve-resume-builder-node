import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { ObjectId } from "mongodb";
import { config } from "../config.js";
import { getDb } from "../db.js";
import { HttpError } from "../errors.js";
import { cookieOptions, requireAuth, setSessionCookie } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../schemas.js";

const router = Router();

const BCRYPT_COST = 12;
// Compared against when the email is unknown, so "no such user" and "wrong
// password" take about the same time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);

// 20 sign-in / sign-up attempts per 15 minutes per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new HttpError(429, "Too many attempts. Try again in a few minutes.", "RATE_LIMITED")),
});

const publicUser = (u) => ({ id: u._id.toString(), name: u.name, email: u.email });

router.post("/register", authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const doc = {
      name,
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      createdAt: new Date(),
    };
    try {
      const { insertedId } = await getDb().collection("users").insertOne(doc);
      doc._id = insertedId;
    } catch (err) {
      if (err.code === 11000) {
        throw new HttpError(409, "An account with this email already exists", "EMAIL_TAKEN");
      }
      throw err;
    }
    setSessionCookie(res, doc._id.toString());
    res.status(201).json({ user: publicUser(doc) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await getDb().collection("users").findOne({ email });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }
    setSessionCookie(res, user._id.toString());
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie(config.cookieName, cookieOptions());
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = ObjectId.isValid(req.userId)
      ? await getDb().collection("users").findOne({ _id: new ObjectId(req.userId) })
      : null;
    if (!user) throw new HttpError(401, "Please sign in", "UNAUTHENTICATED");
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
