export class HttpError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`, "NOT_FOUND");
