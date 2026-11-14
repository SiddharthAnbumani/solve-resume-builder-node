import { config } from "./config.js";
import { closeDb, connectDb } from "./db.js";
import { createApp } from "./app.js";

try {
  await connectDb();
} catch (err) {
  console.error("Could not connect to MongoDB:", err.message);
  console.error("Check MONGODB_URI, and that your IP is allowed in Atlas → Network Access.");
  process.exit(1);
}

const server = createApp().listen(config.port, () => {
  console.log(`resume-builder-node listening on http://localhost:${config.port} (${config.env})`);
});

const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
