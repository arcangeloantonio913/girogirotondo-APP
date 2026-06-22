# SECURITY-AUDIT.md — Girogirotondo

**Phase 1 (AUDIT) — read-only findings report. No code was modified to produce this document.**

- **Date:** 2026-06-22
- **Scope:** `backend/` (Python/FastAPI + MongoDB), `frontend/` (React CRA web app + Next.js marketing site), `mobile/` (Expo React Native), root recovery scripts, build/config, store & privacy copy.
- **Method:** Multi-agent fan-out across audit areas A–J, each Critical/High finding re-read and adversarially verified (54 Critical/High findings → 34 confirmed, 20 re-rated, **0 false positives**). The auditor (me) additionally read the core security files directly (`main.py`, `middleware/auth.py`, `routers/auth.py`, `routers/gallery.py`, `routers/diary.py`, `routers/griglia.py`, `services/database.py`, `utils/storage_helper.py`) to confirm the highest-severity items first-hand.
- **Top-severity lens (as instructed):** cross-tenant leakage (one school seeing the other's data) and unauthorized access to a specific child's data (IDOR) — these are CRITICAL regardless of fix size.

> ⚠️ **Doc vs. reality:** `GIROGIROTONDO.md` describes a "Node backend" — the backend is actually **Python/FastAPI**. The web app is **React CRA** (`frontend/src`) plus a separate **Next.js** marketing site, not `react-native-web` (that removal is confirmed clean). Treat the code as ground truth.

---

## 1. Severity summary

| Severity | Count (deduplicated) | Raw findings before dedup |
|---|---|---|
| 🔴 Critical | 17 | 30 |
| 🟠 High | 13 | 24 |
| 🟡 Medium | 21 | 30 |
| ⚪ Low | 18 | 21 |

The single most important structural problem is **#C1: tenant isolation is enforced inconsistently.** The middleware *has* correct primitives (`validate_admin_sede_access`, `get_teacher_sede_id`) and some routers use them well (`classes`, `students`, `meals`, `avvisi` GET), but ~8 high-traffic routers handling minors' data do **not** apply any `sede` filter and trust a client-supplied `class_id`/`student_id`/`parent_id`. A teacher/admin of one school can read or write the other school's photos, diaries, meal grids, attendance, documents, calendar and appointments — and a parent can reach other families' data via several IDOR holes.

---

## 2. 🔴 CRITICAL findings

| ID | Area | File : line | Issue | Recommended fix | Fix type |
|---|---|---|---|---|---|
| **C1** | Tenant (C) | `backend/routers/gallery.py:49`, `diary.py:53`, `griglia.py:47`, `documents.py:34`, `calendar.py:15`, `appointments.py:26`, `presenze.py:105`, `notifications.py:70` | **Cross-tenant isolation broken for staff roles (systemic).** These routers never filter by `sede_id`. A teacher/admin authenticated for one school can pass the *other* school's `class_id`/`student_id` — or omit the filter entirely — and read/write the other school's children's data. Parent-role isolation *is* implemented; staff-role isolation is not. The documented `get_teacher_sede_id()` protection exists but is **not wired into these routers**. | Introduce a shared dependency that resolves the caller's allowed `sede_id`(s) and assigned `class_ids`, then scope **every** query by `sede_id` and verify class/student membership server-side. Add a regression test per role × sede. | needs-confirmation |
| **C2** | IDOR (D) | `backend/routers/gallery.py:95` | **`GET /api/gallery/{media_id}` has no ownership check** — any authenticated user (incl. a parent) can fetch any child's photo/video by id and receives a fresh signed URL. Defeats the per-child isolation the list endpoint enforces. | Reuse the parent/staff authorization used by `get_gallery`: verify the caller owns the child(ren) in `student_ids` (parent) or shares the `sede`/class (staff) before returning. | needs-confirmation |
| **C3** | IDOR (D) | `backend/routers/users.py:143` | **Privilege escalation via `PUT /api/users/{user_id}`** — no field whitelist, so a parent can self-assign arbitrary `child_ids`/`sede_id`/`class_ids`, attach another family's child to their account, and then read that child's entire media/diary/griglia set. | Whitelist editable fields per role; never allow self-edit of `child_ids`/`sede_id`/`class_ids`/`role`/`is_superadmin`. Enforce that the target user is the caller (or an authorized admin in the same sede). | needs-confirmation |
| **C4** | Tenant/IDOR (C/D) | `backend/routers/documents.py:34` and `:59` | **`GET /api/documents` and `/api/documents/{doc_id}`** return documents/circolari of *both* schools to any authenticated user, with no role/class/sede check. | Scope document queries by the caller's sede and (for parents) by their child's class; add object-level check on get-by-id. | needs-confirmation |
| **C5** | Tenant/IDOR (C/D) | `backend/routers/appointments.py:26` | **`GET /api/appointments?parent_id=…`** lets any authenticated user read another family's appointments (incl. free-text `reason`) across tenants; not sede-scoped. | Ignore client `parent_id` for parents (derive from token); scope admin reads by sede. | needs-confirmation |
| **C6** | Tenant/IDOR (C/D) | `backend/routers/presenze.py:105` and `:164` | **Attendance (presenze) admin reads/writes span both schools** — `/api/presenze` and `/classi-summary` have no sede scoping, exposing minors' attendance across tenants. | Scope all attendance queries/mutations by the admin's sede / teacher's classes. | needs-confirmation |
| **C7** | Tenant/IDOR (C/D) | `backend/routers/calendar.py:15`–`:129` | **Calendar events not sede-scoped**: events of one school are visible, and any teacher can edit/delete any event (incl. the other school's) via PUT/DELETE. | Add sede scoping on read and ownership check on PUT/DELETE. | needs-confirmation |
| **C8** | Tenant/IDOR (C/D) | `backend/routers/diary.py:53` (read), `:97` (write) | **Diary cross-tenant read & write**: staff branch accepts arbitrary `class_id` (returns *all* classes' diaries when unfiltered); `POST /api/diary` lets any teacher write to any class incl. the other school. | Scope reads by sede/assigned classes; verify the target class belongs to the caller before write. | needs-confirmation |
| **C9** | Tenant/IDOR (C/D) | `backend/routers/griglia.py:47` (read), `:62` (write) | **Griglia (meal/hygiene grid) cross-tenant read & write**: staff branch trusts caller `class_id`/`student_id`; unfiltered read returns every child's grid in both schools; `POST` writes to any student/class. | Same tenant/ownership scoping as C8. | needs-confirmation |
| **C10** | Tenant/IDOR (C/D) | `backend/routers/gallery.py:74` (read), `:108`/`:174`/`:241` (write) | **Gallery cross-tenant**: staff read branch trusts caller `class_id`; upload/publish/delete accept any `class_id`/`media_id` with no sede/class membership check → cross-tenant read & write of minors' media. | Scope staff gallery access by sede/assigned classes; verify class/media ownership on every mutation. | needs-confirmation |
| **C11** | Tenant (C) | `backend/routers/users.py:74` (`/{id}`), `:59` (`/by-class`) | **User/PII cross-tenant read**: any admin can read any user of the other school (and any teacher can enumerate a class's parents) — responses include the plaintext `admin_password` field (see C13). | Scope user reads by sede; restrict `/by-class` to the caller's own classes. | needs-confirmation |
| **C12** | Tenant (C) | `backend/routers/users.py:417`–`507` | **Credential-reset endpoints (set/resend credentials) have no sede check** → cross-tenant account takeover: an admin of one school can reset/resend credentials for the other school's accounts. | Require same-sede (or superadmin) for any credential operation. | needs-confirmation |
| **C13** | Privacy/Secrets (B/E/F) | `backend/routers/auth.py:185`; `backend/routers/users.py:114,244,341,448,490` (writes); projections at `users.py:51,59,74` and `auth.py:/me` | **Every user's password stored in cleartext** in an `admin_password` field, and **leaked to clients** because `GET` user endpoints project out only `password`, not `admin_password`. Plaintext passwords of parents/staff are returned in API responses. | Stop writing `admin_password` entirely; purge the field from the DB (human-action migration); immediately exclude it from all projections as a stop-gap. | needs-confirmation |
| **C14** | Secrets (A/B) | `backend/services/database.py:63`–`76`, `282`–`318` | **Hardcoded production SuperAdmin credentials** (two real personal Gmail addresses + plaintext passwords) in source, **re-applied on every startup** via `ensure_superadmins()`. SuperAdmin has cross-tenant access to *both* schools, so this single leaked password breaks isolation everywhere — and any password change by the directors is silently reverted on next restart. | Move superadmin bootstrap to env-driven, hashed, one-time provisioning; remove plaintext from source. **Rotate the passwords (human-action).** | needs-confirmation |
| **C15** | Secrets (A/B) | `backend/credenziali_staff.txt` (tracked) and `backend/scripts/credenziali_staff.txt` | **Plaintext real staff credentials committed to git** (and still tracked despite being listed in `.gitignore` — `.gitignore` does not untrack already-committed files). | `git rm --cached` both files; keep ignored. **Rotate all listed passwords and scrub git history (human-action).** | needs-confirmation |
| **C16** | Data integrity (G) | `backend/services/database.py:247`–`249`, `568`–`573` | **`seed_database()` drops `users`/`classes`/`students`/`griglia`/`diary`/`gallery`/`meals`/… and reseeds demo data whenever the `classes` collection is empty** — and it runs on every startup. Given the recent crash with no verified backups, an empty `classes` collection at boot would **wipe all real families/children** and replace them with demo accounts. | Remove the destructive `.drop()`/reseed path from the production startup; gate any seeding behind an explicit one-off, non-production flag. **(Set up backups first — human-action.)** | needs-confirmation |
| **C17** | Secrets / Auth (J/B) | `backend/_archive/server.py.bak:22` (also `:150`,`:163`) | **A git-tracked archived backend backup hardcodes a JWT signing secret + demo passwords.** Active code reads `JWT_SECRET` from env, so this is a leftover-secret exposure, not an active fallback — but **if this value equals the production `JWT_SECRET`, anyone with the repo can forge tokens for any role/sede** (total auth bypass on minors' data). | Delete the archived file; **verify it does not match the live `JWT_SECRET`; if it does, rotate immediately and scrub history (human-action).** | needs-confirmation |

---

## 3. 🟠 HIGH findings

| ID | Area | File : line | Issue | Recommended fix | Fix type |
|---|---|---|---|---|---|
| **H1** | Auth (B/E) | `backend/routers/auth.py:111`–`116` | **Custom JWT issued with a 10-year (3650-day) expiry** ("login permanente"), no revocation, no `JWT_SECRET` strength check. A stolen token = effectively permanent access. | Reduce to a short access-token lifetime + refresh; add revocation/`active` re-check; enforce a minimum `JWT_SECRET` length at startup. | needs-confirmation |
| **H2** | Auth (B) | `frontend/src/lib/AuthContext.js:41`–`43` | **Web stores JWT + user profile in `localStorage`** — exfiltratable by any XSS. (Mobile correctly uses SecureStore.) | Move to httpOnly cookie or in-memory + short-lived token; combine with H1. | needs-confirmation |
| **H3** | Auth/IDOR (B/D) | `backend/routers/read_receipts.py:14`–`50` | **Read-receipts can be read and forged for any `parent_id`** across tenants (`GET ?parent_id=…`, `POST` with arbitrary `parent_id`). | Derive `parent_id` from the token; scope queries by caller. | auto |
| **H4** | Privacy/Auth (B/E) | `backend/routers/auth.py:159`–`188` | **`reset-password` stores the new password in cleartext** (`admin_password`) and has **no per-account abuse throttle** beyond a global 5/min. | Remove cleartext storage; add per-account/IP throttle and token single-use enforcement (token single-use is present; throttle is not). | auto (mitigation) / needs-confirmation (field removal) |
| **H5** | Tenant (C) | `backend/routers/avvisi.py:234`–`260` | **`PUT /api/avvisi/{id}` omits the sede-ownership check** that the DELETE handler has → a normal admin can overwrite another school's notice. | Add the same `validate_admin_sede_access`/ownership check used by DELETE. | auto |
| **H6** | Tenant (C) | `backend/routers/avvisi.py:150`–`167` | **Avviso create lets a normal admin broadcast into another school** via unchecked `target_sedi` (multi-site send should be superadmin-only). | Restrict multi-sede targeting to superadmin; validate each target sede against the admin's own. | needs-confirmation |
| **H7** | Secrets (A) | 30+ tracked root scripts: `iscrivi_magico_mondo.py`, `get_credenziali.py`, `invia_credenziali_ii_infanzia.py`, `recupera_magico_mondo.py`, `crea_account_demo_genitore.py`, `fix_resend_suppression.py:28`, … | **Hardcoded real-account passwords in dozens of committed recovery/import scripts** (verifier re-rated toward Critical). | Move these one-off scripts out of the repo or parameterize via env; **rotate any real passwords they contain and scrub history (human-action).** | needs-confirmation |
| **H8** | Secrets (A) | `email_ggt_note.txt:1`–`113` (tracked) | **113 parent email addresses (PII of minors' families) committed to git.** | `git rm --cached`; ignore; **scrub history (human-action).** | needs-confirmation |
| **H9** | Secrets (A) | `../girogirotondo-app-firebase-adminsdk-…json` (+ a `… copia.json`) | **Live Firebase Admin SDK service-account private key on disk** in the repo's parent dir. Not currently tracked, but root `.gitignore` does not cover `*adminsdk*.json`, so it would be committed if moved in. | Add `*adminsdk*.json`/`*service-account*.json` to `.gitignore`; store the key only in Railway env. **Rotate the key (human-action).** | auto (ignore) / human-action (rotate) |
| **H10** | API (E) | `backend/middleware/error_handler.py:10,24`–`25` | **Prod error masking is gated on `VERCEL_ENV=="production"`, but the backend runs on Railway** → `IS_PROD` is always False, so the 500 handler returns raw `str(exc)` internals to clients. | Detect prod via `RAILWAY_ENVIRONMENT`; never return raw exception text in prod. | auto |
| **H11** | API/Privacy (E) | `backend/services/email_service.py:490` | **Password-reset link (account-takeover token) logged in cleartext** on send failure. | Log a redacted reference, never the token/link. | auto |
| **H12** | Data integrity (G) | `backend/services/database.py:247`–`249`, `780`–`792` | **All DB indexes — incl. the only unique constraints (`users.email`, `push_tokens.token`) and all `sede_id` indexes — are created only inside `seed_database()` after the early-return guard**, so on a populated production DB they are never created. Uniqueness/tenant isolation then rely solely on app-level checks (which explains the dedup-on-every-boot logic). | Move index creation to an unconditional startup step (idempotent `create_index`), independent of seeding. | needs-confirmation |
| **H13** | Privacy/Store (F/I) | `mobile/store-metadata.md:42`; `frontend/src/pages/PrivacyPolicy.jsx:84`–`93` | **False "end-to-end encryption" claim** for minors' data. Real posture: TLS in transit + provider at-rest only; diary/griglia/meals stored as plaintext in Mongo; media via 7-day signed URLs or **raw base64 inside Mongo**. No application/client-side encryption exists. A false E2EE claim is a material misrepresentation to Apple/Google and under GDPR. | Replace "end-to-end encryption" with accurate wording ("encrypted in transit (HTTPS/TLS) and at rest"). The wording fix is auto; making the claim *true* would be a large project. | auto (wording) |

---

## 4. 🟡 MEDIUM findings

| ID | Area | File : line | Issue | Recommended fix | Fix type |
|---|---|---|---|---|---|
| **M1** | API (E/B) | `backend/main.py:82`–`91` | CORS defaults to `allow_origins=["*"]` **with `allow_credentials=True`**. | Set an explicit origin allowlist via `CORS_ORIGINS`; never combine `*` with credentials. | auto |
| **M2** | Auth (B) | `backend/middleware/auth.py:90`–`96` | `require_role()` is **broken** (binds `current_user` as `Header(None)` → would 500, never 403) **and unused**. RBAC depends entirely on copy-pasted inline checks → drift/omissions (see Criticals). | Fix it to use `Depends(get_current_user)` and adopt it everywhere, or delete it and standardize a single authz dependency. | auto |
| **M3** | API (E) | `backend/middleware/rate_limiter.py:1`–`11`; `backend/routers/gallery.py` | No rate limiting on uploads or other state-changing endpoints (limiter only on auth). | Add limits to upload/write endpoints. | auto |
| **M4** | API (E) | `backend/routers/gallery.py:121`–`138`; `documents.py:85`–`92`; `utils/storage_helper.py:70`–`130` | **File-upload hardening gaps**: no content-type allowlist, no filename sanitization (extension taken verbatim → path-traversal into `storage_path`), no mandatory image re-encode/EXIF-GPS strip on the Firebase path. Children's photos may carry GPS EXIF. | Allowlist MIME types, sanitize/ignore client filename, force re-encode + strip EXIF for all images. | needs-confirmation |
| **M5** | IDOR (D) | `backend/routers/gallery.py:267`,`:285` | `publish`/`delete` media have role check but no per-object sede/class check. | Add object-level ownership check. | needs-confirmation |
| **M6** | IDOR (D) | `backend/routers/appointments.py:41`–`80` | `POST /api/appointments` lets a parent create on behalf of any `parent_id`. | Derive `parent_id` from token. | needs-confirmation |
| **M7** | IDOR (D) | `backend/routers/meals.py:46`–`87` | Teacher branch returns **both** schools' menus when the teacher has no `class_ids`. | Default to the teacher's sede; never fall back to unfiltered. | auto |
| **M8** | Tenant (C) | `backend/routers/classes.py:116`–`125` | `update_class` assigns a teacher without verifying the teacher is in the class's sede. | Validate teacher sede == class sede. | auto |
| **M9** | Privacy (F) | `backend/routers/students.py:214`–`248` | **Right-to-erasure incomplete**: deleting a student cleans griglia/gallery membership but orphans `presenze`, leaves diary, and never deletes the child's actual photo/video blobs. | Cascade deletion across all child-linked collections + storage. | needs-confirmation |
| **M10** | Privacy (F) | `backend/routers/users.py:514`–`540` | Deleting a parent user orphans the child record and all its data. | Define and implement a complete family-deletion cascade. | needs-confirmation |
| **M11** | Privacy (F) | `frontend/src/pages/PrivacyPolicy.jsx:101,119` | No self-service erasure flow despite the policy promising the right to be forgotten. | Add an account/data-deletion request flow (reuse Omnia Core's). | needs-confirmation |
| **M12** | Privacy (F) | `backend/services/database.py:780`–`792` | No data-retention/TTL/auto-purge; data kept indefinitely, contradicting stated retention periods. | Implement retention jobs / TTL indexes per the policy. | needs-confirmation |
| **M13** | Data (G) | `backend/routers/users.py:99,213,311`; `auth.py:41` | Email uniqueness checked against **non-normalized** email while login lowercases → case-variant duplicate accounts possible (esp. with H12's missing unique index). | Normalize email to lowercase on all write paths; add unique index. | needs-confirmation |
| **M14** | Data (G) | `backend/routers/users.py:169`–`210` (`models/user.py:61`) | Child/family import accepts empty required fields (name/cognome/DOB) → garbage records (relevant to the rebuilt MM data). | Enforce non-empty required fields with validators. | auto |
| **M15** | Data (G) | `backend/routers/calendar.py:55`–`70` (`models/calendar.py:21`) | Dates/refs stored as unvalidated strings on write (regex only on read). | Validate date/reference formats at write time. | auto |
| **M16** | Data (G) | `backend/routers/students.py:144`; `users.py:205` | `child_code` from a 4-hex-char space, no uniqueness check/index → collisions. | Widen the space + unique index. | needs-confirmation |
| **M17** | Data (G) | `backend/routers/auth.py:62`–`77` | `/register` writes incomplete user docs (missing `sede_id`/`class_ids`/`child_ids`/`is_superadmin`). | Normalize the user document shape on all creation paths. | needs-confirmation |
| **M18** | Store (I) | `mobile/store-metadata.md:12`; `frontend/src/pages/PrivacyPolicy.jsx:12`; also seed `database.py:263,271` | **Wrong location "Napoli"** — schools are in **Carini (PA), Sicily**. Appears in store metadata, the public privacy policy, and seed addresses. | Replace "Napoli" with "Carini (PA)" everywhere. | auto |
| **M19** | Store (I) | `mobile/store-metadata.md:93`; `frontend/src/pages/PrivacyPolicy.jsx:117` | Data Safety/policy declare broader photo sharing ("other parents of the same class") than the app performs (per-child isolation). | Align the declaration with real per-child behavior. | auto |
| **M20** | Deps (J) | `app/build/` (414 files), `frontend/.next/` (65 files) | **Build artifacts committed to git** (`.gitignore` patterns are root-anchored and miss nested paths). | `git rm -r --cached` + fix ignore patterns. | auto |
| **M21** | Deps (J) | `backend/requirements.txt:9,17` | **Two JWT libraries** (`python-jose` + `pyjwt`); only `pyjwt` is used — `python-jose` is dead extra crypto surface. | Remove `python-jose`. | auto |

---

## 5. ⚪ LOW findings

| ID | Area | File : line | Issue | Fix type |
|---|---|---|---|---|
| **L1** | Secrets (A) | `frontend/src/lib/firebase.js:12`; `mobile/src/lib/firebase.ts:7` | Firebase Web config hardcoded as fallback (public-by-design, but should be env-driven). | auto |
| **L2** | Mobile (H) | `mobile/eas.json:36`–`44` | Personal Apple ID email + store/team identifiers committed (config + PII, not a secret). | needs-confirmation |
| **L3** | Auth (B) | `backend/middleware/auth.py:57`–`87` | Custom-JWT fallback is always active in prod when `JWT_SECRET` is set (intended, but worth an explicit prod posture decision). | needs-confirmation |
| **L4** | IDOR (D) | `backend/routers/appointments.py:134`–`145` | `/appointments/slots` exposes booked slots across both schools. | auto |
| **L5** | IDOR (D) | `backend/utils/storage_helper.py:133`–`139` | Media access relies on 7-day signed URLs handed out without object-level authz (see C2/C10); URL leak = long-lived access. | needs-confirmation |
| **L6** | API (E) | `backend/routers/auth.py:155` | Parent email (PII) logged on reset generation. | auto |
| **L7** | API (E) | `backend/routers/auth.py:89`–`106,127`–`156` | NoSQL-injection vectors only incidentally mitigated by string coercion — make validation explicit (use pydantic models, not raw `dict`). | needs-confirmation |
| **L8** | Privacy (F/I) | `frontend/src/pages/PrivacyPolicy.jsx:77` | References Firebase "Privacy Shield" — an invalidated transfer mechanism. | auto |
| **L9** | Data (G) | `backend/services/database.py:780`–`792` | No unique index on the app primary key `id` for any collection. | needs-confirmation |
| **L10** | Data (G) | `backend/models/student.py:5`–`12` | `POST /api/students` model lacks `cognome`/`sede_id` → surname-less students. | auto |
| **L11** | Mobile (H) | `mobile/eas.json:36` | Personal Apple ID email in submit config (see L2). | needs-confirmation |
| **L12** | Mobile (H) | `mobile/src/lib/notifications.ts:5`–`6` | `expo-notifications`/`expo-device` imported but missing from `package.json`. | auto |
| **L13** | Mobile (H) | `mobile/src/lib/notifications.ts:35` | Expo push token requested without explicit `projectId`. | auto |
| **L14** | Mobile (H) | `mobile/src/lib/AuthContext.tsx:135,142` | Auth error detail / email-flow hints written to `console.log`. | auto |
| **L15** | Mobile (H) | `mobile/app.json:14` | Deep-link scheme declared with no linking handler (informational, not currently exploitable). | human-action |
| **L16** | Deps (J) | `backend/requirements.txt:11` | `passlib` declared but unused (code uses `bcrypt`). | auto |
| **L17** | Deps (J) | `frontend/src/_archive_pages_router/`, `frontend/_archive_nextjs/`, `backend/_archive/` | Tracked dead-code archives (also relevant to C17). | needs-confirmation |
| **L18** | Deps (J) | `frontend/package.json:45` vs `mobile/package.json:28`; `requirements.txt:1`–`21` | `firebase` major-version skew (web ^10 vs mobile ^11); backend deps use unbounded `>=` floors. | needs-confirmation |

---

## 6. What is actually OK (so it isn't "fixed" by mistake)

- JWT decoding **pins `algorithms=["HS256"]`** → no `alg:none` bypass; no insecure hardcoded JWT/Firebase fallback in *active* code.
- **Parent-role isolation is implemented** on the list endpoints (`gallery`/`diary`/`griglia`/`students`/`meals`) — the gaps are mostly staff-role and the by-id endpoints.
- `classes`, `students`, `meals`, and `avvisi` GET **correctly use** the sede/role primitives — they are the model to copy.
- Real secrets (Mongo URL, JWT secret, Firebase Admin key, Resend key, CORS) are **sourced from env**; `backend/.env` is **not currently tracked**; `.env.example` is clean.
- Mobile: API base URL is **HTTPS**, JWT in **SecureStore**, no cleartext-traffic override, `extra` holds no secrets, `google-service-account.json` is **not** in the repo.
- Security-headers middleware (CSP/HSTS/`X-Frame-Options`), Sentry `send_default_pii=False`, and slowapi on auth endpoints are present.
- `react-native-web`/webpack removal is **confirmed clean**.

---

## 7. Prioritized remediation summary (preview of Phase 2 grouping)

1. **Stop the bleeding on data (do before anything else):** set up Railway DB backups + a tested restore (human-action) and neutralize **C16** (destructive startup reseed) — a crash + restart could erase the families again.
2. **Close cross-tenant + IDOR holes (C1–C12, H3, H5, M5–M8):** a single shared tenant/ownership dependency applied across the unscoped routers. This is the highest-severity *code* work and is structural → **needs-confirmation**.
3. **Kill plaintext credential exposure (C13, C14, C15, H4, H7):** stop storing `admin_password`, remove hardcoded/committed secrets — paired with **rotation + history scrub (human-action)**.
4. **Auth hardening (H1, H2, M1, M2):** short-lived tokens, safer web storage, real CORS allowlist, fix/retire `require_role`.
5. **Truthful compliance text (H13, M18, M19, L8):** E2EE wording, Carini location, sharing scope — mostly **auto**.
6. **Hygiene (M20, M21, L-series):** drop committed build artifacts/dead deps, remove PII from logs, fix error-handler prod detection, mobile push config.

---

## 8. Human-action checklist (cannot be performed from code — secrets/infra/history)

- [ ] **Rotate the Resend API key**; create a **per-project** least-privilege key (shared agency account = one leak exposes everyone).
- [ ] **Rotate the SuperAdmin passwords** (`mariucciasc@gmail.com`, `melignanoteresa@gmail.com`) hardcoded in `services/database.py` (C14) and the **Apple app-specific password** + any credential shared in chat.
- [ ] **Rotate every password listed in** `credenziali_staff.txt` and the root recovery scripts (C15, H7).
- [ ] **Rotate the Firebase Admin SDK service-account key** (H9) and the **`JWT_SECRET`**, and **confirm the production `JWT_SECRET` is not the value in `backend/_archive/server.py.bak`** (C17). If it matches, rotation is mandatory.
- [ ] **Scrub git history** (BFG / `git filter-repo`) for `backend/.env`, `frontend/.env`, `frontend/.env.production`, `credenziali_staff.txt`, `email_ggt_note.txt`, the archived `server.py.bak`, and the recovery scripts — then force-rotate anything they exposed.
- [ ] **Set up automated DB backups on Railway** (or managed Postgres w/ PITR) and **test a restore** before any further changes.
- [ ] Confirm in the **live MongoDB** whether the unique/`sede_id` indexes actually exist (H12) — they were likely never created in prod.
- [ ] Sign a **DPA** with the schools; set up **parental-consent records** and a **data-retention policy** (M12).
- [ ] Update the **live/draft App Store & Play listings**: location (Carini, PA), E2EE wording (H13), and the photo-sharing scope (M19).

---

## 9. Status

**Phase 1 complete. No files have been modified.** Awaiting your review of this report before proceeding to **Phase 2 (PLAN)** and any **Phase 3 (FIX)** work on a `audit/remediation` branch. Per your operating principles, nothing destructive, no pushes, and no secret rotation will be attempted by me — those are in the human-action checklist above.
