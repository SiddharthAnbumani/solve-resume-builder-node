import { config } from "../config.js";
import { HttpError } from "../errors.js";

// CSRF guard for cookie auth: browsers always send Origin on state-changing
// requests, so reject any that come from a site we don't recognise. Requests
// with no Origin (curl, server-to-server) can't be forged by a web page.
export function checkOrigin(req, _res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin && !config.corsOrigins.includes(origin)) {
    return next(new HttpError(403, "Origin not allowed", "BAD_ORIGIN"));
  }
  next();
}
