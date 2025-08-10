# OSINT Pipeline - Clean & Organized

## 📁 Project Structure

```
osint-ingestion/
│
├── 📱 cli.js                 # Main entry point (like index.js)
├── 📦 package.json           # Dependencies & scripts
│
├── 🧩 services/              # Core business logic
│   ├── IngestionService.js   # Main orchestrator
│   ├── EventExtractor.js     # Extract events from articles
│   ├── TextProcessor.js      # NLP & text analysis
│   └── GeospatialService.js  # Location processing
│
├── 📊 models/                # Data structures
│   ├── Event.js              # Event data model
│   └── Source.js             # News source model
│
├── ⚙️ config/                # Configuration files
│   ├── .env.production.example
│   ├── argos-ingestion.service  # Linux service
│   └── argos-ingestion.timer    # Linux timer
│
├── 🛠️ core/                  # Core utilities
│   └── config.js             # Config loader
│
├── 🗄️ sql/                   # Database files
│   ├── add-v2-features.sql
│   ├── custom-v2-migration.sql
│   └── supabase-v2-migration.sql
│
├── 📜 scripts/               # Utility scripts
│   ├── test-setup.js         # Test environment
│   ├── setup-env.js          # Setup helper
│   └── check-*.js            # Various checks
│
├── 🚀 deployment/            # Deployment files
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── deploy.sh
│
├── 📚 docs/                  # Documentation
│   ├── SIMPLE_GUIDE.md       # Start here!
│   ├── DOCKER_GUIDE.md       # Docker instructions
│   └── [other guides]
│
├── 🧪 tests/                 # Test files
│
├── 🔧 utils/                 # Utilities
│   ├── sources/              # News sources
│   └── integration/          # API integrations
│
└── 🗑️ archive/               # Old/backup files
```

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Test setup
npm test

# 3. Run pipeline
npm start        # Run once
npm run dev      # Run with debug
npm run monitor  # Run continuously
```

## 📋 Available Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `npm start` | Run ingestion once | Daily runs |
| `npm run dev` | Debug mode (verbose) | Development |
| `npm run monitor` | Continuous monitoring | Production |
| `npm run events` | View recent events | Check results |
| `npm test` | Test configuration | Verify setup |

## 🏗️ Architecture

```
User Input → CLI → IngestionService → Process Flow
                          ↓
                   [Fetch Articles]
                          ↓
                   [TextProcessor]
                          ↓
                   [EventExtractor]
                          ↓
                   [GeospatialService]
                          ↓
                   [Save to Supabase]
```

## 📂 Where to Find Things

- **Main Logic**: `services/IngestionService.js`
- **Entry Point**: `cli.js`
- **Configuration**: `core/config.js`
- **Environment**: `.env.local` (create from `.env.example`)
- **Documentation**: `docs/SIMPLE_GUIDE.md`
- **Deployment**: `deployment/deploy.sh`

## 🔍 Understanding the Flow

1. **CLI** (`cli.js`) - Command interface
2. **Services** (`services/`) - Business logic
3. **Models** (`models/`) - Data structures
4. **Config** (`config/`) - Settings
5. **Database** (`sql/`) - Schema

## 🛠️ Development

```bash
# Run with debugging
npm run dev

# Check specific functionality
./cli.js ingest --dry-run --limit 5

# View logs
tail -f logs/ingestion.log
```

## 🚢 Production

```bash
# Using npm (simple)
npm run monitor

# Using PM2 (recommended)
pm2 start npm --name osint -- run monitor

# Using Docker (advanced)
npm run docker:up
```

## 📖 Next Steps

1. Read `docs/SIMPLE_GUIDE.md` for detailed usage
2. Configure `.env.local` with your API keys
3. Run `npm test` to verify setup
4. Start with `npm run dev` to see it in action

---

The pipeline is now organized and ready to use! 🎉