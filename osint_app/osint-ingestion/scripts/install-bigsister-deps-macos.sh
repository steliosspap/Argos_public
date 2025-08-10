#!/bin/bash

# BigSister Dependencies Installation Script for macOS
# This script installs the system dependencies required for BigSister integration on macOS

echo "Installing BigSister system dependencies for macOS..."

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "Error: Homebrew is required but not installed."
    echo "Please install Homebrew from https://brew.sh"
    exit 1
fi

echo "Using Homebrew to install dependencies..."

# Install system tools
echo "Installing ExifTool..."
brew install exiftool

echo "Installing Steghide..."
# Steghide is not available in main Homebrew, try from a tap
if brew tap | grep -q "homebrew/cask"; then
    echo "Attempting to install steghide from alternative sources..."
fi

# Try to compile from source if available
if ! command -v steghide &> /dev/null; then
    echo "Warning: Steghide is not available via Homebrew for macOS."
    echo "You have several options:"
    echo "1. Use MacPorts: sudo port install steghide"
    echo "2. Compile from source: https://github.com/StefanoDeVuono/steghide"
    echo "3. Use Docker for steghide operations"
    echo ""
    echo "Note: The media analysis will work without steghide, but steganography detection will be limited."
fi

echo "Installing Binwalk..."
brew install binwalk

echo "Installing ImageMagick..."
brew install imagemagick

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Installing Python 3..."
    brew install python@3.11
fi

# Install Ruby gems
echo "Installing Ruby gem zsteg..."
if command -v gem &> /dev/null; then
    sudo gem install zsteg
else
    echo "Warning: Ruby gem command not found. Please install zsteg manually:"
    echo "  sudo gem install zsteg"
fi

# Create Python virtual environment for BigSister
echo "Setting up Python environment..."
VENV_PATH="./lib/BigSister/venv"
if [ ! -d "$VENV_PATH" ]; then
    python3 -m venv "$VENV_PATH"
fi

# Activate virtual environment and install Python packages
echo "Installing Python packages..."
source "$VENV_PATH/bin/activate"
pip install --upgrade pip
pip install \
    pillow \
    selenium \
    webdriver-manager \
    requests \
    beautifulsoup4 \
    lxml

# Deactivate virtual environment
deactivate

# Check for Chrome/Chromium
if ! command -v chromium &> /dev/null && ! command -v "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" &> /dev/null; then
    echo ""
    echo "Note: For reverse image search functionality, you'll need Chrome or Chromium."
    echo "You can install Chrome from: https://www.google.com/chrome/"
    echo "Or install Chromium with: brew install --cask chromium"
fi

echo ""
echo "BigSister dependencies installation complete!"
echo ""
echo "Installed tools:"

# Check what was successfully installed
check_tool() {
    if command -v $1 &> /dev/null; then
        echo "  ✓ $1 - $2"
    else
        echo "  ✗ $1 - $2 (installation may have failed)"
    fi
}

check_tool "exiftool" "Metadata extraction"
check_tool "steghide" "Steganography detection"
check_tool "binwalk" "Embedded file detection"
check_tool "zsteg" "PNG/BMP steganography"
check_tool "python3" "Python runtime"

echo ""
echo "Python packages installed in: $VENV_PATH"
echo ""
echo "To use BigSister features in the OSINT pipeline, run with:"
echo "  node cli-enhanced.js --enable-media-analysis"
echo ""
echo "For steganography detection:"
echo "  node cli-enhanced.js --enable-media-analysis --enable-steganography"
echo ""

# Verify Python environment
echo "Verifying Python environment..."
source "$VENV_PATH/bin/activate"
python3 -c "import PIL, selenium, bs4, lxml, requests; print('✓ All Python packages verified')" 2>/dev/null || echo "✗ Some Python packages may be missing"
deactivate