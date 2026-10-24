# Reverse-Engineering Workspace — gpc.merlinbrands.in

Target: your own app at `https://gpc.merlinbrands.in` (login → `/funnel`).

## How this works (and why)

This Claude session runs in a locked-down cloud container. It **cannot reach
`gpc.merlinbrands.in`** — the network proxy refuses the connection (`403`). It
also should **never** be handed your real credentials. So the workflow is:

- **You capture** the data in your own browser (a few minutes, steps below).
- **You drop** the (sanitized) files into `captures/`.
- **Claude analyzes** them and writes the deliverables into `outputs/`.

Everything below is legitimate because the app is **yours**. The same steps on
someone else's app without written permission would not be.

---

## ⚠️ Read before you commit anything

A captured network session (HAR file) contains **live secrets**: your session
cookie, any `Authorization: Bearer` token, and your password in plaintext inside
the login request body. **Do not commit a raw HAR to git.** Before a HAR enters
`captures/`, redact these:

- Request/response header `Cookie` and `Set-Cookie`
- Header `Authorization`
- The **login POST body** (the field holding your password)
- Any `token`, `apiKey`, `secret`, `refresh_token` values

If you'd rather not redact by hand, paste the relevant slice into chat and ask
Claude to redact it — but assume anything you paste into chat is logged, so
redact the password at least. (And since the password was already shared once,
rotate it.)

`.gitignore` in this folder keeps `*.har` out of commits by default.

---

## Capture steps

### A. Tech-stack fingerprint (for Goal 2)
1. Install the **Wappalyzer** browser extension, open the site, click the icon →
   screenshot or copy the detected stack into `captures/stack-wappalyzer.txt`.
2. DevTools (F12) → **Network** → reload the login page → click the top (document)
   request → **Headers** tab → copy all **Response Headers** into
   `captures/headers.txt`. (Cookie *names* and `Server`/`X-Powered-By` reveal the
   backend.)

### B. Page source — for the UI rebuild (Goal 3)
1. On the login page: right-click → **View Page Source** → save as
   `captures/login.html`.
2. Log in (in your own browser), land on `/funnel`, then DevTools → **Elements** →
   right-click `<html>` → **Copy → Copy outerHTML** → save as
   `captures/funnel.html`. (This is the rendered DOM, best for a framework app.)
3. DevTools → **Sources** → download the main CSS file(s) and the main JS bundle
   if you want pixel-accurate styling; drop them in `captures/`.

### C. API map + auth flow — for API mapping + audit (Goals 2 & 4)
1. DevTools → **Network** → check **Preserve log** → filter **Fetch/XHR**.
2. Start recording, then **drive the app**: log in, open `/funnel`, click the main
   features once each.
3. Right-click anywhere in the request list → **Save all as HAR with content** →
   save as `captures/session.har`.
4. **Sanitize it** (see warning above) before moving it into `captures/`.

---

## What Claude will deliver (into `outputs/`)

**Goal 2 — Map the stack & API**
- `outputs/tech-stack.md` — frontend framework, backend, server, hosting, auth
  mechanism, inferred from headers/cookies/bundle signatures.
- `outputs/api-map.md` — every observed endpoint: method, path, request shape,
  response shape, status codes, auth required.
- `outputs/openapi.yaml` — a draft OpenAPI 3 spec you can import into Postman.
- `outputs/architecture.md` — a diagram (Mermaid) of client → API → data flow.

**Goal 3 — Rebuild / clone the UI**
- A runnable reconstruction of the login + funnel UI (plain HTML/CSS/JS or a
  framework matching the original) under `outputs/clone/`, driven off `login.html`
  / `funnel.html` and the captured styles. Static first; wired to a mock API next.

**Goal 4 — Security audit (your own app)**
- `outputs/security-review.md` — findings on the auth flow, the `next=` open-redirect
  risk, cookie flags (HttpOnly/Secure/SameSite), CSRF protection, token handling,
  headers (CSP/HSTS/etc.), and any auth/IDOR issues visible in the HAR. Severity-
  ranked, with concrete fixes. Non-destructive: analysis of what you captured, not
  live attacks.

---

## Status

- [ ] `captures/headers.txt`
- [ ] `captures/stack-wappalyzer.txt`
- [ ] `captures/login.html`
- [ ] `captures/funnel.html`
- [ ] `captures/session.har` (sanitized)
- [ ] Goal 2 deliverables
- [ ] Goal 3 deliverables
- [ ] Goal 4 deliverables
