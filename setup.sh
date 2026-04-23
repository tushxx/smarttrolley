#!/bin/bash
# ==============================================================
#  SmartTrolley — One-time setup script
#  Run this after cloning:  bash setup.sh
# ==============================================================

set -e

echo "🛒 SmartTrolley Setup"
echo "====================="

# ── 1. Node.js dependencies ──────────────────────────────────────
echo ""
echo "📦 Installing Node.js dependencies..."
npm install

# ── 2. Python dependencies ───────────────────────────────────────
echo ""
echo "🐍 Installing Python dependencies..."
if command -v pip3 &> /dev/null; then
    pip3 install -r requirements.txt
elif command -v pip &> /dev/null; then
    pip install -r requirements.txt
else
    echo "⚠️  pip not found. Please install Python 3 and pip, then run:"
    echo "   pip install -r requirements.txt"
fi

# ── 3. Environment file ─────────────────────────────────────────
echo ""
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env from .env.example"
    echo "   ⚠️  Please edit .env and add your actual keys!"
else
    echo "✅ .env already exists"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the app:  npm run dev"
echo ""
