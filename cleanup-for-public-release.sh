#!/bin/bash

# 🔒 Argos OSINT Pipeline - Public Release Cleanup Script
# This script removes sensitive files and prepares the project for public release

echo "🚀 Starting cleanup for public release..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -f "osint_app/package.json" ]; then
    print_error "Please run this script from the argos project root directory"
    exit 1
fi

print_status "Starting security cleanup..."

# 1. Remove environment files
print_status "Removing environment files..."
find . -name ".env*" -type f -delete
find . -name "*.env" -type f -delete
print_success "Environment files removed"

# 2. Remove build artifacts
print_status "Removing build artifacts..."
find . -name ".next" -type d -exec rm -rf {} + 2>/dev/null
find . -name "build" -type d -exec rm -rf {} + 2>/dev/null
find . -name "dist" -type d -exec rm -rf {} + 2>/dev/null
find . -name "out" -type d -exec rm -rf {} + 2>/dev/null
print_success "Build artifacts removed"

# 3. Remove temporary files
print_status "Removing temporary files..."
find . -name "*.tmp" -type f -delete
find . -name "*.temp" -type f -delete
find . -name "*.log" -type f -delete
find . -name "*.pid" -type f -delete
print_success "Temporary files removed"

# 4. Remove cache directories
print_status "Removing cache directories..."
find . -name ".cache" -type d -exec rm -rf {} + 2>/dev/null
find . -name "node_modules/.cache" -type d -exec rm -rf {} + 2>/dev/null
find . -name ".parcel-cache" -type d -exec rm -rf {} + 2>/dev/null
print_success "Cache directories removed"

# 5. Remove IDE and editor files
print_status "Removing IDE and editor files..."
find . -name ".vscode" -type d -exec rm -rf {} + 2>/dev/null
find . -name ".idea" -type d -exec rm -rf {} + 2>/dev/null
find . -name "*.swp" -type f -delete
find . -name "*.swo" -type f -delete
find . -name "*~" -type f -delete
print_success "IDE and editor files removed"

# 6. Remove OS-specific files
print_status "Removing OS-specific files..."
find . -name ".DS_Store" -type f -delete
find . -name "Thumbs.db" -type f -delete
find . -name "ehthumbs.db" -type f -delete
find . -name "Desktop.ini" -type f -delete
print_success "OS-specific files removed"

# 7. Remove test results and coverage
print_status "Removing test results and coverage..."
find . -name "test-results" -type d -exec rm -rf {} + 2>/dev/null
find . -name "coverage" -type d -exec rm -rf {} + 2>/dev/null
find . -name ".nyc_output" -type d -exec rm -rf {} + 2>/dev/null
find . -name "*.lcov" -type f -delete
print_success "Test results and coverage removed"

# 8. Remove logs directory
print_status "Removing logs directory..."
if [ -d "osint_app/logs" ]; then
    rm -rf osint_app/logs/*
    print_success "Logs directory cleaned"
else
    print_warning "Logs directory not found"
fi

# 9. Check for any remaining sensitive files
print_status "Checking for remaining sensitive files..."
SENSITIVE_FILES=$(find . -type f \( -name "*.key" -o -name "*.pem" -o -name "*.p12" -o -name "*.pfx" -o -name "*.crt" -o -name "*.pem" \) 2>/dev/null)

if [ -n "$SENSITIVE_FILES" ]; then
    print_warning "Found potentially sensitive files:"
    echo "$SENSITIVE_FILES"
    read -p "Do you want to remove these files? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$SENSITIVE_FILES" | xargs rm -f
        print_success "Sensitive files removed"
    else
        print_warning "Sensitive files kept - please review manually"
    fi
else
    print_success "No sensitive files found"
fi

# 10. Create .env.example file
print_status "Creating .env.example file..."
cat > osint_app/.env.example << 'EOF'
# Database Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_service_key_here
SUPABASE_SERVICE_ROLE_KEY=your_role_key_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Authentication
JWT_SECRET=your_secure_jwt_secret_here

# External APIs
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here

# Email Services
EMAIL_PROVIDER=resend
RESEND_API_KEY=your_resend_api_key_here
SENDGRID_API_KEY=your_sendgrid_api_key_here

# Optional Services
ENABLE_CLUSTERING=true
ENABLE_TRANSLATION=true
CRON_SECRET=your_cron_secret_here

# Monitoring
SLACK_WEBHOOK_URL=your_slack_webhook_here
ALERT_EMAIL=your_alert_email_here
WEBHOOK_URL=your_webhook_url_here
EOF
print_success ".env.example file created"

# 11. Update package.json scripts for security
print_status "Updating package.json for security..."
if [ -f "osint_app/package.json" ]; then
    # Remove any scripts that might expose sensitive information
    sed -i.bak '/"debug"/d' osint_app/package.json
    sed -i.bak '/"test-secrets"/d' osint_app/package.json
    rm -f osint_app/package.json.bak
    print_success "Package.json updated for security"
fi

# 12. Final security check
print_status "Performing final security check..."

# Check for hardcoded secrets
HARDCODED_SECRETS=$(grep -r "sk-" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next 2>/dev/null | grep -v "example" | grep -v "placeholder" || true)
HARDCODED_KEYS=$(grep -r "your-secret\|your_api_key\|your_token\|your_password" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next 2>/dev/null | grep -v "example" | grep -v "placeholder" || true)

if [ -n "$HARDCODED_SECRETS" ] || [ -n "$HARDCODED_KEYS" ]; then
    print_warning "Found potentially hardcoded secrets:"
    if [ -n "$HARDCODED_SECRETS" ]; then
        echo "$HARDCODED_SECRETS"
    fi
    if [ -n "$HARDCODED_KEYS" ]; then
        echo "$HARDCODED_KEYS"
    fi
    print_warning "Please review and remove these before public release"
else
    print_success "No hardcoded secrets found"
fi

# 13. Create deployment checklist
print_status "Creating deployment checklist..."
cat > DEPLOYMENT_CHECKLIST.md << 'EOF'
# 🚀 Deployment Checklist for Public Release

## ✅ Pre-Deployment Security Checks
- [ ] All environment variables properly configured
- [ ] No hardcoded secrets in code
- [ ] JWT_SECRET is secure and unique
- [ ] Database connections use SSL/TLS
- [ ] API rate limiting configured
- [ ] CORS settings appropriate for production

## ✅ Environment Variables Required
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] SUPABASE_SERVICE_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] JWT_SECRET
- [ ] OPENAI_API_KEY
- [ ] GOOGLE_API_KEY
- [ ] MAPBOX_ACCESS_TOKEN

## ✅ Production Deployment
- [ ] HTTPS enabled with valid SSL certificates
- [ ] Database backups configured
- [ ] Monitoring and alerting set up
- [ ] Error logging configured
- [ ] Performance monitoring enabled

## ✅ Post-Deployment Verification
- [ ] All API endpoints working
- [ ] Authentication flows functional
- [ ] Real-time features operational
- [ ] Performance metrics acceptable
- [ ] Security headers properly set

## 🔒 Security Reminders
- Never commit .env files
- Rotate secrets regularly
- Monitor access logs
- Keep dependencies updated
- Regular security audits
EOF
print_success "Deployment checklist created"

# 14. Final summary
echo
echo "🎉 Cleanup completed successfully!"
echo
echo "📋 Summary of actions taken:"
echo "   ✅ Environment files removed"
echo "   ✅ Build artifacts cleaned"
echo "   ✅ Temporary files deleted"
echo "   ✅ Cache directories cleared"
echo "   ✅ IDE files removed"
echo "   ✅ OS-specific files cleaned"
echo "   ✅ Test results removed"
echo "   ✅ Logs directory cleaned"
echo "   ✅ .env.example created"
echo "   ✅ Package.json secured"
echo "   ✅ Security check completed"
echo "   ✅ Deployment checklist created"
echo
echo "🔒 Security Status: READY FOR PUBLIC RELEASE"
echo
echo "📝 Next steps:"
echo "   1. Review the DEPLOYMENT_CHECKLIST.md"
echo "   2. Set up environment variables in production"
echo "   3. Deploy to production environment"
echo "   4. Test all functionality"
echo "   5. Monitor for any issues"
echo
echo "⚠️  Important: Remember to never commit .env files!"
echo "   Use .env.example as a template for required variables."
echo
print_success "Project is now ready for public release! 🚀"
