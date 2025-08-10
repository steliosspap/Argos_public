#!/bin/bash

# Argos Enhanced Pipeline - Server Deployment Script
# This script prepares and deploys the enhanced pipeline to a production server

set -e

echo "🚀 Argos Enhanced Pipeline - Server Deployment"
echo "============================================="
echo ""

# Configuration
REPO_URL="https://github.com/steliosspap/argos.git"
DEPLOY_DIR="/opt/argos"
DOCKER_COMPOSE_FILE="docker-compose.enhanced.yml"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install Docker
install_docker() {
    echo -e "${YELLOW}📦 Installing Docker...${NC}"
    
    # Update package index
    sudo apt-get update
    
    # Install dependencies
    sudo apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Set up stable repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Start and enable Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    echo -e "${GREEN}✅ Docker installed successfully${NC}"
}

# Function to setup firewall
setup_firewall() {
    echo -e "${YELLOW}🔒 Setting up firewall...${NC}"
    
    # Install ufw if not present
    sudo apt-get install -y ufw
    
    # Allow SSH (change port if you use non-standard)
    sudo ufw allow 22/tcp
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Allow API port
    sudo ufw allow 3001/tcp
    
    # Enable firewall
    sudo ufw --force enable
    
    echo -e "${GREEN}✅ Firewall configured${NC}"
}

# Function to setup swap (for low memory servers)
setup_swap() {
    echo -e "${YELLOW}💾 Setting up swap space...${NC}"
    
    # Check if swap exists
    if [ $(swapon -s | wc -l) -eq 1 ]; then
        # Create 4GB swap file
        sudo fallocate -l 4G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        
        # Make permanent
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
        
        # Optimize swappiness
        echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
        
        echo -e "${GREEN}✅ 4GB swap space created${NC}"
    else
        echo -e "${GREEN}✅ Swap already configured${NC}"
    fi
}

# Function to clone repository
clone_repository() {
    echo -e "${YELLOW}📥 Cloning repository...${NC}"
    
    # Remove existing directory if present
    if [ -d "$DEPLOY_DIR" ]; then
        sudo rm -rf "$DEPLOY_DIR"
    fi
    
    # Clone repository
    sudo git clone "$REPO_URL" "$DEPLOY_DIR"
    
    # Set permissions
    sudo chown -R $USER:$USER "$DEPLOY_DIR"
    
    echo -e "${GREEN}✅ Repository cloned${NC}"
}

# Function to setup environment
setup_environment() {
    echo -e "${YELLOW}🔧 Setting up environment...${NC}"
    
    cd "$DEPLOY_DIR/osint_app/osint-ingestion"
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        cp .env.example .env 2>/dev/null || touch .env
        echo -e "${YELLOW}⚠️  Please configure .env file with your API keys${NC}"
    fi
    
    # Create necessary directories
    mkdir -p logs
    mkdir -p cache
    mkdir -p output
    
    echo -e "${GREEN}✅ Environment prepared${NC}"
}

# Function to setup systemd service
setup_systemd_service() {
    echo -e "${YELLOW}🔧 Setting up systemd service...${NC}"
    
    # Create systemd service file
    sudo tee /etc/systemd/system/argos-pipeline.service > /dev/null <<EOF
[Unit]
Description=Argos Enhanced OSINT Pipeline
Requires=docker.service
After=docker.service

[Service]
Type=simple
Restart=always
RestartSec=10
WorkingDirectory=$DEPLOY_DIR/osint_app/osint-ingestion
ExecStart=/usr/bin/docker compose -f $DOCKER_COMPOSE_FILE up
ExecStop=/usr/bin/docker compose -f $DOCKER_COMPOSE_FILE down
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    sudo systemctl daemon-reload
    
    # Enable service
    sudo systemctl enable argos-pipeline.service
    
    echo -e "${GREEN}✅ Systemd service created${NC}"
}

# Function to setup monitoring
setup_monitoring() {
    echo -e "${YELLOW}📊 Setting up monitoring...${NC}"
    
    # Create monitoring script
    cat > "$DEPLOY_DIR/osint_app/osint-ingestion/monitor-pipeline.sh" <<'EOF'
#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "📊 Argos Pipeline Monitor"
echo "========================"
echo ""

# Check Docker containers
echo "🐳 Docker Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Check memory usage
echo "💾 Memory Usage:"
free -h
echo ""

# Check disk usage
echo "💿 Disk Usage:"
df -h | grep -E '^/dev/|Filesystem'
echo ""

# Check recent logs
echo "📜 Recent Pipeline Logs:"
docker logs argos-osint-pipeline --tail 20
echo ""

# Check API health
echo "🏥 API Health Check:"
curl -s http://localhost:3001/health || echo -e "${RED}API not responding${NC}"
echo ""

# Check last run stats
if [ -f logs/pipeline-stats.json ]; then
    echo "📈 Last Run Statistics:"
    cat logs/pipeline-stats.json | jq '.' 2>/dev/null || cat logs/pipeline-stats.json
fi
EOF

    chmod +x "$DEPLOY_DIR/osint_app/osint-ingestion/monitor-pipeline.sh"
    
    # Create log rotation config
    sudo tee /etc/logrotate.d/argos-pipeline > /dev/null <<EOF
$DEPLOY_DIR/osint_app/osint-ingestion/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $USER $USER
}
EOF

    echo -e "${GREEN}✅ Monitoring configured${NC}"
}

# Function to create backup script
create_backup_script() {
    echo -e "${YELLOW}💾 Creating backup script...${NC}"
    
    cat > "$DEPLOY_DIR/osint_app/osint-ingestion/backup-pipeline.sh" <<'EOF'
#!/bin/bash

# Backup configuration
BACKUP_DIR="/opt/backups/argos"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="argos_backup_$TIMESTAMP"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
echo "Backing up database..."
docker exec argos-postgres pg_dump -U postgres argos > $BACKUP_DIR/db_$TIMESTAMP.sql

# Backup environment and logs
echo "Backing up configuration..."
tar -czf $BACKUP_DIR/config_$TIMESTAMP.tar.gz .env logs/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR"
EOF

    chmod +x "$DEPLOY_DIR/osint_app/osint-ingestion/backup-pipeline.sh"
    
    # Add to crontab (daily at 3 AM)
    (crontab -l 2>/dev/null; echo "0 3 * * * $DEPLOY_DIR/osint_app/osint-ingestion/backup-pipeline.sh") | crontab -
    
    echo -e "${GREEN}✅ Backup script created${NC}"
}

# Main deployment flow
main() {
    echo "🔍 Checking system requirements..."
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then 
        echo -e "${RED}Please run as normal user, not root${NC}"
        exit 1
    fi
    
    # Check OS
    if [ ! -f /etc/os-release ]; then
        echo -e "${RED}This script requires Ubuntu/Debian${NC}"
        exit 1
    fi
    
    # Update system
    echo -e "${YELLOW}📦 Updating system packages...${NC}"
    sudo apt-get update
    sudo apt-get upgrade -y
    
    # Install basic tools
    sudo apt-get install -y git curl wget jq
    
    # Install Docker if needed
    if ! command_exists docker; then
        install_docker
    else
        echo -e "${GREEN}✅ Docker already installed${NC}"
    fi
    
    # Setup firewall
    setup_firewall
    
    # Setup swap (for small servers)
    setup_swap
    
    # Clone repository
    clone_repository
    
    # Setup environment
    setup_environment
    
    # Setup systemd service
    setup_systemd_service
    
    # Setup monitoring
    setup_monitoring
    
    # Create backup script
    create_backup_script
    
    echo ""
    echo -e "${GREEN}✅ Server setup complete!${NC}"
    echo ""
    echo "📋 Next steps:"
    echo "1. Configure API keys in: $DEPLOY_DIR/osint_app/osint-ingestion/.env"
    echo "2. Start the pipeline: sudo systemctl start argos-pipeline"
    echo "3. Check status: sudo systemctl status argos-pipeline"
    echo "4. Monitor logs: journalctl -u argos-pipeline -f"
    echo "5. Run monitor script: $DEPLOY_DIR/osint_app/osint-ingestion/monitor-pipeline.sh"
    echo ""
    echo "🔒 Security reminder:"
    echo "- Change SSH port from 22"
    echo "- Setup SSH key authentication"
    echo "- Disable root login"
    echo "- Configure fail2ban"
}

# Run main function
main