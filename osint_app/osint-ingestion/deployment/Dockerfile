FROM node:20-alpine

# Install dependencies for potential native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p logs reports

# Make CLI executable
RUN chmod +x cli.js

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose health check endpoint (if we add one later)
EXPOSE 3000

# Default command
CMD ["node", "cli.js", "monitor", "--interval", "15", "--alerts"]