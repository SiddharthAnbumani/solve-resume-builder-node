// A small status page for GET /, so opening the API's address in a browser
// shows something useful. It contains nothing secret: no config, no data.

const ENDPOINTS = [
  ["POST", "/api/auth/register", "Create an account"],
  ["POST", "/api/auth/login", "Sign in"],
  ["POST", "/api/auth/logout", "Sign out"],
  ["GET", "/api/auth/me", "Current user"],
  ["GET", "/api/files", "List your resumes"],
  ["POST", "/api/files", "Create a resume"],
  ["POST", "/api/files/import", "Create several resumes"],
  ["GET", "/api/files/:id", "Read a resume"],
  ["PATCH", "/api/files/:id", "Update a resume"],
  ["DELETE", "/api/files/:id", "Delete a resume"],
  ["GET", "/health", "Health check"],
];

export function renderStatusPage({ dbOk, uptimeSeconds }) {
  const up = uptimeSeconds < 120 ? "just started" : uptimeSeconds < 7200 ? `${Math.round(uptimeSeconds / 60)} min` : `${Math.round(uptimeSeconds / 3600)} hr`;
  const rows = ENDPOINTS.map(
    ([m, p, d]) =>
      `<li><span class="m ${m.toLowerCase()}">${m}</span><code>${p}</code><span class="d">${d}</span></li>`
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#000000">
<title>Solve Resumé API</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap">
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#000;color:#fff;font-family:Montserrat,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  header{padding:28px 20px 0;text-align:center}
  .logo{font-weight:500;font-size:1.5rem;letter-spacing:.1em}
  .hero{padding:36px 20px 44px;text-align:center}
  h1{margin:18px 0 8px;font-size:1.9rem;line-height:1.15;font-weight:600;letter-spacing:-.02em}
  .sub{margin:0 auto;max-width:30rem;color:rgba(255,255,255,.62);line-height:1.6}
  .pill{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:6px 14px;font-size:.8rem;color:rgba(255,255,255,.85)}
  .dot{width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 0 4px rgba(16,185,129,.2)}
  .dot.bad{background:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.2)}
  .stats{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:22px}
  .stat{border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:10px 18px;min-width:120px}
  .stat b{display:block;font-size:.7rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.5)}
  .stat span{font-size:.95rem}
  main{background:#fff;color:#18181b;border-radius:2rem 2rem 0 0;padding:32px 20px 40px;min-height:50vh}
  .wrap{max-width:46rem;margin:0 auto}
  h2{margin:0 0 4px;font-size:1.15rem;font-weight:600;text-align:center}
  .note{margin:0 0 22px;color:#71717a;font-size:.85rem;text-align:center}
  ul{list-style:none;margin:0;padding:0;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden}
  li{display:grid;grid-template-columns:64px 1fr;gap:4px 12px;align-items:center;padding:12px 14px;border-top:1px solid #e4e4e7}
  li:first-child{border-top:0}
  .m{font-size:.68rem;font-weight:600;text-align:center;border-radius:6px;padding:4px 0}
  .get{background:#dbeafe;color:#1d4ed8}.post{background:#d1fae5;color:#047857}.patch{background:#fef3c7;color:#b45309}.delete{background:#ffe4e6;color:#be123c}
  code{font-size:.82rem;word-break:break-all}
  .d{grid-column:2;color:#71717a;font-size:.8rem}
  footer{padding:20px;text-align:center;font-size:.75rem;color:#a1a1aa;background:#fff}
  @media(min-width:640px){h1{font-size:2.6rem}li{grid-template-columns:70px 15rem 1fr}.d{grid-column:auto}}
</style>
</head>
<body>
<header><div class="logo">Solve</div></header>
<section class="hero">
  <span class="pill"><i class="dot ${dbOk ? "" : "bad"}"></i>${dbOk ? "All systems operational" : "Database unreachable"}</span>
  <h1>Solve Resumé API</h1>
  <p class="sub">The service behind Solve Resumé: accounts and resume storage. This address is for the app, not for browsing.</p>
  <div class="stats">
    <div class="stat"><b>Database</b><span>${dbOk ? "Connected" : "Down"}</span></div>
    <div class="stat"><b>Uptime</b><span>${up}</span></div>
  </div>
</section>
<main>
  <div class="wrap">
    <h2>Endpoints</h2>
    <p class="note">Everything except sign-in, sign-up and health needs a signed-in session.</p>
    <ul>${rows}</ul>
  </div>
</main>
<footer>Solve Resumé · <a href="/health" style="color:inherit">/health</a></footer>
</body>
</html>`;
}
