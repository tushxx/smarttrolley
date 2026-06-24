#!/bin/bash
# ==============================================================
#  SmartTrolley — One-time setup script
#  Run this after cloning:  bash setup.sh
# ==============================================================

set -e

echo "🛒 SmartTrolley Setup"
echo "====================="

# Check if running inside a virtual environment (recommended for Raspberry Pi Bookworm)
if [ -z "$VIRTUAL_ENV" ]; then
    echo "⚠️  Python virtual environment not detected!"
    echo "   On Raspberry Pi OS (Bookworm and newer), you should use a virtual environment."
    echo "   Please run the following commands instead:"
    echo "     python3 -m venv venv"
    echo "     source venv/bin/activate"
    echo "     bash setup.sh"
    echo ""
    exit 1
fi

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
