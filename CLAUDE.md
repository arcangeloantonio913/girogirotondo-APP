# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Girogirotondo** is a kindergarten management platform for parents, teachers, and admins. All UI text must be in **Italian**. Every interactive element must have a `data-testid` attribute.

## Architecture

**Backend** — FastAPI (Python) + MongoDB:
- Entry point: `backend/server.py`
- Async MongoDB via Motor driver
- JWT authentication (HS256, 7-day expiry, tokens stored in localStorage as `ggt_token` / `ggt_user`)
- All routes prefixed with `/api`
- Startup auto-seeds demo data
- Collections: `users`, `classes`, `students`, `griglia`, `diary`, `gallery`, `meals`, `appointments`, `documents`, `read_receipts`

**Frontend** — React + Next.js + Firebase:
- Entry: `frontend/src/index.js` → `frontend/src/App.js`
- Role-based routing: `/parent/*`, `/teacher/*`, `/admin/*`
- Auth: `frontend/src/lib/AuthContext.js` (wraps Firebase Auth + backend JWT)
- API client: `frontend/src/lib/api.js` (Axios with JWT interceptor)
- Path alias: `@/*` → `src/*`
- UI: Tailwind CSS + Shadcn/ui (`frontend/src/components/ui/`)
- Firebase used for Auth and Firestore storage

## Commands

### Frontend
```bash
cd frontend
yarn dev       # Start Next.js dev server (port 3000)
yarn build     # Production build
yarn start     # Start production server
```

### Backend
```bash
cd backend
uvicorn server:app --reload   # Start FastAPI dev server
```

### Tests
```bash
# From repo root
python backend_test.py        # Run API tests
```

## Design System

Defined in `design_guidelines.json`:
- **Colors**: Primary `#4169E1`, Secondary `#FF69B4`, Accent `#32CD32`, Background `#FFFDD0`
- **Fonts**: Nunito (headings), Poppins (body)
- **Style**: `rounded-2xl`, generous shadows, mobile-first
- **Required**: Every screen must include a GDPR footer

## Role-Based Pages

| Role    | Pages |
|---------|-------|
| Parent  | dashboard, profile, modulistica, griglia, gallery, diario, alimentazione |
| Teacher | dashboard, griglia, media, profile |
| Admin   | dashboard, users, classes, appointments, modulistica |

## Environment

**Backend** (`backend/.env`):
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
```

**Frontend** (`frontend/.env`):
```
REACT_APP_BACKEND_URL=<backend URL>
```
