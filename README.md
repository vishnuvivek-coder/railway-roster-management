# 🚆 Railway Staff Link-Rotation Roster Manager

> **Deterministic, fair cyclic rotation engine for railway conducting staff, sleeper crew, and train ticket examiners.**  
> Built with a luxury dark editorial design, role-based access security, Progressive Web App (PWA) mobile support, and single-server cloud architecture.

---

## 🌐 Live Cloud Application

👉 **[https://railway-roster-management.onrender.com](https://railway-roster-management.onrender.com)**  
*Deployed 24/7 on Render with automatic HTTPS, offline caching, and mobile PWA support.*

---

## 🔑 Login Access

| Role | Railway Officer ID / Username | Password | Permissions & Capabilities |
| :--- | :--- | :--- | :--- |
| 👑 **Railway Administrator / Officer** | `12345` | `CLICKME` | **Full Administrative Access**: Manage 21-day COR, 63-day Sleeper, and 7-day Ladies link rotations, approve duty swaps/leaves, log physical duty registers, perform manual duty overrides, and export reports. |

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

## 📱 Mobile PWA & Responsive Layout

- **Collapsible Drawer (`☰` Menu)**:
  - Full-width responsive dashboard on mobile devices.
  - Slide-over navigation drawer triggered via top hamburger menu.
- **Fixed Bottom Dock**:
  - 1-tap quick navigation for *My Duty*, *Daily Summary*, *Roster Grid*, *Leaves*, and *Menu*.
- **iOS Safari & Android PWA**:
  - Cupertino safe-area spacing for Dynamic Island / iPhone notch.
  - 16px form input zoom protection.
  - *"Add to Home Screen"* standalone application support.

---

## 🔒 Security & Data Integrity

- **Role-Based Access Control (RBAC)**: All mutating endpoints (`POST /api/categories`, `POST /api/staff`, `POST /api/links`, `POST /api/overrides`, `POST /api/leave-requests/:id/approve`, `POST /api/duty-register`) strictly require `Admin` JWT tokens.
- **User Verification Pipeline**: New account registrations are set to `PENDING` status until verified by the Administrator.
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

## 📄 License
Internal Railway Operations & Duty Roster Management System.
