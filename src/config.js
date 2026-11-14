import "dotenv/config";

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return v;
}

const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters. Try: openssl rand -hex 48");
  process.exit(1);
}

export const config = {
  env: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT) || 4000,
  mongoUri: required("MONGODB_URI"),
  dbName: process.env.MONGODB_DB || "resume_builder",
  jwtSecret,
  tokenTtlDays: 7,
  cookieName: "sr_token",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // Which proxies to trust for client IPs (rate limiting). A hop count or
  // "loopback". Set to the number of proxies in front of this server.
  trustProxy: process.env.TRUST_PROXY || "loopback",
  maxFilesPerUser: 50,
};
