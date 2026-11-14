import { HttpError } from "../errors.js";

// Parses req.body with a zod schema and replaces it with the cleaned result.
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return next(new HttpError(400, details[0]?.message || "Invalid request", "VALIDATION", details));
  }
  req.body = result.data;
  next();
};
