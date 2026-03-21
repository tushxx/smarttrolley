# Overview

SmartCart is an intelligent AI-powered shopping cart for a final-year engineering project. It uses a YOLO11s model trained on 5 product classes to detect items via camera and add them to a shopping cart automatically. Payment is via Razorpay (INR). Authentication via Replit/Google OAuth.

# User Preferences

Preferred communication style: Simple, everyday language.

# Architecture

## Current Deployment Mode
- **Storage**: In-memory (MemStorage) — database credentials are stale (Neon auth issue)
  - Fix: Go to Replit Database tab → "Reconnect" or reset credentials
  - Once fixed, app auto-switches to PostgreSQL (DatabaseStorage)
- **Detection Service**: Flask on port 8001, auto-starts with Express
- **YOLO Model**: `attached_assets/my_model_1774040104348.pt`
  - Classes: `{0:'Cards', 1:'Earbuds', 2:'Facewash', 3:'Perfume', 4:'Shampoo'}`
- **Frontend**: React + Vite on port 5000 (same Express server)

## YOLO Detection Flow
1. Camera captures frames every 1.5s (via `ItemDetector.tsx`)
2. Frame → base64 → `/api/detect` Express route
3. Express → Flask service at port 8001
4. Flask runs YOLO inference → returns best detection + confidence
5. 2 consecutive detections ≥ 50% confidence → auto-confirm
6. Product looked up by `detectionClass` (case-insensitive) → added to cart

## System Architecture

### Frontend
- **Framework**: React with TypeScript + Vite
- **UI**: shadcn/ui (Radix UI) + Tailwind CSS
- **State**: TanStack Query (React Query)
- **Routing**: Wouter
- **Forms**: React Hook Form + Zod

### Backend
- **Framework**: Express.js + TypeScript
- **ORM**: Drizzle ORM (PostgreSQL schema defined in `shared/schema.ts`)
- **Auth**: Passport.js + OpenID Connect (Replit OAuth)
- **Sessions**: PostgreSQL-stored sessions (connect-pg-simple)
- **Detection**: Python Flask subprocess (port 8001)

### Data Storage
- **Target DB**: PostgreSQL (Neon serverless)
- **Fallback**: In-memory MemStorage with 5 pre-seeded YOLO products
- **Schema**: Users, Products (keyed by `detection_class`), Carts, CartItems, Orders

## YOLO Product Classes → Products Mapping
| Model Class | Product Name  | Price (₹) |
|-------------|---------------|-----------|
| Perfume     | Perfume       | 1,999     |
| Cards       | Playing Cards | 299       |
| Facewash    | Face Wash     | 449       |
| Earbuds     | Earbuds       | 8,999     |
| Shampoo     | Shampoo       | 399       |

## Payment Processing
- **Provider**: Razorpay (INR)
- **Flow**: Order created → Razorpay payment intent → client confirmation → order status update

## IoT Integration (PIR Sensor — IMPLEMENTED)
- **Script**: `pi_sensor.py` — standalone Python script for the Pi
- **Flow**: PIR sensor (GPIO17) → picamera2 frames → local Flask YOLO → confirmed → POST `/api/iot/detect` → item added to user's cart
- **Auth**: Shared `IOT_SECRET` env var (default: `smarttrolley_iot_2024`) + phone number (no browser session needed)
- **Endpoint**: `POST /api/iot/detect` — accepts `{ iot_secret, phone_number, detection_class, confidence }`
- **Smart logic**: Same thresholds as frontend (HIGH_CONF=0.90, MED_CONF=0.65, CONFIRM_FRAMES=3)
- **Wiring**: PIR OUT → GPIO17 BCM; Pi camera → CSI ribbon
- **Pi install**: `pip install RPi.GPIO picamera2 requests pillow`
- **Run**: `SMARTCART_PHONE=9876543210 python3 pi_sensor.py`
- **Demo mode**: Script auto-detects missing GPIO and runs a server connectivity test instead

# External Dependencies

## Core Services
- **Neon Database**: Serverless PostgreSQL (currently having auth issues)
- **Razorpay**: Payment processing (INR)
- **Replit OAuth**: Authentication

## Frontend Libraries
- shadcn/ui, Radix UI, TanStack Query, Lucide React, Wouter

## Backend Libraries
- Drizzle ORM, Passport.js, Express Session, Zod
- Flask + ultralytics (YOLO inference)

## Detection Service Dependencies
- `flask`, `pillow` (managed via uv/pyproject.toml)
- `ultralytics`, `opencv-python` (auto-installed via pip at startup)
- `libGL`, `libGLU`, `mesa` (Nix system packages — installed)

# Key Files
- `detection_service.py` — YOLO Flask service
- `client/src/components/ItemDetector.tsx` — Camera + detection UI
- `client/src/pages/home.tsx` — Main shopping page
- `server/routes.ts` — All API routes
- `server/storage.ts` — Storage interface + MemStorage fallback
- `server/init-db.ts` — DB table creation + seed
- `shared/schema.ts` — Drizzle schema (single source of truth)
- `attached_assets/my_model_1774040104348.pt` — Trained YOLO weights

# Known Issues / TODO
1. **Database credentials stale** — Fix via Replit Database UI → Reconnect
2. **USB barcode input** — NOT added (user will request when ready)
3. **Raspberry Pi integration** — Future (webcam used for now)
4. **Weight sensor auth** — Future hardware integration

# Recent Changes (Current Session)
- **Landing page** — Simple phone number input only; calls `/api/auth/phone`; no OTP, no Google login
- **ItemDetector.tsx** — Strict single-item detection: camera locks after 2 consecutive frames ≥ 50% confidence, stops all scanning, shows confirm/rescan buttons; can only add 1 item per scan session
- **Phone auth flow** — `POST /api/auth/phone` → session stored; `GET /api/auth/user` → returns `{ id, phoneNumber }`; `POST /api/auth/logout` → session destroyed
- **home.tsx** — Logout calls `/api/auth/logout`, user display shows phone number, session expiry redirects to `/`
- **storage.ts** — Fixed TypeScript MapIterator errors using `Array.from()`; deleted unused `qrService.ts`
