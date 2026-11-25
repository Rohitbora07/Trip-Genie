# TRIP GENIE: MASTER FRONTEND & PORTFOLIO ROADMAP
### Phase 5 (Next.js 16 Frontend) & Phase 6 (Portfolio Polish & Demo Prep)

> **Document Purpose:** Self-contained master architecture and design specification for **Trip Genie**. Any engineer or AI agent reading this will have complete context on design tokens, API contracts, animation principles, Next.js 16 conventions, and step-by-step tasks.

---

## 1. Executive Context & System Architecture

### 1.1 The Core Problem & Differentiator
Trip Genie is an **autonomous travel operations platform with human-in-the-loop recovery**.
Its flagship differentiator is the **Travel-Ops Disruption Recovery Loop**:
1. When real-world disruptions strike (flight delay, rainstorm, closed museum), the system invalidates affected itinerary segments.
2. The LangGraph AI service drafts multi-option recovery schedules with real-time transit and opening-hour constraints.
3. The user compares recovery options side-by-side using an executive diff viewer (showing added, cancelled, and shifted activities with net financial impact).
4. With one click, the user approves an option, which increments the itinerary version, updates the schedule with optimistic UI, and logs an immutable audit trail with one-click rollback.

### 1.2 Technology Monorepo Architecture
```
trip-genie/
├── apps/
│   ├── api/             # Node.js + Express + Prisma + PostgreSQL (Port 5000)
│   │   ├── prisma/      # Schema with User, Trip, Itinerary, Activity, GenerationJob
│   │   └── src/modules/ # auth, trips, itineraries, itinerary-days, activities, places, generation-jobs
│   ├── ai-service/      # Python + FastAPI + LangGraph + Groq Llama 3 (Port 8000)
│   │   └── app/         # Generation workflows, disruption recovery, transit/weather tools
│   └── web/             # Next.js 16 (App Router) + React 19 + Tailwind CSS v4 (Port 3000)
```

### 1.3 Strict Next.js 16 Rules
- **Async Request APIs:** `params`, `searchParams`, `cookies()`, and `headers()` are strictly asynchronous (`await params`).
- **Client vs Server:** All client-side hooks (`useState`, `useEffect`, etc.) require `"use client"`.
- **API Forwarding:** All API requests must use `credentials: "include"` via `apiFetch` in `@/lib/api`.

---

## 2. Design System: "The Modern Concierge & Editorial Atelier"

### 2.1 Anti-AI Vibe Coding Rules
- **NO Cyberpunk / Hackathon Clichés:** No `#000000` pitch-black backgrounds, glowing neon purple/cyan borders, glowing hover effects, or sparkles emoji (`✨`) on every button.
- **NO Generic Sterile SaaS Templates:** No blinding `#FFFFFF` across the entire viewport, no default Tailwind blue (`#2563EB`), and no flat, thin gray borders with zero personality.
- **YES High-Craft Editorial Luxury:** Warm alabaster canvas, crisp ivory white cards, deep alpine pine heritage branding, spiced terracotta accents, and muted mineral diff tags.

### 2.2 Color Tokens & CSS Variable Mapping (globals.css)
```css
:root {
  /* Canvas & Surfaces */
  --canvas: #FBFBF9;          /* Warm Alabaster base (tactile, organic paper feel) */
  --surface: #FFFFFF;         /* Crisp Warm White for elevated cards and panels */
  --surface-muted: #F6F5F1;   /* Soft Linen for sub-sections, inputs, and tab bars */
  --surface-hover: #F2EFE9;   /* Slightly deeper linen on hover */
  
  /* Brand & Accents */
  --primary: #17382B;         /* Deep Alpine Pine (heritage, prestige, stability) */
  --primary-hover: #10281F;   /* Darker Pine for active button states */
  --accent: #B85D38;          /* Spiced Terracotta (warm action points, active indicators) */
  --accent-muted: #FDF3EE;    /* Soft terracotta wash for highlights */

  /* Ink & Typography */
  --ink-primary: #1C1A17;     /* Deep Espresso Charcoal for primary text and titles */
  --ink-secondary: #635E59;   /* Muted Umber for timestamps, secondary labels, metadata */
  --ink-tertiary: #969087;    /* Warm Stone for inactive icons, disabled states */

  /* Hairlines & Elevation */
  --border-subtle: #EBE8E1;   /* Ultra-fine card dividers */
  --border-default: #E2DFD6;  /* Standard crisp card border (1px) */
  --border-strong: #CDC8BC;   /* Active borders, focused inputs, selected pills */
  
  /* Semantic Diff & Status (Muted Mineral Tones — Zero Screaming Neon) */
  --status-confirmed-bg: #ECF4EE;
  --status-confirmed-text: #1E4B31;
  --status-cancelled-bg: #FDF1EF;
  --status-cancelled-text: #99382C;
  --status-shifted-bg: #FEF8EC;
  --status-shifted-text: #925A15;
  --status-planned-bg: #F3F1EC;
  --status-planned-text: #524E48;
}
```

### 2.3 Typography
- **Display Serif:** `Newsreader` / `Playfair Display` for headlines, trip titles, daily themes.
- **Interface Sans:** `Geist Sans` for navigation, controls, cards, and forms.
- **Tabular Mono:** `Geist Mono` for 24h timestamps (`09:30 – 11:00`), costs (`+$35.00`), flight numbers (`JL006`), and version tags (`v2.1`).

---

## 3. Data & API Contracts

Frontend requests target `http://localhost:5000/api` with `credentials: "include"`:
- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/send-verification-token`, `POST /api/auth/verify-email`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- **Users:** `GET /api/users/me`
- **Trips:** `GET /api/trips`, `POST /api/trips`, `GET /api/trips/:id`
- **Itineraries:** `GET /api/trips/:tripId/itineraries`, `GET /api/itineraries/:itineraryId/days`
- **Activities:** `PATCH /api/itinerary-days/:dayId/activities/reorder`, `POST /api/activities`
- **Places:** `GET /api/places/search?q=...`, `POST /api/saved-places`
- **Generation Jobs:** `POST /api/generation-jobs`, `GET /api/generation-jobs/:id`

---

## 4. Granular Implementation Stages

- **Stage 1:** Foundation, Client & Auth Suite (tokens, `api.ts`, split auth, 6-digit OTP, reset flows)
- **Stage 2:** Shell Navigation & Dashboard Experience (responsive navbar, trip grid, create trip modal)
- **Stage 3:** Interactive Timeline & Place Lookup (day tabs, 24h timeline rail, activity cards, drag/drop reorder, place search drawer)
- **Stage 4:** AI Generation, Polling & Versions (floating action bar, 4-step polling micro-stepper, version comparison drawer)
- **Stage 5:** Disruption Simulator & Human Approval Engine (Travel-Ops console, multi-option recovery diff viewer, approval modal, audit trail with rollback)
- **Stage 6:** Portfolio Polish, Seeding & Docker (Tokyo 3-day seed script, single-command docker-compose, portfolio README & demo guide)
