# 🛒 SmartTrolley

AI-powered smart shopping trolley with real-time item detection using YOLO, Raspberry Pi camera integration, and a modern React web dashboard.

## Quick Start

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd smarttrolley

# 2. Run setup (installs Node.js + Python dependencies)
bash setup.sh
# OR manually: npm install && pip3 install -r requirements.txt

# 3. Configure environment
#    Edit .env with your Razorpay keys and session secret
#    (setup.sh creates .env from .env.example automatically)

# 4. Start the app
npm run dev
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the web app (Express + React on port 5000) |
| `npm run dev:detection` | Start the Python YOLO detection service (port 8001) |
| `npm run dev:all` | Start **both** services concurrently |
| `npm run setup` | Install all dependencies (npm + pip) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:push` | Push database schema changes |

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

| Variable | Description |
|----------|-------------|
| `RAZORPAY_KEY_ID` | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret |
| `SESSION_SECRET` | Express session secret |

## Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS, Radix UI, Framer Motion
- **Backend**: Express.js, TypeScript, Drizzle ORM
- **Detection**: Python, Flask, YOLO (Ultralytics), OpenCV
- **Hardware**: Raspberry Pi, Pi Camera, PIR Sensor

## Project Structure

```
smarttrolley/
├── client/              # React frontend
├── server/              # Express backend
├── shared/              # Shared types/schema
├── detection_service.py # YOLO detection Flask service
├── pi_sensor.py         # Raspberry Pi sensor script
├── attached_assets/     # YOLO model weights (.pt)
├── package.json         # Node.js dependencies
├── requirements.txt     # Python dependencies
├── setup.sh             # One-step setup script
└── .env.example         # Environment variable template
```
