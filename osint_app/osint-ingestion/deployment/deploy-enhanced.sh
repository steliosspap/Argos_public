#!/bin/bash

# Enhanced OSINT Pipeline Deployment Script
# Usage: ./deploy-enhanced.sh [production|staging|local]

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/.."

echo "🚀 Deploying Enhanced OSINT Pipeline - Environment: $ENVIRONMENT"
echo "📍 Script directory: $SCRIPT_DIR"
echo "📁 Project root: $PROJECT_ROOT"

# Check if required files exist
if [ ! -f "$SCRIPT_DIR/.env.$ENVIRONMENT" ]; then
    echo "❌ Error: .env.$ENVIRONMENT file not found!"
    echo "Please copy .env.production.example to .env.$ENVIRONMENT and configure it."
    exit 1
fi

# Function to check dependencies
check_dependencies() {
    echo "🔍 Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed"
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        echo "❌ Python 3 is not installed"
        exit 1
    fi
    
    # Check Docker (for production)
    if [ "$ENVIRONMENT" = "production" ] && ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed"
        exit 1
    fi
    
    echo "✅ All dependencies satisfied"
}

# Function to install Python dependencies
install_python_deps() {
    echo "🐍 Installing Python dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install requirements
    pip install -r requirements.txt
    
    # Install Git LFS if needed
    if ! command -v git-lfs &> /dev/null; then
        echo "📥 Installing Git LFS..."
        curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash
        sudo apt-get install git-lfs
        git lfs install
    fi
    
    # Clone and setup dependencies
    echo "📚 Setting up library dependencies..."
    
    # Download sentence-transformers models
    python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"
    
    # Setup Argos Translate packages
    python -c "import argostranslate.package; argostranslate.package.update_package_index()"
    
    deactivate
}

# Function to run database migrations
run_migrations() {
    echo "🗄️  Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    # Check if database is accessible
    if ! node scripts/check-database.js &> /dev/null; then
        echo "❌ Cannot connect to database. Please check your DATABASE_URL"
        exit 1
    fi
    
    # Run pgvector migration
    echo "  → Adding pgvector extension..."
    node scripts/run-migration.js sql/add-embedding.sql
    
    # Run other migrations
    for migration in sql/*.sql; do
        if [[ "$migration" != "sql/add-embedding.sql" ]]; then
            echo "  → Running migration: $(basename $migration)"
            node scripts/run-migration.js "$migration"
        fi
    done
    
    echo "✅ Migrations complete"
}

# Function to deploy with Docker (enhanced)
deploy_docker_enhanced() {
    echo "📦 Building enhanced Docker images..."
    
    cd "$SCRIPT_DIR"
    
    # Use enhanced docker-compose
    docker-compose -f docker-compose.enhanced.yml build
    
    echo "🔄 Stopping existing containers..."
    docker-compose -f docker-compose.enhanced.yml down
    
    echo "🚀 Starting new containers..."
    docker-compose -f docker-compose.enhanced.yml up -d
    
    # Wait for services to be healthy
    echo "⏳ Waiting for services to be healthy..."
    sleep 10
    
    # Check health
    if docker-compose -f docker-compose.enhanced.yml ps | grep -q "unhealthy"; then
        echo "❌ Some services are unhealthy!"
        docker-compose -f docker-compose.enhanced.yml ps
        exit 1
    fi
    
    echo "✅ Enhanced Docker deployment complete!"
    echo ""
    echo "📊 Services running:"
    echo "  - OSINT Pipeline: http://localhost:3000"
    echo "  - API Server: http://localhost:3001"
    echo "  - PostgreSQL: localhost:5432"
    echo ""
    echo "📝 View logs:"
    echo "  - All: docker-compose -f docker-compose.enhanced.yml logs -f"
    echo "  - Pipeline: docker-compose -f docker-compose.enhanced.yml logs -f osint-pipeline"
    echo "  - API: docker-compose -f docker-compose.enhanced.yml logs -f api-server"
}

# Function to deploy locally (enhanced)
deploy_local_enhanced() {
    echo "📦 Installing Node.js dependencies..."
    cd "$PROJECT_ROOT"
    npm install
    
    # Install Python dependencies
    install_python_deps
    
    # Install snscrape
    echo "📱 Installing snscrape..."
    pip3 install --user snscrape
    
    # Run migrations
    run_migrations
    
    echo "🧪 Running tests..."
    npm test || true
    
    # Start services
    echo "🚀 Starting services..."
    
    # Start vector worker in background
    echo "  → Starting vector worker..."
    source venv/bin/activate
    python scripts/vector_worker.py once 100 &
    VECTOR_PID=$!
    deactivate
    
    # Start API server in background
    echo "  → Starting API server..."
    node api/server.js &
    API_PID=$!
    
    # Wait for API to be ready
    sleep 5
    
    # Start main pipeline
    echo "  → Starting enhanced pipeline..."
    node cli-enhanced.js monitor --verbose
    
    # Cleanup on exit
    trap "kill $VECTOR_PID $API_PID" EXIT
}

# Function to run health checks
run_health_checks() {
    echo "🏥 Running health checks..."
    
    cd "$PROJECT_ROOT"
    
    # Check database
    if node scripts/check-database.js; then
        echo "  ✅ Database connection OK"
    else
        echo "  ❌ Database connection FAILED"
        return 1
    fi
    
    # Check API server
    if curl -f http://localhost:3001/health &> /dev/null; then
        echo "  ✅ API server OK"
    else
        echo "  ❌ API server FAILED"
        return 1
    fi
    
    # Check vector embeddings
    if node -e "require('./services/SimilarityService.js').similarityService.generateMissingEmbeddings(1)"; then
        echo "  ✅ Vector embeddings OK"
    else
        echo "  ❌ Vector embeddings FAILED"
        return 1
    fi
    
    echo "✅ All health checks passed"
}

# Main deployment logic
check_dependencies

case $ENVIRONMENT in
    production)
        echo "🏭 Production deployment using enhanced Docker..."
        deploy_docker_enhanced
        ;;
    staging)
        echo "🧪 Staging deployment..."
        install_python_deps
        run_migrations
        deploy_docker_enhanced
        ;;
    local)
        echo "💻 Local development deployment..."
        deploy_local_enhanced
        ;;
    *)
        echo "❌ Unknown environment: $ENVIRONMENT"
        echo "Usage: ./deploy-enhanced.sh [production|staging|local]"
        exit 1
        ;;
esac

# Run health checks after deployment
sleep 10
if run_health_checks; then
    echo "
✨ Enhanced deployment complete!

🎯 Quick Start Commands:
1. Semantic search test:
   curl -X POST http://localhost:3001/api/searches/semantic \\
     -H 'Content-Type: application/json' \\
     -d '{\"query\": \"missile strikes in Ukraine\"}'

2. Monitor pipeline:
   ./cli-enhanced.js monitor --verbose

3. Generate embeddings for existing events:
   python scripts/vector_worker.py once 1000

4. View API documentation:
   open http://localhost:3001/docs

5. Check system status:
   docker-compose -f docker-compose.enhanced.yml ps

📊 Performance Tips:
- Use pgvector indexes for fast similarity search
- Enable Redis caching for frequent queries
- Run vector worker on GPU for faster embeddings
"
else
    echo "
⚠️  Deployment completed with warnings!

Some health checks failed. Please check:
1. Database connectivity
2. API server status
3. Vector embedding service

Run './deploy-enhanced.sh local' for detailed error messages.
"
fi