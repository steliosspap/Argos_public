# Simple Guide - Just Like npm run dev!

## Forget Docker for Now - Let's Start Simple

Just like your Next.js app uses `npm run dev`, our OSINT pipeline has simple commands too!

### Quick Start (No Docker!)

```bash
# 1. Install dependencies (just like any Node project)
npm install

# 2. Copy environment file
cp .env.example .env.local

# 3. Add your API keys to .env.local
# (Same as your Next.js app!)

# 4. Test if everything works
node test-setup.js

# 5. Run the pipeline!
npm start
```

## Available Commands (Just Like npm run dev)

### For Development:
```bash
# Run once and see what happens
npm start

# Run with detailed logs (like console.log)
npm run dev

# Keep running every 15 minutes
npm run monitor
```

### What Each Command Does:

| Command | What it does | Like in Next.js |
|---------|--------------|-----------------|
| `npm start` | Run pipeline once | `npm run build` |
| `npm run dev` | Run with debug logs | `npm run dev` |
| `npm run monitor` | Keep running forever | `npm run dev` (but for data) |
| `node test-setup.js` | Check if working | `npm run lint` |

## Real Examples

### 1. "I want to see what data it collects"
```bash
# This is like opening localhost:3000
./cli.js ingest --dry-run --verbose --limit 5

# It will:
# - Search for 5 news articles
# - Show you what it found
# - NOT save to database (dry-run)
```

### 2. "I want it to run all the time"
```bash
# This is like keeping your Next.js dev server running
npm run monitor

# It will:
# - Check news every 15 minutes
# - Save to your database
# - Show alerts for big events
```

### 3. "I want to see what events were found"
```bash
# This is like checking your database
./cli.js events --days 1

# Shows events from last 24 hours
```

## Common Tasks

### Starting Fresh
```bash
# Just like starting a new Next.js project
npm install
node test-setup.js
npm start
```

### Checking Logs
```bash
# See what's happening (like console.log)
npm run dev
```

### Running Continuously
```bash
# Like having your dev server always on
npm run monitor
```

## When You're Ready for Production

### Option 1: Keep It Simple (Like Vercel)
```bash
# Run in background on your server
nohup npm run monitor > pipeline.log 2>&1 &

# Check if running
ps aux | grep "npm run monitor"

# See logs
tail -f pipeline.log
```

### Option 2: Use PM2 (Like Forever.js)
```bash
# Install PM2
npm install -g pm2

# Start pipeline
pm2 start npm --name "osint-pipeline" -- run monitor

# Commands
pm2 logs osint-pipeline    # See logs
pm2 restart osint-pipeline # Restart
pm2 stop osint-pipeline    # Stop
```

### Option 3: Systemd (Built into Linux)
```bash
# We already have service files!
sudo cp argos-ingestion.* /etc/systemd/system/
sudo systemctl start argos-ingestion.timer

# It will run automatically every 15 minutes
```

## Comparison with Your Next.js App

| Your Next.js App | OSINT Pipeline | Purpose |
|------------------|----------------|---------|
| `npm run dev` | `npm run monitor` | Keep running |
| `npm run build` | `npm start` | Run once |
| `localhost:3000` | `./cli.js events` | See output |
| `.env.local` | `.env.local` | API keys |
| `console.log()` | `--verbose flag` | Debug info |

## Still Want Docker? Here's the Simplest Way

Think of Docker as a "box" that has everything pre-installed:

```bash
# Instead of:
npm install
npm run monitor

# You just do:
docker-compose up

# That's it! Docker handles everything else
```

### Why Docker Later?
- **Now**: Use npm commands while developing
- **Later**: Use Docker when deploying to server
- **Why**: Docker ensures it works the same everywhere

## Your Daily Workflow

### Morning Check
```bash
# See what happened overnight
./cli.js events --days 1 --severity high
```

### Start Pipeline
```bash
# Run for the day
npm run monitor
```

### Check Specific Event
```bash
# Search for specific topic
./cli.js ingest --search "Ukraine" --limit 10
```

### End of Day
```bash
# Stop the monitor (Ctrl+C)
# Or if using PM2:
pm2 stop osint-pipeline
```

## Remember

1. **Start simple**: Use npm commands first
2. **Docker is optional**: Only for production
3. **It's just Node.js**: Like your Next.js app
4. **Test locally**: Always test with --dry-run first

The pipeline is just another Node.js app. If you can run `npm run dev` for Next.js, you can run this!