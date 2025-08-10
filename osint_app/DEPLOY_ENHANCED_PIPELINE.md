# 🚀 Deploy Enhanced Pipeline to Server - Step by Step

## Overview
Stop running the enhanced pipeline on your laptop! Here's how to deploy it to a real server so it runs 24/7 without killing your computer.

## Option 1: DigitalOcean (Recommended - $24/month)

### Step 1: Create a Droplet
1. Go to [DigitalOcean](https://www.digitalocean.com/)
2. Create a new Droplet:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic
   - **Size**: $24/month (4GB RAM, 2 CPUs)
   - **Region**: Choose closest to you
   - **Authentication**: SSH Key (recommended) or Password

### Step 2: Connect to Your Server
```bash
# Replace with your droplet IP
ssh root@YOUR_DROPLET_IP
```

### Step 3: Run the Deployment Script
```bash
# Download and run the deployment script
wget https://raw.githubusercontent.com/steliosspap/argos/main/osint_app/osint-ingestion/deploy-to-server.sh
chmod +x deploy-to-server.sh
./deploy-to-server.sh
```

This script will:
- Install Docker
- Setup firewall
- Clone your repository
- Configure systemd service
- Setup monitoring
- Create backup scripts

### Step 4: Configure Environment
```bash
# Navigate to the deployment directory
cd /opt/argos/osint_app/osint-ingestion

# Copy environment template
cp .env.production.example .env

# Edit with your API keys
nano .env
```

Add your actual API keys:
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
SUPABASE_SERVICE_KEY=[YOUR-SERVICE-KEY]
OPENAI_API_KEY=sk-[YOUR-KEY]
NEWS_API_KEY=[YOUR-KEY]
GOOGLE_API_KEY=[YOUR-KEY]
```

### Step 5: Start the Pipeline
```bash
# Start using systemd (recommended)
sudo systemctl start argos-pipeline

# Check status
sudo systemctl status argos-pipeline

# View logs
journalctl -u argos-pipeline -f
```

Or use Docker directly:
```bash
# Start with Docker Compose
docker compose -f docker-compose.production.yml up -d

# Check logs
docker logs argos-osint-pipeline -f
```

### Step 6: Verify Everything Works
```bash
# Run the monitor script
/opt/argos/osint_app/osint-ingestion/monitor-pipeline.sh

# Check API health
curl http://localhost:3001/health

# View pipeline stats
cat /opt/argos/osint_app/osint-ingestion/logs/pipeline-stats.json
```

## Option 2: Railway.app (Easiest - $20/month)

### Step 1: Prepare Your Code
```bash
# In your local directory
cd osint_app/osint-ingestion

# Create railway.toml
cat > railway.toml << EOF
[build]
builder = "DOCKERFILE"
dockerfilePath = "./Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 60
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
EOF
```

### Step 2: Deploy to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Set environment variables
railway variables set DATABASE_URL="your-database-url"
railway variables set OPENAI_API_KEY="your-openai-key"
# ... set all other variables

# Deploy
railway up
```

## Option 3: AWS EC2 (More Control - $30/month)

### Step 1: Launch EC2 Instance
1. Go to AWS Console
2. Launch Instance:
   - **AMI**: Ubuntu Server 22.04 LTS
   - **Instance Type**: t3.medium
   - **Storage**: 30GB
   - **Security Group**: Allow SSH (22), HTTP (80), API (3001)

### Step 2: Connect and Deploy
```bash
# Connect to instance
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Switch to root
sudo su -

# Download and run deployment script
wget https://raw.githubusercontent.com/steliosspap/argos/main/osint_app/osint-ingestion/deploy-to-server.sh
chmod +x deploy-to-server.sh
./deploy-to-server.sh
```

## Monitoring Your Deployed Pipeline

### Real-time Logs
```bash
# View all container logs
docker compose -f docker-compose.production.yml logs -f

# View specific service
docker logs argos-osint-pipeline -f --tail 100
```

### Check Performance
```bash
# Run monitor script
/opt/argos/osint_app/osint-ingestion/monitor-pipeline.sh

# Check Docker stats
docker stats
```

### Setup Alerts (Optional)
```bash
# Add to crontab for email alerts
crontab -e

# Add this line (checks every 5 minutes)
*/5 * * * * /opt/argos/osint_app/osint-ingestion/health-check.js || echo "Pipeline unhealthy" | mail -s "Argos Alert" your@email.com
```

## Troubleshooting

### Pipeline Won't Start
```bash
# Check logs
journalctl -u argos-pipeline -n 100

# Check Docker
docker ps -a
docker logs argos-osint-pipeline

# Verify environment
cd /opt/argos/osint_app/osint-ingestion
cat .env | grep -E "DATABASE_URL|OPENAI_API_KEY"
```

### High Memory Usage
```bash
# Restart pipeline
sudo systemctl restart argos-pipeline

# Adjust memory limits in docker-compose.production.yml
```

### Can't Connect to API
```bash
# Check firewall
sudo ufw status

# Check if API is running
curl http://localhost:3001/health

# Check nginx (if using)
sudo nginx -t
sudo systemctl restart nginx
```

## Stop Running Locally!

Once deployed to a server:

1. **Stop local Docker**:
   ```bash
   docker compose down
   docker system prune -a
   ```

2. **Free up disk space**:
   ```bash
   rm -rf ~/Library/Containers/com.docker.docker
   ```

3. **Your laptop is free!** The pipeline now runs 24/7 on the server.

## Next Steps

1. **Setup domain** (optional):
   ```bash
   # Point pipeline.argosintel.org to your server IP
   # Configure nginx for SSL
   ```

2. **Enable monitoring**:
   - Access Grafana at http://YOUR_SERVER_IP:3000
   - Default login: admin/changeme

3. **Schedule backups**:
   - Already configured to run daily at 3 AM
   - Check backups: `ls /opt/backups/argos/`

Your enhanced pipeline is now running on a proper server, not your laptop! 🎉