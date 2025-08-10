#!/bin/bash

# ARGOS Intelligent Ingestion Cron Script
# Runs the intelligent ingestion pipeline every 30 minutes

# Set the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/ingestion-$(date +%Y%m%d).log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Start logging
log "========================================="
log "Starting intelligent ingestion pipeline"

# Change to the ingestion directory
cd "$SCRIPT_DIR" || exit 1

# Check if node is available
if ! command -v node &> /dev/null; then
    log "ERROR: Node.js is not installed or not in PATH"
    exit 1
fi

# Run the intelligent ingestion
log "Running intelligent ingestion..."
node intelligent-ingestion.js --limit 50 2>&1 | while IFS= read -r line; do
    log "$line"
done

# Check exit status
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    log "Ingestion completed successfully"
else
    log "ERROR: Ingestion failed with exit code ${PIPESTATUS[0]}"
fi

# Rotate logs - keep only last 7 days
find "$LOG_DIR" -name "ingestion-*.log" -mtime +7 -delete

log "Pipeline execution finished"
log "========================================="