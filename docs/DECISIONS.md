# Architectural Decision Records (ADRs)

## ADR-001: Next.js App Router for Unified Citizen & Officer Portals
- **Context**: Need high-performance, SEO-friendly, mobile-first SSR pages with fast API endpoints for PRAYAS 2026.
- **Decision**: Use Next.js 14 with App Router, server-rendered components, and API routes.
- **Consequence**: Avoids blank SPA syndrome found on the old Apuni Sarkar site; satisfies Lighthouse score targets.

## ADR-002: Bilingual Voice-First and AI Triage
- **Context**: Rural and elderly citizens in Uttarakhand face steep barriers navigating multi-tier department drop-downs.
- **Decision**: Provide Web Speech API + Speech Simulation + AI NLP classification (supporting Hindi and English).
- **Consequence**: Fulfills the ≤60-second voice filing target and eliminates misrouted grievances.

## ADR-003: Citizen Feedback Reopen Barrier
- **Context**: Widespread citizen complaints on play store of officers force-closing grievances without resolving them.
- **Decision**: Any rating ≤ 2 stars or negative resolution confirmation automatically reopens the grievance and increments the administrative escalation level (up to L4).
- **Consequence**: Realigns officer incentives towards genuine on-ground resolution.

## ADR-004: Apuni Sarkar Delayed Application Bridge
- **Context**: Citizens have no escalation path when e-District certificates are stuck past SLA deadlines.
- **Decision**: Built a dedicated bridge adapter that cross-references e-District application numbers and pre-fills CM Helpline grievances with 1-click escalation.
- **Consequence**: Integrates the two flagship portals of Uttarakhand seamlessly.
