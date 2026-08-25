# 🚆 Railway Staff Link-Rotation Roster Manager

> **Deterministic, fair cyclic rotation engine for railway conducting staff, sleeper crew, and train ticket examiners.**  
> Built with a luxury dark editorial design, role-based access security, Progressive Web App (PWA) mobile support, and single-server cloud architecture.

---

## 🌐 Live Cloud Application

👉 **[https://railway-roster-management.onrender.com](https://railway-roster-management.onrender.com)**  
*Deployed 24/7 on Render with automatic HTTPS, offline caching, and mobile PWA support.*

---

## 🔑 Default Login Credentials

| Role / Persona | Username | Password | Permissions & Access Level |
| :--- | :--- | :--- | :--- |
| 👑 **Master Administrator** | `admin` | `admin123` | **Full Read/Write**: User verification portal, manual duty overrides, leave approvals, daily register logging, link master editing. |
| 👷 **Employee 1 (COR Conductor)** | `employee1_cor` | `staff123` | **Read-Only**: 21-day cyclic duty schedule, personal duty spotlight, submit leave/swap requests. |
| 🚆 **Employee 5 (Sleeper Staff)** | `employee5_sleeper` | `staff123` | **Read-Only**: 63-day sleeper train roster, route details, submit leave/swap requests. |
| 👩 **Employee 1 (Ladies Squad)** | `employee1_ladies` | `staff123` | **Read-Only**: 7-day squad roster, submit leave/swap requests. |
| 🆕 **Pending Applicant** | `pending_user` | `staff123` | **Blocked**: Demonstrates the new user workflow waiting for Master Admin verification. |

> ⚡ **Quick Switcher**: You can also use the floating **Prototype Sandbox** toolbar at the top to toggle between any persona with 1 click without typing passwords.

---

## ⚙️ Mathematical Rotation Engine

The rotation engine uses a strictly deterministic modular arithmetic algorithm:

Link Number = [((Seniority Index + Day Offset - 1) mod Cycle Length)] + 1

- **Anchor Date**: `2026-08-01`
- **Conductors (COR)**: 21 Staff × 21 Links (21-day cycle)
- **TTI / Sleeper Staff**: 63 Staff × 63 Links (63-day cycle)
- **Ladies Staff / TTE**: 7 Staff × 7 Links (7-day cycle)

### Acceptance Verification:
- Verified cell-for-cell against official August 2026 ground-truth railway master sheets.
- **2,912 checks executed with 0 mismatches (`npm test`)**.

---

## 📱 Mobile PWA & Adaptive Layouts

- **🍎 iOS Layout (iPhone / iPad)**:
  - Cupertino blur navigation bar with Dynamic Island / Notch safe-area spacing (`viewport-fit=cover`).
  - Frosted glass bottom dock with SF-style iconography.
  - Form inputs set to `16px` to prevent disruptive iOS Safari auto-zooming.
- **🤖 Android Layout**:
  - Material 3 dark surface with quick category chips and bottom navigation bar.
- **Collapsible Drawer (`☰` Menu)**:
  - Full-width responsive dashboard on mobile devices.
  - Slide-over navigation drawer triggered via top hamburger menu.
- **Install to Home Screen**:
  - **Android (Chrome)**: Tap `⋮` ➔ **"Install app"** or **"Add to Home screen"**.
  - **iPhone (Safari)**: Tap Share `⎕↑` ➔ **"Add to Home Screen"**.

---

## 🔒 Security & Data Integrity

- **Role-Based Access Control (RBAC)**: All mutating endpoints (`POST /api/categories`, `POST /api/staff`, `POST /api/links`, `POST /api/overrides`, `POST /api/leave-requests/:id/approve`, `POST /api/duty-register`) strictly require `Admin` JWT tokens.
- **Non-Admin Lockdown**: All staff, guest, and viewer accounts are restricted to read-only mode (`403 Forbidden` on unauthorized modifications).
- **User Approval Pipeline**: New account registrations are set to `PENDING` status and cannot access rosters until explicitly verified by the Master Admin.
- **Audit Logging**: Every administrative action, duty override, and account verification is permanently logged with timestamps and user roles.

---

## 🛠️ Local Development & Quickstart

### Prerequisites
- Node.js (v18+)
- npm

### 1. Clone & Install
```bash
git clone https://github.com/vishnuvivek-coder/railway-roster-management.git
cd railway-roster-management
npm install
npm --prefix src/frontend install
```

### 2. Run Local Development Server
```bash
npm run dev
```
- **Local Browser**: `http://localhost:5173`
- **Mobile / Same Wi-Fi Network**: `http://<your-local-ip>:5173`

### 3. Run Mathematical Acceptance Tests
```bash
npm test
```

### 4. Build Full Production Bundle
```bash
npm run build
npm start
```

---

## 📡 REST API Overview

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticate user & issue JWT token |
| `POST` | `/api/auth/register` | Public | Register new staff account (creates `PENDING` user) |
| `POST` | `/api/auth/demo-switch` | Public | Fast-switch persona for prototype demonstrations |
| `GET` | `/api/categories` | Authenticated | List all 3 duty categories & cycle parameters |
| `GET` | `/api/staff` | Authenticated | Get seniority staff roster by category |
| `GET` | `/api/links` | Authenticated | Get link definitions (train pairs, coaches, routes) |
| `GET` | `/api/roster` | Authenticated | Calculate full monthly cyclic link rotation grid |
| `POST` | `/api/overrides` | **Admin Only** | Apply manual link override or emergency sick leave |
| `POST` | `/api/duty-register` | **Admin Only** | Record daily physical log entries & actual duties |
| `GET` | `/api/duty-register/compare`| Authenticated | Compare planned rotation links vs actual physical register |
| `GET` | `/api/admin/users` | **Admin Only** | Directory of pending, approved, and rejected users |
| `POST` | `/api/admin/users/:id/approve` | **Admin Only** | Approve pending staff applicant |

---

## 📄 License
Internal Railway Operations & Duty Roster Management System.
