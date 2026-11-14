import { z } from "zod";

export const TEMPLATES = ["classic", "modern", "compact", "minimal", "serif", "mono", "quiet", "bar"];
export const FONTS = ["default", "montserrat", "inter", "arial"];
export const STATUSES = ["draft", "finished"];

// ── Auth ────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

// ── Resume data ─────────────────────────────────────────────────────────
const short = (n = 300) => z.string().max(n).default("");
const long = z.string().max(4000).default("");
const id = z.string().max(40).default(() => Math.random().toString(36).slice(2, 10));

// Links must be http(s). Anything with another scheme (javascript:, data:) is
// dropped, and a bare "github.com/x" gets https:// added.
const url = z
  .string()
  .max(500)
  .default("")
  .transform((v) => {
    v = v.trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return "";
    return `https://${v}`;
  });

const section = (item) =>
  z.object({
    title: short(100),
    visible: z.boolean().default(true),
    items: z.array(item).max(30).default([]),
  });

export const resumeDataSchema = z.object({
  basics: z.object({
    name: short(100),
    phone: short(60),
    location: short(120),
    email: short(254),
    links: z
      .array(z.object({ id, label: short(60), url }))
      .max(10)
      .default([]),
  }),
  summary: z.object({
    title: short(100),
    visible: z.boolean().default(true),
    text: long,
  }),
  education: section(
    z.object({
      id,
      institution: short(),
      location: short(),
      date: short(60),
      degree: short(),
      gpaLabel: short(60),
      gpa: short(60),
    })
  ),
  skills: section(z.object({ id, title: short(), text: long })),
  experience: section(
    z.object({
      id,
      role: short(),
      company: short(),
      location: short(),
      date: short(60),
      text: long,
    })
  ),
  projects: section(z.object({ id, name: short(), text: long })),
});

// ── Files ───────────────────────────────────────────────────────────────
export const fileCreateSchema = z.object({
  name: z.string().trim().min(1).max(100).default("Untitled resume"),
  template: z.enum(TEMPLATES).default("classic"),
  font: z.enum(FONTS).default("default"),
  status: z.enum(STATUSES).default("draft"),
  data: resumeDataSchema,
});

export const filePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    template: z.enum(TEMPLATES),
    font: z.enum(FONTS),
    status: z.enum(STATUSES),
    data: resumeDataSchema,
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Nothing to update");

export const importSchema = z.object({
  files: z.array(fileCreateSchema).min(1).max(50),
});
