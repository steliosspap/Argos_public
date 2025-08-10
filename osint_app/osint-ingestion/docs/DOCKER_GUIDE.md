# Docker Guide for OSINT Pipeline

## What is Docker?

Docker is like a **shipping container for your application**. Just like shipping containers standardize how goods are transported, Docker standardizes how applications run.

### Key Concepts:

1. **Container**: A lightweight, isolated environment that runs your app
2. **Image**: A blueprint/template for creating containers (like a recipe)
3. **Dockerfile**: Instructions for building an image (like a recipe card)
4. **docker-compose**: A tool to run multiple containers together

## Why Use Docker?

### Without Docker:
- "Works on my machine" problems
- Different versions of Node.js on different computers
- Missing dependencies
- Manual setup on each server

### With Docker:
- Same environment everywhere
- No installation conflicts
- Easy deployment
- Automatic restarts if crashes

## How Our Pipeline Uses Docker

### 1. The Dockerfile (Recipe)
```dockerfile
FROM node:20-alpine        # Start with Node.js v20
WORKDIR /app              # Create app folder
COPY . .                  # Copy our code
RUN npm install           # Install dependencies
CMD ["node", "cli.js"]    # Run the pipeline
```

### 2. The docker-compose.yml (Orchestra Conductor)
```yaml
services:
  osint-pipeline:         # Our main service
    build: .             # Build from Dockerfile
    restart: unless-stopped  # Auto-restart if crashes
    env_file: .env.production  # Load environment vars
```

## Step-by-Step Setup

### 1. Install Docker
- **Mac**: Download Docker Desktop from [docker.com](https://docker.com)
- **Linux**: `curl -fsSL https://get.docker.com | sh`
- **Windows**: Download Docker Desktop

### 2. Prepare Configuration
```bash
# Copy the example environment file
cp .env.production.example .env.production

# Edit with your API keys
nano .env.production
```

### 3. Build & Run

#### Simple Way:
```bash
# Build and start everything
docker-compose up -d

# -d means "detached" (runs in background)
```

#### What Happens:
1. Docker reads the Dockerfile
2. Downloads Node.js image
3. Copies your code
4. Installs dependencies
5. Starts the pipeline
6. Keeps it running 24/7

### 4. Monitor Your Pipeline

```bash
# View logs
docker-compose logs -f osint-pipeline

# Check if running
docker ps

# Stop the pipeline
docker-compose down

# Restart the pipeline
docker-compose restart
```

## Common Docker Commands

| Command | What it does |
|---------|-------------|
| `docker-compose up -d` | Start pipeline in background |
| `docker-compose logs -f` | Watch live logs |
| `docker-compose down` | Stop everything |
| `docker-compose restart` | Restart pipeline |
| `docker ps` | List running containers |
| `docker exec -it argos-osint-pipeline sh` | Enter container shell |

## Troubleshooting

### Container won't start?
```bash
# Check logs
docker-compose logs osint-pipeline

# Common issues:
# - Missing .env.production file
# - Invalid API keys
# - Port already in use
```

### Need to update code?
```bash
# Stop, rebuild, and start
docker-compose down
docker-compose build
docker-compose up -d
```

### Container keeps restarting?
```bash
# Check health
docker-compose ps

# View detailed logs
docker-compose logs --tail=100 osint-pipeline
```

## Production Best Practices

### 1. Use Environment Files
Never hardcode secrets! Use `.env.production`:
```env
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
```

### 2. Set Resource Limits
Add to docker-compose.yml:
```yaml
services:
  osint-pipeline:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
```

### 3. Use Volumes for Persistence
```yaml
volumes:
  - ./logs:/app/logs      # Keep logs on host
  - ./reports:/app/reports  # Keep reports
```

### 4. Auto-restart Policy
```yaml
restart: unless-stopped   # Restarts unless you stop it
```

## Quick Deploy Script

We've included `deploy.sh` for easy deployment:

```bash
# Deploy to production with Docker
./deploy.sh production

# Deploy locally for development
./deploy.sh local
```

## Architecture Overview

```
┌─────────────────┐
│   Host Machine  │
│                 │
│  ┌───────────┐  │
│  │  Docker   │  │
│  │           │  │
│  │ ┌───────┐ │  │     ┌──────────┐
│  │ │Pipeline│ │  │────▶│ Supabase │
│  │ │Container │  │     └──────────┘
│  │ └───────┘ │  │
│  │           │  │     ┌──────────┐
│  │ ┌───────┐ │  │────▶│ OpenAI   │
│  │ │ Redis │ │  │     └──────────┘
│  │ │(cache)│ │  │
│  │ └───────┘ │  │
│  └───────────┘  │
└─────────────────┘
```

## Next Steps

1. **Test locally first**: `./deploy.sh local`
2. **Configure production**: Edit `.env.production`
3. **Deploy**: `./deploy.sh production`
4. **Monitor**: `docker-compose logs -f`

Docker makes deployment consistent and reliable. No more "works on my machine" problems!