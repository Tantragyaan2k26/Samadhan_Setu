# Samadhan Setu — Technical Architecture & Scaling Strategy

---

## 1. Technical Stack

| Layer | Selection | Rationale |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) + React + Tailwind CSS | Fast SSR/ISR, zero-blank-screen reliability, responsive mobile-first |
| **Backend** | Next.js API Routes (Node.js REST runtime) | Native TypeScript integration, RFC 9457 Problem Details error specs |
| **Database** | PostgreSQL 16 + PostGIS + pgvector (SQLite for local dev) | ACID transactional outbox, geospatial nearest-officer lookup |
| **Cache & Queues**| Redis 7 + BullMQ | Fast session lookups, rate limiting, asynchronous worker processing |
| **AI Triage** | Google Gemini API + Rule-based fallback classifier | Zero-shot Hindi/English categorization, semantic deduplication |
| **Accessibility** | WCAG 2.2 AA + GIGW 3.0 compliant | Contrast ≥ 4.5:1, A-/A/A+ resizer, full keyboard navigation |

---

## 2. Caching & CDN Strategy
- **Edge Caching**: Public statistics (`/api/v1/public/stats`) and taxonomy (`/api/v1/public/taxonomy`) cached via Cloudflare CDN with `stale-while-revalidate=600`.
- **In-Memory Cache**: Redis caches active session tokens and phone OTP attempts with a strict 10-minute TTL.
- **Client Cache**: TanStack Query caches static metadata locally, reducing redundant network requests in rural 2G/3G zones.

---

## 3. Rate Limiting & Security Controls
- **OTP Request Throttling**: Max 3 OTP requests per 10 minutes per mobile number; max 10 per hour per IP.
- **Citizen Reminders**: Max 1 reminder per 48 hours per ticket to prevent spamming field officers.
- **Idempotency Keys**: Required on `POST /api/v1/complaints` via `Idempotency-Key` header, preventing duplicate ticket creation on flaky mobile connections.
- **Security Headers**: HSTS, X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, strict CSP policies.
- **DPDP Act 2023 Compliance**: Personal data minimization (no Aadhaar collected), explicit purpose-based consent, phone masking in public endpoints.
