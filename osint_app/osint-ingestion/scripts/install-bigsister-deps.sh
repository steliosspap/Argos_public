#!/bin/bash

# BigSister Dependencies Installation Script
# This script installs the system dependencies required for BigSister integration

echo "Installing BigSister system dependencies..."

# Check if running on a Debian-based system
if ! command -v apt-get &> /dev/null; then
    echo "Warning: This script is designed for Debian-based systems (Ubuntu, Kali, etc.)"
    echo "For other systems, please install the following manually:"
    echo "  - exiftool"
    echo "  - steghide"
    echo "  - binwalk"
    echo "  - zsteg (Ruby gem)"
    echo "  - Python 3.8+"
    echo "  - Python packages: pillow, selenium, beautifulsoup4, lxml, requests"
    exit 1
fi

# Update package lists
echo "Updating package lists..."
sudo apt update

# Install core system tools
echo "Installing system tools..."
sudo apt install -y \
    exiftool \
    steghide \
    binwalk \
    python3 \
    python3-pip \
    python3-venv \
    imagemagick-6.q16 \
    ruby \
    ruby-dev \
    build-essential

# Install Ruby dependencies
echo "Installing Ruby gems..."
sudo gem install zsteg

# Create Python virtual environment for BigSister
echo "Setting up Python environment..."
VENV_PATH="./lib/BigSister/venv"
if [ ! -d "$VENV_PATH" ]; then
    python3 -m venv "$VENV_PATH"
fi

# Activate virtual environment and install Python packages
source "$VENV_PATH/bin/activate"
pip install --upgrade pip
pip install \
    pillow \
    selenium \
    webdriver-manager \
    requests \
    beautifulsoup4 \
    lxml

# Check if Chrome/Chromium is installed for Selenium
if ! command -v chromium-browser &> /dev/null && ! command -v google-chrome &> /dev/null; then
    echo "Installing Chromium for reverse image search..."
    sudo apt install -y chromium-browser chromium-chromedriver
fi

echo ""
echo "BigSister dependencies installation complete!"
echo ""
echo "Installed tools:"
echo "  ✓ exiftool - Metadata extraction"
echo "  ✓ steghide - Steganography detection"
echo "  ✓ binwalk - Embedded file detection"
echo "  ✓ zsteg - PNG/BMP steganography"
echo "  ✓ Python environment with required packages"
echo ""
echo "To use BigSister features in the OSINT pipeline, run with:"
echo "  node cli-enhanced.js --enable-media-analysis"
echo ""
echo "For steganography detection:"
echo "  node cli-enhanced.js --enable-media-analysis --enable-steganography"
echo ""

# Make script executable
chmod +x "$0"