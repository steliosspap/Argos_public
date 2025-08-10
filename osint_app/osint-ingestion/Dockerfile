# Argos Enhanced Pipeline - Production Dockerfile
FROM node:20-alpine

# Install Python for ML features
RUN apk add --no-cache python3 py3-pip python3-dev build-base

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm ci --only=production

# Copy Python requirements if they exist
COPY requirements.txt* ./

# Install Python dependencies
RUN if [ -f requirements.txt ]; then pip3 install -r requirements.txt; fi

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs cache output

# Set Python path
ENV PYTHONPATH=/app:$PYTHONPATH
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD node health-check.js || exit 1

# Default command - monitor mode with alerts
CMD ["node", "cli-enhanced.js", "monitor", "--interval", "15", "--alerts"]