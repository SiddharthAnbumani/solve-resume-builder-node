import { Router } from "express";
import { ObjectId } from "mongodb";
import { config } from "../config.js";
import { getDb } from "../db.js";
import { HttpError, notFound } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { fileCreateSchema, filePatchSchema, importSchema } from "../schemas.js";

const router = Router();
router.use(requireAuth);

const files = () => getDb().collection("files");

// What the browser sees: a string id and millisecond timestamps.
const toClient = (f) => ({
  id: f._id.toString(),
  name: f.name,
  template: f.template,
  font: f.font,
  status: f.status,
  data: f.data,
  createdAt: f.createdAt.getTime(),
  updatedAt: f.updatedAt.getTime(),
});

// Every query is scoped to the signed-in user, so one account can never read
// or change another's files, even with a valid id.
const mine = (req, id) => {
  if (!ObjectId.isValid(id)) throw notFound("File");
  return { _id: new ObjectId(id), ownerId: req.userId };
};

async function remainingQuota(req) {
  const used = await files().countDocuments({ ownerId: req.userId });
  return Math.max(0, config.maxFilesPerUser - used);
}

const limitError = () =>
  new HttpError(
    403,
    `You can keep up to ${config.maxFilesPerUser} files. Delete one to make room.`,
    "FILE_LIMIT"
  );

router.get("/", async (req, res, next) => {
  try {
    const list = await files().find({ ownerId: req.userId }).sort({ updatedAt: -1 }).limit(config.maxFilesPerUser).toArray();
    res.json({ files: list.map(toClient) });
  } catch (err) {
    next(err);
  }
});

router.post("/", validate(fileCreateSchema), async (req, res, next) => {
  try {
    if ((await remainingQuota(req)) < 1) throw limitError();
    const now = new Date();
    const doc = { ...req.body, ownerId: req.userId, createdAt: now, updatedAt: now };
    const { insertedId } = await files().insertOne(doc);
    res.status(201).json({ file: toClient({ ...doc, _id: insertedId }) });
  } catch (err) {
    next(err);
  }
});

// Bulk create, used to move a browser's local files into the account.
router.post("/import", validate(importSchema), async (req, res, next) => {
  try {
    const room = await remainingQuota(req);
    if (room < 1) throw limitError();
    const now = Date.now();
    const incoming = req.body.files.slice(0, room);
    const docs = incoming.map((f, i) => ({
      ...f,
      ownerId: req.userId,
      createdAt: new Date(now - i), // keeps the original order when sorted by updatedAt
      updatedAt: new Date(now - i),
    }));
    const { insertedIds } = await files().insertMany(docs);
    const created = docs.map((d, i) => toClient({ ...d, _id: insertedIds[i] }));
    res.status(201).json({ files: created, skipped: req.body.files.length - created.length });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const doc = await files().findOne(mine(req, req.params.id));
    if (!doc) throw notFound("File");
    res.json({ file: toClient(doc) });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", validate(filePatchSchema), async (req, res, next) => {
  try {
    const doc = await files().findOneAndUpdate(
      mine(req, req.params.id),
      { $set: { ...req.body, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!doc) throw notFound("File");
    res.json({ file: toClient(doc) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { deletedCount } = await files().deleteOne(mine(req, req.params.id));
    if (!deletedCount) throw notFound("File");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
