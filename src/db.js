import { MongoClient } from "mongodb";
import { config } from "./config.js";

let client;
let db;

export async function connectDb() {
  if (db) return db;
  client = new MongoClient(config.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });
  await client.connect();
  db = client.db(config.dbName);

  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("files").createIndex({ ownerId: 1, updatedAt: -1 });
  return db;
}

export const getDb = () => {
  if (!db) throw new Error("Database not connected");
  return db;
};

export async function closeDb() {
  await client?.close();
  client = undefined;
  db = undefined;
}
