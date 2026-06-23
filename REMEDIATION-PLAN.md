# REMEDIATION-PLAN.md — Girogirotondo (Phase 2)

Companion to `SECURITY-AUDIT.md`. **No code has been changed.** This plan groups the work into
**Auto-fix**, **Needs-confirmation**, and **Human-action**, with a concrete design for the cross-tenant fix
(shared dependency, per your choice). Nothing here is applied until you approve.

## Safety preamble (order matters)

1. **Backups before data changes.** Several fixes touch data or startup behavior (C13, C14, C16, H12, M9–M13). Do **not** run any of those until Railway automated backups exist and a restore has been tested (human-action). Until then I'll only do non-data work.
2. **No data migration without your typed confirmation.** Purging `admin_password`, deduping emails to add a unique index, normalizing user docs, and erasure cascades all modify existing records — each will be proposed separately with the exact query and a dry-run count first.
3. **Branch + small commits, no push.** All work on `audit/remediation` in `girogirotondo-APP/`. Build/tests run after each group.
4. **Removing a secret from code ≠ rotating it.** Every secret removal is paired with a human-action rotation reminder.

---

## GROUP A — Auto-fix (low-risk, mechanical) — *safe to apply on approval*

| ID(s) | Change | Files | Risk / note |
|---|---|---|---|
| H10 | Detect prod via `RAILWAY_ENVIRONMENT`; never return raw `str(exc)` in prod | `backend/middleware/error_handler.py` | None — strictly reduces leakage |
| H11, L6, L14 | Stop logging reset token / parent email / mobile auth detail | `backend/services/email_service.py:490`, `backend/routers/auth.py:155`, `mobile/src/lib/AuthContext.tsx:135,142` | None |
| M2 | Fix `require_role()` to use `Depends(get_current_user)` (remove the `Header` trap); keep available for Group B adoption | `backend/middleware/auth.py:90` | None (currently unused) |
| H13, M18, M19, L8 | **Truthful copy:** remove "end-to-end encryption" → "encrypted in transit (TLS) and at rest"; "Napoli" → "Carini (PA)"; correct photo-sharing scope to per-child; remove "Privacy Shield" | `mobile/store-metadata.md`, `frontend/src/pages/PrivacyPolicy.jsx`, seed addresses `backend/services/database.py:263,271` | Text only. Live store/listing edits remain human-action |
| M1 | CORS: replace `*`-with-credentials default with an explicit allowlist | `backend/main.py:82` | ⚠️ Needs the prod origin list confirmed (see "What I need"). I'll keep `girogirotondowebapp.it` + localhost and read `CORS_ORIGINS` env |
| M3 | Add `slowapi` limits to upload/write endpoints (generous, e.g. 30/min) | `backend/routers/gallery.py`, others | Pick limits high enough not to block bulk photo upload |
| M14, M15, L10 | Validators: non-empty required fields on enrolment; date-string validation on write; add `cognome`/`sede_id` to `StudentCreate` | `backend/models/*.py`, related routers | Low — matches real client payloads; will verify against frontend/mobile calls first |
| H9 (ignore part) | Add `*adminsdk*.json`, `*service-account*.json`, `*credenziali*.txt`, `email_*note.txt` to `.gitignore` | root `.gitignore` | None |
| C15/H7/H8/C17 (untrack part) | `git rm --cached` the tracked secret/PII files (`credenziali_staff.txt` ×2, `email_ggt_note.txt`, `backend/_archive/server.py.bak`) — files stay on disk | git index | Safe & reversible. **Rotation + history scrub stays human-action** |
| M20 | `git rm -r --cached app/build/`, `frontend/.next/`; fix ignore patterns | git index | Safe — build output, regenerated |
| M21, L16 | Remove `python-jose`, `passlib` from `requirements.txt` **after** grep-confirming no imports | `backend/requirements.txt` | Will verify zero imports before removing |
| L12, L13 | Add `expo-notifications`/`expo-device` to `mobile/package.json`; pass explicit `projectId` to push-token call | `mobile/package.json`, `mobile/src/lib/notifications.ts` | Improves push reliability |
| L1 | Move Firebase **web** config to env vars (keep public keys as documented config) | `frontend/src/lib/firebase.js`, `mobile/src/lib/firebase.ts` | Low; these keys are public-by-design |

Auto-fix commits (proposed): (1) logging/error-handler, (2) compliance copy, (3) CORS+rate-limit, (4) validation, (5) gitignore+untrack secrets, (6) untrack build artifacts, (7) deps cleanup, (8) mobile push.

---

## GROUP B — Needs-confirmation (structural / risky / data-touching) — *I propose, you approve each*

### B0 — Shared tenant/ownership dependency (the core fix for C1, C2, C4–C12, H3, H5, M5–M8)

**Design (migration-free).** Add to `backend/middleware/auth.py` a dependency `get_tenant_context` returning an object built from `current_user` + `X-Sede-Id`:

```
TenantContext:
  role, user_id, is_superadmin
  sede_ids:          # superadmin -> both; admin -> validated own sede; teacher/parent -> own sede
  allowed_class_ids  # teacher -> user.class_ids; parent -> classes of user.child_ids;
                     # admin/superadmin -> all class ids whose class.sede_id in sede_ids (looked up from `classes`)
  allowed_student_ids # parent -> child_ids; staff -> students whose class_id in allowed_class_ids
  # helpers:
  assert_class(class_id)      -> 404 if class_id not in allowed_class_ids
  assert_student(student_id)  -> 404 if not authorized
  assert_sede(sede_id)        -> 404 if sede_id not in sede_ids
  class_filter()              -> {"class_id": {"$in": allowed_class_ids}}   # base scope for list queries
```

**Why class-based scoping (not sede field on every doc):** the `classes` collection reliably carries `sede_id`, but several write paths (e.g. gallery upload at `gallery.py:141`) never stamp `sede_id` on the document. Scoping by the caller's `allowed_class_ids` (derived from `classes`) needs **no backfill migration** and works today. Complementary hardening: also start stamping `sede_id` on writes going forward (safe/additive); a one-off backfill of historical docs is optional and would be a separate confirmed migration.

**Application pattern per router:**
- **List endpoints:** start the query from `ctx.class_filter()`; if the caller passes `class_id`/`student_id`, validate with `assert_*` then narrow — never return unfiltered.
- **Get-by-id:** fetch, then `ctx.assert_class(obj.class_id)` (+ parent child-ownership). Return **404** not 403 to avoid existence leaks.
- **Writes/mutations:** `assert_class`/`assert_student` on the target before insert/update; on update, fetch existing and assert ownership; **stamp `sede_id`** from the class.

**Rollout:** one router at a time, each its own commit with a role×sede regression test. Order by exposure: `gallery` → `diary` → `griglia` → `documents` → `presenze` → `calendar` → `appointments` → `notifications` → `read_receipts` → `avvisi` (H5/H6) → `users` (C3/C11/C12 + field whitelist on PUT).

**Risk:** if `allowed_class_ids` is computed wrong, legitimate staff could lose access. Mitigated by per-router tests and a staging check against the demo accounts before any deploy.

### B1 — Remaining needs-confirmation items

| ID | Change | Why confirmation / data impact |
|---|---|---|
| C3 | Field whitelist on `PUT /api/users/{id}`; forbid self-edit of `child_ids`/`sede_id`/`class_ids`/`role`/`is_superadmin` | Behavior change to a write path families use |
| C13 | Stop writing `admin_password`; **purge the field** from all user docs | **Data migration** — needs typed confirmation + dry-run count |
| C14 | Move superadmin bootstrap to env-driven, hashed, idempotent (no plaintext, no password reset on every boot) | Changes login provisioning; pair with password rotation (human) |
| C16 | Remove the destructive `.drop()`/reseed path from production startup; gate seeding behind an explicit non-prod flag | Startup-behavior change; must preserve index creation (see H12) |
| H12 | Create indexes unconditionally at startup | Adding `users.email` **unique** will **fail if duplicates exist** → must dedup first (data migration, confirmed separately) |
| H1, H2 | Short-lived JWT + refresh; move web token off `localStorage` | May log out existing sessions / change the "permanent login" UX families rely on |
| M4 | Upload content-type allowlist + forced image re-encode + EXIF/GPS strip | Changes upload pipeline; could reject some formats/videos |
| M9, M10, M11, M12 | Erasure cascades + self-service deletion + retention/TTL | **Deletes data** — each confirmed separately |
| M13, M16, M17 | Email lowercasing on write; wider unique `child_code`; normalized user-doc shape | Data-touching / migration |
| H6 | Restrict multi-sede notice broadcast to superadmin | Behavior change to avvisi |
| L17 | Delete dead archive dirs | Confirm nothing imports them first |

---

## GROUP C — Human-action (I cannot do these)

Full list in `SECURITY-AUDIT.md` §8. Highest priority:
1. **Set up Railway automated backups + test a restore** (gates all Group B data work).
2. **Rotate** Resend key (per-project), superadmin passwords, staff passwords, Apple app-specific password, Firebase Admin key, `JWT_SECRET` — and **confirm prod `JWT_SECRET` ≠ the value in `server.py.bak`**.
3. **Scrub git history** for the committed secrets/PII, then force-rotate.
4. Update **live App Store / Play / privacy listings** (location, E2EE wording, sharing scope).
5. Confirm in the **live DB** which indexes actually exist (H12).

---

## What I need from you to start Phase 3

1. **Approve Group A** (all, or tell me which to skip).
2. **Confirm the CORS origin allowlist** for M1 (e.g. `https://girogirotondowebapp.it` + any preview/admin domains).
3. **Approve B0** (the shared dependency) so I can build it + roll it out router-by-router for review.
4. For the data-touching Group B items (C13, C14, C16, H12, M9–M13): I will **not** start these until backups exist and you give a separate typed confirmation per item.
