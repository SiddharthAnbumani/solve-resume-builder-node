import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { HttpError } from "../errors.js";

export function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: `${config.tokenTtlDays}d`,
  });
}

export const cookieOptions = () => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: "lax",
  path: "/",
});

export function setSessionCookie(res, userId) {
  res.cookie(config.cookieName, signToken(userId), {
    ...cookieOptions(),
    maxAge: config.tokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function requireAuth(req, _res, next) {
  const token = req.cookies?.[config.cookieName];
  if (!token) return next(new HttpError(401, "Please sign in", "UNAUTHENTICATED"));
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
    req.userId = payload.sub;
    next();
  } catch {
    next(new HttpError(401, "Your session has expired. Please sign in again.", "UNAUTHENTICATED"));
  }
}
