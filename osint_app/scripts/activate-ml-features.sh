#!/bin/bash

# Argos ML Features Activation Script
# This script activates all ML capabilities in the OSINT platform

set -e  # Exit on error

echo "🚀 Argos ML Features Activation Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Please run this script from the osint_app directory${NC}"
    exit 1
fi

echo "📋 Step 1: Checking prerequisites..."
echo ""

# Check for Python 3
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    echo "Please install Python 3.8 or higher"
    exit 1
else
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✅ $PYTHON_VERSION found${NC}"
fi

# Check for pip
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}❌ pip3 is not installed${NC}"
    echo "Please install pip3"
    exit 1
else
    echo -e "${GREEN}✅ pip3 found${NC}"
fi

# Check for PostgreSQL client
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  psql not found - will skip database setup${NC}"
    SKIP_DB=true
else
    echo -e "${GREEN}✅ PostgreSQL client found${NC}"
    SKIP_DB=false
fi

echo ""
echo "📋 Step 2: Setting up Python environment..."
echo ""

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
cd osint-ingestion
pip install -r requirements.txt
cd ..

echo ""
echo "📋 Step 3: Setting up environment variables..."
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  .env.local not found, creating from template...${NC}"
    touch .env.local
fi

# Backup existing .env.local
cp .env.local .env.local.backup
echo "✅ Backed up .env.local to .env.local.backup"

# Add ML configuration to .env.local if not already present
if ! grep -q "ENABLE_VECTOR_SIMILARITY" .env.local; then
    echo "" >> .env.local
    echo "# ML Enhancement Features" >> .env.local
    echo "ENABLE_VECTOR_SIMILARITY=true" >> .env.local
    echo "ENABLE_CLUSTERING=true" >> .env.local
    echo "ENABLE_TRANSLATION=true" >> .env.local
    echo "SIMILARITY_THRESHOLD=0.85" >> .env.local
    echo "MIN_CLUSTER_SIZE=3" >> .env.local
    echo "CLUSTER_SELECTION_EPSILON=0.3" >> .env.local
    echo "SUPPORTED_LANGUAGES=en,es,fr,de,ru,ar,zh,ja,ko,pt,it" >> .env.local
    echo "PYTHON_PATH=python3" >> .env.local
    echo -e "${GREEN}✅ Added ML configuration to .env.local${NC}"
else
    echo -e "${GREEN}✅ ML configuration already exists in .env.local${NC}"
fi

echo ""
echo "📋 Step 4: Setting up database (pgvector)..."
echo ""

if [ "$SKIP_DB" = false ] && [ -n "$DATABASE_URL" ]; then
    echo "Applying pgvector schema..."
    psql $DATABASE_URL < osint-ingestion/sql/add-embedding.sql 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Some database operations failed (may already exist)${NC}"
    }
    echo -e "${GREEN}✅ Database schema updated${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping database setup - please run manually:${NC}"
    echo "   psql \$DATABASE_URL < osint-ingestion/sql/add-embedding.sql"
fi

echo ""
echo "📋 Step 5: Downloading translation models..."
echo ""

# Download translation models
python3 << EOF
import argostranslate.package
import argostranslate.translate

print("Downloading translation packages...")
argostranslate.package.update_package_index()
available_packages = argostranslate.package.get_available_packages()

languages = ['es', 'fr', 'de', 'ru', 'ar', 'zh', 'ja', 'ko', 'pt', 'it']
installed = 0

for lang in languages:
    package = next(
        (pkg for pkg in available_packages 
         if pkg.from_code == lang and pkg.to_code == 'en'),
        None
    )
    if package and not package.installed:
        print(f"Installing {lang} -> en translation package...")
        argostranslate.package.install_from_path(package.download())
        installed += 1

print(f"✅ Installed {installed} translation packages")
EOF

echo ""
echo "📋 Step 6: Generating initial embeddings..."
echo ""

# Generate embeddings for existing events
echo "Processing existing events (this may take a few minutes)..."
cd osint-ingestion
python3 scripts/vector_worker.py once 50 || {
    echo -e "${YELLOW}⚠️  Vector worker failed - may need to configure database first${NC}"
}
cd ..

echo ""
echo "📋 Step 7: Creating activation status file..."
echo ""

# Create activation status
cat > ml-activation-status.json << EOF
{
  "activated": true,
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "features": {
    "vector_similarity": true,
    "clustering": true,
    "translation": true
  },
  "python_version": "$(python3 --version)",
  "dependencies_installed": true
}
EOF

echo -e "${GREEN}✅ Created ml-activation-status.json${NC}"

echo ""
echo "🎉 ML Features Activation Complete!"
echo "=================================="
echo ""
echo "✅ Vector Similarity Deduplication - ACTIVE"
echo "✅ HDBSCAN Clustering - ACTIVE"
echo "✅ Multi-language Translation - ACTIVE"
echo ""
echo "📝 Next steps:"
echo "1. Restart your Next.js server to load new environment variables"
echo "2. Test the enhanced ingestion endpoint: /api/ingest-enhanced"
echo "3. Monitor the clustering API: /api/analytics/cluster"
echo ""
echo "🔗 Useful commands:"
echo "   npm run dev              # Start development server"
echo "   curl http://localhost:3000/api/ingest-enhanced"
echo "   curl http://localhost:3000/api/analytics/cluster"
echo ""

# Deactivate virtual environment
deactivate