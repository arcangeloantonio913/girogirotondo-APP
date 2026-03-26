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

## What's Been Implemented (2026-03-26, Iteration 3)
- **Warm Pastel Theme**: Softer pastels (#F4C2C2 Pink, #A7C7E7 Blue, #98FB98 Green) on cream #FFFDD0
- **Enlarged Logo**: School logo w-44 h-44 on login, h-12 in header — prominent branding
- **Illustrated SVG Icons**: Custom friendly illustrations for Diary, Grid, Camera, Meal cards
- **Friendly Empty States**: Cartoon bear graphics with Italian text for missing data
- **Parent Dashboard** — Rich cards: Diario text preview, Griglia colored dots, thumbnail gallery, meal grid
- **Teacher Griglia (New)**: Specialized daily grid matching paper form — Colazione/Pranzo/Frutta/Merenda/Cacca/Pisolino/Note columns, horizontal scroll table, colored toggles, Select All, bulk actions, date navigation, "Salva e Pubblica ai Genitori" button
- **Parent Utente**: Child info + ID + class + "Segreteria & Supporto" section with phone/email
- **Parent Documenti**: GDPR disclaimer + mock PDF circulars with Presa Visione acknowledgment
- **Teacher Profile**: Login credentials, class assignment, student count
- **Bottom Nav**: Parent (Home/Documenti/Dieta/Utente), Teacher (Home/Griglia/Media/Profilo)
- **Omnia Footer**: "© 2026 Omnia - Piattaforma Istituzionale Girogirotondo..." on all screens
- Backend updated with new griglia fields: colazione, pranzo, frutta, merenda, cacca, pisolino
- All 3 dashboards (Parent/Teacher/Admin) functional with mock JWT auth

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
