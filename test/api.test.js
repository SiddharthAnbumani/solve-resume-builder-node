// Integration tests. They run against a separate database so real data is
// never touched; the database is dropped at the end.
process.env.MONGODB_DB = "resume_builder_test";

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

const { createApp } = await import("../src/app.js");
const { closeDb, connectDb, getDb } = await import("../src/db.js");
const { config } = await import("../src/config.js");

let server;
let base;

// A tiny fetch wrapper that keeps cookies, like a browser would.
function client() {
  let cookie = "";
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      cookie = pair.endsWith("=") ? "" : pair;
    }
    const text = await res.text();
    return { status: res.status, headers: res.headers, set, body: text ? JSON.parse(text) : null };
  };
  return {
    get: (p) => call("GET", p),
    post: (p, b, h) => call("POST", p, b, h),
    patch: (p, b) => call("PATCH", p, b),
    del: (p) => call("DELETE", p),
  };
}

const sampleData = () => ({
  basics: { name: "Alex Morgan", phone: "123", location: "City", email: "a@b.co", links: [] },
  summary: { title: "Summary", visible: true, text: "Hello" },
  education: { title: "Education", visible: true, items: [] },
  skills: { title: "Skills", visible: true, items: [] },
  experience: { title: "Experience", visible: true, items: [] },
  projects: { title: "Projects", visible: true, items: [] },
});

const newUser = (tag) => ({
  name: `Test ${tag}`,
  email: `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`,
  password: "Sup3r-secret!",
});

before(async () => {
  await connectDb();
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  try {
    await getDb().dropDatabase();
  } catch {
    await getDb().collection("users").deleteMany({});
    await getDb().collection("files").deleteMany({});
  }
  await closeDb();
});

describe("auth", () => {
  test("register validates input", async () => {
    const c = client();
    let r = await c.post("/api/auth/register", { name: "", email: "nope", password: "short" });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, "VALIDATION");
    r = await c.post("/api/auth/register", { name: "A", email: "a@b.co", password: "short" });
    assert.equal(r.status, 400);
  });

  test("register signs you in with an httpOnly cookie, and never returns the hash", async () => {
    const c = client();
    const u = newUser("reg");
    const r = await c.post("/api/auth/register", u);
    assert.equal(r.status, 201);
    assert.equal(r.body.user.email, u.email);
    assert.ok(!JSON.stringify(r.body).toLowerCase().includes("hash"));
    assert.ok(r.set.some((s) => s.startsWith(`${config.cookieName}=`) && /httponly/i.test(s) && /samesite=lax/i.test(s)));
    const me = await c.get("/api/auth/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.user.name, u.name);
  });

  test("duplicate email is rejected, case-insensitively", async () => {
    const u = newUser("dup");
    assert.equal((await client().post("/api/auth/register", u)).status, 201);
    const r = await client().post("/api/auth/register", { ...u, email: u.email.toUpperCase() });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, "EMAIL_TAKEN");
  });

  test("login: wrong password and unknown email give the same answer", async () => {
    const u = newUser("login");
    await client().post("/api/auth/register", u);
    const wrong = await client().post("/api/auth/login", { email: u.email, password: "Wrong-pass1" });
    const unknown = await client().post("/api/auth/login", { email: "nobody@example.com", password: "Wrong-pass1" });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error.message, unknown.body.error.message);
    const ok = await client().post("/api/auth/login", { email: u.email.toUpperCase(), password: u.password });
    assert.equal(ok.status, 200);
  });

  test("logout clears the session", async () => {
    const c = client();
    await c.post("/api/auth/register", newUser("out"));
    assert.equal((await c.get("/api/auth/me")).status, 200);
    assert.equal((await c.post("/api/auth/logout", {})).status, 200);
    assert.equal((await c.get("/api/auth/me")).status, 401);
  });

  test("a tampered token is rejected", async () => {
    const r = await fetch(`${base}/api/auth/me`, { headers: { cookie: `${config.cookieName}=abc.def.ghi` } });
    assert.equal(r.status, 401);
  });
});

describe("files", () => {
  test("every route needs a session", async () => {
    const c = client();
    assert.equal((await c.get("/api/files")).status, 401);
    assert.equal((await c.post("/api/files", { data: sampleData() })).status, 401);
    assert.equal((await c.del("/api/files/abc")).status, 401);
  });

  test("create, list, get, update, delete", async () => {
    const c = client();
    await c.post("/api/auth/register", newUser("crud"));

    const created = await c.post("/api/files", { name: "My CV", template: "modern", data: sampleData() });
    assert.equal(created.status, 201);
    const { id } = created.body.file;
    assert.equal(created.body.file.status, "draft");
    assert.equal(created.body.file.font, "default");

    const list = await c.get("/api/files");
    assert.equal(list.body.files.length, 1);
    assert.equal(list.body.files[0].id, id);

    const got = await c.get(`/api/files/${id}`);
    assert.equal(got.body.file.name, "My CV");

    const before = got.body.file.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const patched = await c.patch(`/api/files/${id}`, { status: "finished", font: "inter" });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.file.status, "finished");
    assert.equal(patched.body.file.name, "My CV"); // untouched fields stay
    assert.ok(patched.body.file.updatedAt > before);

    assert.equal((await c.del(`/api/files/${id}`)).status, 204);
    assert.equal((await c.get(`/api/files/${id}`)).status, 404);
    assert.equal((await c.del(`/api/files/${id}`)).status, 404);
  });

  test("one user cannot see, change or delete another user's file", async () => {
    const a = client();
    const b = client();
    await a.post("/api/auth/register", newUser("owner"));
    await b.post("/api/auth/register", newUser("intruder"));
    const { id } = (await a.post("/api/files", { data: sampleData() })).body.file;

    assert.equal((await b.get(`/api/files/${id}`)).status, 404);
    assert.equal((await b.patch(`/api/files/${id}`, { name: "hacked" })).status, 404);
    assert.equal((await b.del(`/api/files/${id}`)).status, 404);
    assert.equal((await b.get("/api/files")).body.files.length, 0);
    assert.equal((await a.get(`/api/files/${id}`)).body.file.name, "Untitled resume");
  });

  test("validation: bad values are rejected, unknown keys dropped", async () => {
    const c = client();
    await c.post("/api/auth/register", newUser("val"));
    assert.equal((await c.post("/api/files", { template: "fancy", data: sampleData() })).status, 400);
    assert.equal((await c.post("/api/files", { name: "x" })).status, 400); // data missing
    assert.equal((await c.get("/api/files/not-an-id")).status, 404);

    const withExtra = { ...sampleData(), evil: "x" };
    withExtra.basics.admin = true;
    const r = await c.post("/api/files", { data: withExtra, ownerId: "someone-else", $set: { x: 1 } });
    assert.equal(r.status, 201);
    assert.equal(r.body.file.data.evil, undefined);
    assert.equal(r.body.file.data.basics.admin, undefined);
  });

  test("links: unsafe schemes are dropped and bare domains get https", async () => {
    const c = client();
    await c.post("/api/auth/register", newUser("links"));
    const data = sampleData();
    data.basics.links = [
      { id: "1", label: "Bad", url: "javascript:alert(1)" },
      { id: "2", label: "Data", url: "data:text/html,x" },
      { id: "3", label: "Bare", url: "github.com/me" },
      { id: "4", label: "Ok", url: "https://example.com/x" },
    ];
    const r = await c.post("/api/files", { data });
    assert.deepEqual(
      r.body.file.data.basics.links.map((l) => l.url),
      ["", "", "https://github.com/me", "https://example.com/x"]
    );
  });

  test("oversized bodies are refused", async () => {
    const c = client();
    await c.post("/api/auth/register", newUser("big"));
    const data = sampleData();
    data.summary.text = "x".repeat(300_000);
    assert.equal((await c.post("/api/files", { data })).status, 413);
  });

  test("a request from an unknown origin is refused", async () => {
    const c = client();
    await c.post("/api/auth/register", newUser("csrf"));
    const r = await c.post("/api/files", { data: sampleData() }, { origin: "https://evil.example" });
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, "BAD_ORIGIN");
    const ok = await c.post("/api/files", { data: sampleData() }, { origin: config.corsOrigins[0] });
    assert.equal(ok.status, 201);
  });

  test("import adds several files and respects the per-user limit", async () => {
    const c = client();
    await c.post("/api/auth/register", newUser("imp"));
    const mk = (i) => ({ name: `File ${i}`, data: sampleData() });

    const first = await c.post("/api/files/import", { files: [mk(1), mk(2), mk(3)] });
    assert.equal(first.status, 201);
    assert.equal(first.body.files.length, 3);

    const fill = await c.post("/api/files/import", { files: Array.from({ length: 47 }, (_, i) => mk(i + 4)) });
    assert.equal(fill.body.files.length, 47);

    const over = await c.post("/api/files/import", { files: [mk(100), mk(101)] });
    assert.equal(over.status, 403);
    assert.equal(over.body.error.code, "FILE_LIMIT");
    assert.equal((await c.post("/api/files", { data: sampleData() })).status, 403);
  });
});

describe("misc", () => {
  test("health, unknown routes and bad JSON use the standard error shape", async () => {
    assert.equal((await client().get("/health")).body.ok, true);
    const nf = await client().get("/api/nope");
    assert.equal(nf.status, 404);
    assert.equal(nf.body.error.code, "NOT_FOUND");
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, "BAD_JSON");
  });
});
