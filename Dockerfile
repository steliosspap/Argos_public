# Argos Enhanced Pipeline - Production Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy the osint-ingestion directory contents
COPY osint_app/osint-ingestion/package.json ./package.json

# Install Node dependencies
RUN npm install --production=false

# Copy all application files from osint-ingestion
COPY osint_app/osint-ingestion/ ./

# List files to verify (for debugging)
RUN ls -la && ls -la services/ && ls -la core/

# Create necessary directories
RUN mkdir -p logs cache output

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Default command - monitor mode with alerts
CMD ["node", "cli-enhanced.js", "monitor", "--interval", "15", "--alerts"]