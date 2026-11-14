import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { getDb } from "./db.js";
import { HttpError } from "./errors.js";
import { renderStatusPage } from "./statusPage.js";
import { checkOrigin } from "./middleware/origin.js";
import authRoutes from "./routes/auth.js";
import fileRoutes from "./routes/files.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  app.use(checkOrigin);

  app.get("/", async (_req, res) => {
    let dbOk = true;
    try {
      await getDb().command({ ping: 1 });
    } catch {
      dbOk = false;
    }
    res.status(dbOk ? 200 : 503).type("html").send(renderStatusPage({ dbOk, uptimeSeconds: process.uptime() }));
  });

  app.get("/health", async (_req, res) => {
    try {
      await getDb().command({ ping: 1 });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/files", fileRoutes);

  app.use((_req, _res, next) => next(new HttpError(404, "Not found", "NOT_FOUND")));

  // One JSON error shape for everything: { error: { message, code, details? } }
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed") err = new HttpError(400, "Invalid JSON", "BAD_JSON");
    if (err.type === "entity.too.large") err = new HttpError(413, "Request is too large", "TOO_LARGE");
    const status = err.status && err.status < 600 ? err.status : 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: {
        message: status >= 500 ? "Something went wrong" : err.message,
        code: err.code || "ERROR",
        ...(err.details ? { details: err.details } : {}),
      },
    });
  });

  return app;
}
