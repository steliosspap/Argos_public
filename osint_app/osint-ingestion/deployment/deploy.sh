#!/bin/bash

# OSINT Pipeline Deployment Script
# Usage: ./deploy.sh [production|staging|local]

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "🚀 Deploying OSINT Pipeline - Environment: $ENVIRONMENT"

# Check if required files exist
if [ ! -f "$SCRIPT_DIR/.env.$ENVIRONMENT" ]; then
    echo "❌ Error: .env.$ENVIRONMENT file not found!"
    echo "Please copy .env.production.example to .env.$ENVIRONMENT and configure it."
    exit 1
fi

# Function to deploy with Docker
deploy_docker() {
    echo "📦 Building Docker image..."
    docker-compose -f docker-compose.yml build
    
    echo "🔄 Stopping existing containers..."
    docker-compose down
    
    echo "🚀 Starting new containers..."
    docker-compose up -d
    
    echo "✅ Docker deployment complete!"
    echo "View logs: docker-compose logs -f osint-pipeline"
}

# Function to deploy with systemd
deploy_systemd() {
    echo "📦 Installing dependencies..."
    npm ci --production
    
    echo "🔧 Installing systemd service..."
    sudo cp argos-ingestion.service /etc/systemd/system/
    sudo cp argos-ingestion.timer /etc/systemd/system/
    
    # Update service file with correct paths
    sudo sed -i "s|/path/to/osint-ingestion|$SCRIPT_DIR|g" /etc/systemd/system/argos-ingestion.service
    
    echo "🔄 Reloading systemd..."
    sudo systemctl daemon-reload
    
    echo "🚀 Starting service..."
    sudo systemctl enable argos-ingestion.timer
    sudo systemctl start argos-ingestion.timer
    
    echo "✅ Systemd deployment complete!"
    echo "Check status: sudo systemctl status argos-ingestion.timer"
}

# Function to deploy locally
deploy_local() {
    echo "📦 Installing dependencies..."
    npm install
    
    echo "🧪 Running tests..."
    node test-setup.js
    
    echo "🚀 Starting in development mode..."
    npm run monitor
}

# Main deployment logic
case $ENVIRONMENT in
    production)
        echo "🏭 Production deployment using Docker..."
        deploy_docker
        ;;
    staging)
        echo "🧪 Staging deployment using systemd..."
        deploy_systemd
        ;;
    local)
        echo "💻 Local development deployment..."
        deploy_local
        ;;
    *)
        echo "❌ Unknown environment: $ENVIRONMENT"
        echo "Usage: ./deploy.sh [production|staging|local]"
        exit 1
        ;;
esac

echo "
✨ Deployment complete!

Next steps:
1. Monitor the pipeline: ./cli.js monitor --verbose
2. Check logs: tail -f logs/ingestion.log
3. View events: ./cli.js events --days 1
4. Check system health: node test-setup.js
"