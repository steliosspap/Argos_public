#!/bin/bash

# Argos OSINT Pipeline - Phase 2 Deployment Script
# Deploys all intelligence features

set -e

echo "==================================="
echo "Argos OSINT Phase 2 Deployment"
echo "==================================="

# Check for required environment variables
required_vars=(
    "POSTGRES_PASSWORD"
    "SUPABASE_URL"
    "SUPABASE_SERVICE_KEY"
    "OPENAI_API_KEY"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "Error: Missing required environment variables:"
    printf '%s\n' "${missing_vars[@]}"
    echo ""
    echo "Please set these in your .env file or export them."
    exit 1
fi

# Optional variables with defaults
export OPENAI_MODEL=${OPENAI_MODEL:-"gpt-4o"}
export HUGGINGFACE_API_KEY=${HUGGINGFACE_API_KEY:-""}

# Function to wait for service
wait_for_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    echo "Waiting for $service to be ready..."
    while ! nc -z localhost $port 2>/dev/null; do
        if [ $attempt -eq $max_attempts ]; then
            echo "Error: $service failed to start after $max_attempts attempts"
            exit 1
        fi
        echo "  Attempt $attempt/$max_attempts..."
        sleep 2
        ((attempt++))
    done
    echo "$service is ready!"
}

# Step 1: Build Phase 2 image
echo ""
echo "Step 1: Building Phase 2 Docker image..."
docker-compose -f docker-compose.phase2.yml build

# Step 2: Start infrastructure services
echo ""
echo "Step 2: Starting infrastructure services..."
docker-compose -f docker-compose.phase2.yml up -d postgres redis

# Wait for PostgreSQL
wait_for_service "PostgreSQL" 5432

# Step 3: Run database migrations
echo ""
echo "Step 3: Running database migrations..."
docker-compose -f docker-compose.phase2.yml run --rm osint-ingestion node scripts/migrate.js

# Apply Phase 2 specific migrations
echo "Applying Phase 2 intelligence migrations..."
docker-compose -f docker-compose.phase2.yml exec -T postgres psql -U osint_user -d osint_db < ../sql/add-phase2-intelligence.sql

# Step 4: Start all services
echo ""
echo "Step 4: Starting all Phase 2 services..."
docker-compose -f docker-compose.phase2.yml up -d

# Wait for services to be ready
wait_for_service "OSINT Ingestion" 3000
wait_for_service "Analytics API" 3001

# Step 5: Initialize Phase 2 features
echo ""
echo "Step 5: Initializing Phase 2 features..."

# Initialize bias detection sources
echo "Loading bias detection data..."
docker-compose -f docker-compose.phase2.yml exec osint-ingestion \
    node -e "import('./services/MediaBiasAnalyzer.js').then(m => m.mediabiasAnalyzer.loadSourceBiasFromDB())"

# Warm up ML models
echo "Warming up ML models..."
docker-compose -f docker-compose.phase2.yml exec osint-ingestion \
    node -e "import('./lib/multilingual-embeddings/multilingualEmbedder.js').then(m => m.multilingualEmbedder.initializeModels())"

# Step 6: Health check
echo ""
echo "Step 6: Running health checks..."
sleep 5

# Check main service
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✓ OSINT Ingestion service is healthy"
else
    echo "✗ OSINT Ingestion service health check failed"
fi

# Check analytics API
if curl -f http://localhost:3001/api/analytics > /dev/null 2>&1; then
    echo "✓ Analytics API is healthy"
else
    echo "✗ Analytics API health check failed"
fi

# Step 7: Display service info
echo ""
echo "==================================="
echo "Phase 2 Deployment Complete!"
echo "==================================="
echo ""
echo "Services running:"
echo "  - OSINT Ingestion: http://localhost:3000"
echo "  - Analytics API: http://localhost:3001"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "Phase 2 Features enabled:"
echo "  ✓ Bias Detection"
echo "  ✓ Entity Linking (Wikidata)"
echo "  ✓ Timeline Synthesis"
echo "  ✓ Multilingual Support"
echo "  ✓ Advanced Analytics"
echo ""
echo "View logs with:"
echo "  docker-compose -f docker-compose.phase2.yml logs -f"
echo ""
echo "Stop services with:"
echo "  docker-compose -f docker-compose.phase2.yml down"