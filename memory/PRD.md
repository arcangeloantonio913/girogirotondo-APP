# Girogirotondo - PRD (Product Requirements Document)

## Original Problem Statement
Build a complete, responsive mobile-first web application for a premium kindergarten named "Girogirotondo". The app supports 3 user roles (Admin, Teacher, Parent) with role-based dashboards, daily activity tracking, media gallery, meal info, document management with read receipts, and appointment booking. Italian language interface, GDPR compliant.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + shadcn/ui (port 3000)
- **Backend**: FastAPI + Motor/MongoDB (port 8001)
- **Database**: MongoDB (collections: users, classes, students, griglia, diary, gallery, meals, appointments, documents, read_receipts)
- **Auth**: Mock JWT-based auth (to be replaced with Firebase later)

## User Personas
1. **Admin (Amministratore)**: School management - CRUD users/classes, document management, appointment oversight
2. **Teacher (Maestra)**: Class-scoped - daily grid entry, media upload, student management
3. **Parent (Genitore)**: Child-scoped read-only - view diary, daily grid, gallery, meals, acknowledge documents, book appointments

## Core Requirements
- No public sign-up (admin creates accounts)
- Role-based access control (RBAC)
- Italian language interface
- GDPR footer on every screen
- Mobile-first responsive design
- Brand colors: #4169E1, #FF69B4, #32CD32, #FFFDD0

## What's Been Implemented (2026-03-25)
- Login screen with branding and quick demo login buttons
- Parent Dashboard: 4 grid cards (Diario, Griglia, Galleria, Alimentazione)
- Parent sub-pages: Profile, Modulistica (with Presa Visione), Diary, Griglia timeline, Gallery lightbox, Alimentazione detail
- Parent appointment booking (FAB + dialog with date/slot/reason)
- Teacher Dashboard: class overview + student list
- Teacher Griglia: advanced daily grid with Select All, activity toggles, notes, batch save
- Teacher Media: simulated upload with student tagging
- Admin Dashboard: stats overview + navigation cards
- Admin CRUD: Users (grouped by role), Classes (with teacher assignment)
- Admin Appointments Manager: view/confirm/cancel bookings
- Admin Modulistica Manager: document upload, read receipt progress tracking
- Responsive layout: bottom nav (mobile), sidebar menu, GDPR footer
- Backend: complete REST API with seeded demo data
- Auth: Mock JWT with role-based routing protection

## Test Results
- Backend: 87% (20/23 passed) → fixed /api/auth/me → now 100%
- Frontend: 95% (19/20 features working)
- Overall: 91%+ success rate

## Prioritized Backlog
### P0 (Critical - Next Phase)
- Firebase Auth integration (replace mock JWT)
- Firebase Storage for real media/document uploads
- Real PDF viewer for Modulistica documents

### P1 (Important)
- Push notifications for new documents/updates
- Teacher diary creation interface
- Admin meal menu management
- Student CRUD from admin panel
- Password reset flow

### P2 (Nice to Have)
- Multi-language support
- Dark mode
- Analytics dashboard for admin
- Attendance reports/export
- Photo sharing privacy controls per child
