# resume-builder-node

Node API for **Solve Resumé**: accounts and resume storage on MongoDB Atlas.

## Run it

```bash
npm install
cp .env.example .env     # then fill in MONGODB_URI and JWT_SECRET
npm run dev              # http://localhost:4000
npm test                 # integration tests (uses a throwaway database)
```

Atlas must allow your IP: **Atlas → Network Access → Add IP Address**.

## Environment

| Variable | Notes |
|---|---|
| `MONGODB_URI` | Atlas connection string. Keep it secret. |
| `MONGODB_DB` | Database name (default `resume_builder`). |
| `JWT_SECRET` | 32+ random characters (`openssl rand -hex 48`). |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API. |
| `TRUST_PROXY` | Number of proxies in front of the server (for rate limiting). |
| `PORT` | Default 4000. |

## API

All bodies are JSON. Errors look like `{ "error": { "message", "code", "details?" } }`.
The session is an httpOnly cookie (`sr_token`, 7 days).

| Method | Path | |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` → signs you in |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | current user |
| GET | `/api/files` | your resumes |
| POST | `/api/files` | create `{ name?, template?, font?, status?, data }` |
| POST | `/api/files/import` | create many `{ files: [...] }` |
| GET / PATCH / DELETE | `/api/files/:id` | read, partial update, delete |
| GET | `/health` | checks the database |

## Security notes

- Passwords are hashed with bcrypt (cost 12). Login errors never say which part was wrong.
- Every file query is scoped to the signed-in user.
- Request bodies are validated with zod; unknown fields are dropped, link URLs must be http(s).
- Limits: 256 KB per request, 50 files per user, 20 sign-in attempts / 15 min / IP.
- State-changing requests from an unlisted `Origin` are refused (CSRF).
- Set `NODE_ENV=production` in production so the cookie is `Secure`.
