# Samadhan Setu — REST API Reference v1.0
Base Path: `/api/v1`

---

## 1. Authentication Endpoints
- `POST /auth/otp/request`
  - Body: `{ "phone": "9897001122" }`
  - Response: `{ "success": true, "message": "OTP sent", "debugOtp": "190500" }`
- `POST /auth/otp/verify`
  - Body: `{ "phone": "9897001122", "code": "190500" }`
  - Response: `{ "success": true, "session": { "userId": "...", "role": "CITIZEN" } }`
- `POST /auth/staff/login`
  - Body: `{ "email": "rajesh.negi@uk.gov.in", "password": "..." }`
  - Response: `{ "success": true, "session": { "role": "OFFICER", "officerLevel": 1 } }`

---

## 2. Grievance Management
- `POST /ai/suggest`
  - Body: `{ "text": "हमारे गांव में पानी नहीं आ रहा", "districtId": "dist-ddn" }`
  - Response: `{ "success": true, "suggestion": { "departmentCode": "JAL_SANSTHAN", "categoryCode": "WATER_SUPPLY_ISSUE", "urgency": "NORMAL", "confidence": 0.94 } }`
- `POST /complaints`
  - Headers: `Idempotency-Key: idemp-uuid`
  - Body: `{ "title": "...", "description": "...", "citizenPhone": "...", "departmentId": "...", "categoryId": "...", "districtId": "...", "urgency": "NORMAL" }`
  - Response: `201 Created` with `{ "success": true, "ticketNo": "UK-2026-000104", "sla": { ... } }`
- `GET /complaints/{ticket}`
  - Response: Detailed complaint with complete historical timeline events.
- `POST /complaints/{ticket}/remind`
  - Enforces 48-hour cooldown.
- `POST /complaints/{ticket}/escalate`
  - Moves complaint to next administrative level (L1 -> L2 -> L3 -> L4).
- `POST /complaints/{ticket}/feedback`
  - Body: `{ "rating": 1, "resolved": false, "comment": "Still leaking" }`
  - If rating ≤ 2: Auto-reopens complaint and escalates level.
  - If rating ≥ 3: Officially closes complaint.

---

## 3. Apuni Sarkar Bridge
- `GET /bridge/applications?ref=UK-EDIST-2026-8812`
  - Returns simulated e-District application status and delay metrics.
- `POST /bridge/applications/{id}/escalate`
  - 1-click conversion into an escalated CM Helpline grievance.

---

## 4. Public & Monitoring
- `GET /public/stats`
  - Returns aggregated statewide resolution rates, average resolution time, and district distribution.
- `GET /public/taxonomy`
  - Returns 13 official districts, departments, and categories.
- `GET /dev/messages`
  - Live inspection log of all dispatched SMS & WhatsApp mock notifications.
