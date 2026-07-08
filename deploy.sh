#!/bin/bash

# AI Tutor AWS Lightsail Auto-Deployment Script for Ubuntu 22.04 LTS
# Designed by Antigravity AI Coding Assistant

echo "=================================================="
echo "   AI Tutor AWS Lightsail Auto-Deployment Tool   "
echo "=================================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this script with sudo."
  echo "Example: sudo ./deploy.sh"
  exit 1
fi

# Detect actual user and home directory
ACTUAL_USER=${SUDO_USER:-$USER}
USER_HOME=$(eval echo ~$ACTUAL_USER)
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing system updates and required packages..."
apt-get update -y
apt-get install -y python3 python3-pip python3-venv git curl

echo "Setting up Python Virtual Environment..."
cd "$APP_DIR"
python3 -m venv venv
venv/bin/pip install --upgrade pip
venv/bin/pip install -r requirements.txt

# Prompt for Gemini API Keys if .env does not exist
if [ ! -f .env ]; then
    echo ""
    echo "--- Gemini API Configuration ---"
    read -p "Enter your primary GEMINI_API_KEY (or press Enter to skip): " gemini_key
    read -p "Enter your secondary GEMINI_API_KEY_FREE2 (optional): " gemini_key_2
    read -p "Enter your paid GEMINI_API_KEY_PAID (optional): " gemini_key_paid

    echo "# AI Tutor Environment Configuration" > .env
    if [ ! -z "$gemini_key" ]; then
        echo "GEMINI_API_KEY=$gemini_key" >> .env
        echo "GEMINI_API_KEY_FREE1=$gemini_key" >> .env
    fi
    if [ ! -z "$gemini_key_2" ]; then
        echo "GEMINI_API_KEY_FREE2=$gemini_key_2" >> .env
    fi
    if [ ! -z "$gemini_key_paid" ]; then
        echo "GEMINI_API_KEY_PAID=$gemini_key_paid" >> .env
    fi
    echo "Explanations cache and keys configured in .env."
fi

# Correct permissions of the directory to allow user edits
chown -R $ACTUAL_USER:$ACTUAL_USER "$APP_DIR"

echo "Creating systemd Service configuration..."
SERVICE_FILE="/etc/systemd/system/aitutor.service"

cat <<EOT > $SERVICE_FILE
[Unit]
Description=AI Tutor FastAPI Web Service
After=network.target

[Service]
User=root
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/venv/bin/uvicorn server:app --host 0.0.0.0 --port 80
Restart=always
RestartSec=5
Environment=PATH=$APP_DIR/venv/bin:/usr/bin:/usr/local/bin

[Install]
WantedBy=multi-user.target
EOT

echo "Reloading systemd daemon and starting AI Tutor Service..."
systemctl daemon-reload
systemctl enable aitutor
systemctl restart aitutor

# Fetch public IP
PUBLIC_IP=$(curl -s https://api.ipify.org)

echo ""
echo "=================================================="
echo "🎉 AI Tutor Deployment Completed Successfully!"
echo "=================================================="
echo "  - Service Status: Running in background"
echo "  - Port: 80 (Standard Web Port)"
echo "  - Access URL: http://$PUBLIC_IP"
echo "=================================================="
echo "To check logs, run: sudo journalctl -u aitutor -f"
echo "To restart service: sudo systemctl restart aitutor"
echo "=================================================="
