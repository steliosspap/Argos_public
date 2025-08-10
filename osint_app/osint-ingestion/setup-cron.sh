#!/bin/bash

# ARGOS Cron Setup Script
# Sets up the intelligent ingestion to run every 30 minutes

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CRON_SCRIPT="$SCRIPT_DIR/cron-ingestion.sh"

echo "======================================"
echo "ARGOS Intelligent Ingestion Cron Setup"
echo "======================================"
echo ""

# Check if cron script exists
if [ ! -f "$CRON_SCRIPT" ]; then
    echo "ERROR: cron-ingestion.sh not found at $CRON_SCRIPT"
    exit 1
fi

# Make sure it's executable
chmod +x "$CRON_SCRIPT"

# Create the cron entry
CRON_ENTRY="*/30 * * * * $CRON_SCRIPT"

echo "This will add the following cron job:"
echo "$CRON_ENTRY"
echo ""
echo "This runs the intelligent ingestion every 30 minutes."
echo ""

read -p "Do you want to add this cron job? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Check if cron entry already exists
    if crontab -l 2>/dev/null | grep -q "$CRON_SCRIPT"; then
        echo "Cron job already exists. Updating..."
        # Remove old entry and add new one
        (crontab -l 2>/dev/null | grep -v "$CRON_SCRIPT"; echo "$CRON_ENTRY") | crontab -
    else
        echo "Adding new cron job..."
        (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    fi
    
    echo ""
    echo "✅ Cron job successfully configured!"
    echo ""
    echo "The ingestion will run every 30 minutes."
    echo "Logs will be stored in: $SCRIPT_DIR/logs/"
    echo ""
    echo "To view your cron jobs: crontab -l"
    echo "To remove this cron job: crontab -e (then delete the line)"
    echo ""
    echo "To test the ingestion manually, run:"
    echo "  cd $SCRIPT_DIR"
    echo "  ./cron-ingestion.sh"
else
    echo "Cron setup cancelled."
fi