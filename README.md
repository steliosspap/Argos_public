# 🚀 Argos OSINT Pipeline

**Real-time Global Conflict Intelligence Platform**

[![Deploy on Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/argos)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-blue.svg)](https://nextjs.org/)

> **Argos** is a sophisticated Open Source Intelligence (OSINT) platform designed for real-time monitoring and analysis of global military conflicts, arms trades, and geopolitical events. It combines automated data ingestion, AI-powered analysis, and interactive visualization to provide comprehensive intelligence insights.

## 🌟 Key Features

### 🔍 **Intelligence Gathering**
- **Multi-source ingestion**: RSS feeds, news APIs, social media, institutional sources
- **Real-time monitoring**: Continuous scanning of 500+ conflict-related queries
- **Automated processing**: AI-powered content analysis and fact extraction
- **Media analysis**: Image processing, steganography detection, reverse image search

### 🎯 **Conflict Intelligence**
- **Active conflict zones**: Ukraine-Russia, Israel-Palestine, Syria, Yemen, Myanmar, Sudan, Ethiopia
- **Escalation tracking**: Time-weighted scoring with asymmetric behavior (quick escalation, slow de-escalation)
- **Event clustering**: AI-powered grouping of related events with similarity scoring
- **Geospatial intelligence**: Coordinate extraction, location verification, conflict zone mapping

### 🛡️ **Arms Trade Monitoring**
- **Comprehensive tracking**: Buyer/seller analysis, weapon system classification
- **Strategic assessment**: Risk analysis, proliferation assessment, regional impact
- **Market intelligence**: Deal classification, pricing analysis, competitive assessment
- **Automated ingestion**: Twice-daily updates via GitHub Actions

### 📊 **Interactive Intelligence Dashboard**
- **3D Globe visualization**: Interactive conflict mapping with real-time data
- **Timeline views**: Chronological event tracking and analysis
- **Real-time alerts**: Configurable notification system for critical events
- **Advanced filtering**: By region, severity, time range, and event type

## 🏗️ Architecture

### **Technology Stack**
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Supabase (PostgreSQL)
- **AI/ML**: OpenAI GPT-4, Anthropic Claude, custom NLP pipelines
- **Visualization**: React Globe GL, Mapbox GL, Three.js
- **Database**: PostgreSQL with pgvector for embeddings
- **Deployment**: Docker, Vercel, GitHub Actions

### **System Components**
```
argos/
├── osint-ingestion/          # Backend pipeline services
│   ├── services/             # Core OSINT services
│   ├── models/               # Data models
│   ├── sql/                  # Database migrations
│   └── scripts/              # Utility scripts
├── osint_app/               # Next.js frontend application
│   ├── src/
│   │   ├── app/             # App router pages
│   │   ├── components/      # React components
│   │   ├── lib/             # Utility libraries
│   │   └── hooks/           # Custom React hooks
│   └── public/              # Static assets
├── services/                # Core OSINT services
├── docs/                    # Documentation
└── cli-enhanced.js         # Command-line interface
```

## 🚀 Quick Start

### **Prerequisites**
- Node.js 18+ 
- PostgreSQL database (Supabase recommended)
- OpenAI API key
- Mapbox access token

### **1. Clone the Repository**
```bash
git clone https://github.com/your-username/argos.git
cd argos
```

### **2. Install Dependencies**
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd osint_app
npm install
```

### **3. Environment Configuration**
Create `.env.local` in the `osint_app` directory:

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# AI Services
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# External APIs
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
NEWSAPI_KEY=your_newsapi_key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### **4. Database Setup**
```bash
# Run database migrations
cd osint_app/osint-ingestion
node scripts/check-and-migrate.js
```

### **5. Start Development Server**
```bash
# Start frontend
cd osint_app
npm run dev

# Start backend pipeline (in separate terminal)
cd ..
npm start
```

Visit `http://localhost:3000` to access the application.

## 🔧 Configuration

### **Pipeline Configuration**
The OSINT pipeline can be configured via `osint-ingestion/core/config.js`:

```javascript
export const config = {
  // Ingestion settings
  ingestion: {
    batchSize: 50,
    maxConcurrentRequests: 10,
    retryAttempts: 3,
    deduplicationWindow: 24 * 60 * 60 * 1000 // 24 hours
  },
  
  // Processing settings
  processing: {
    minRelevanceScore: 0.3,
    minConfidenceScore: 0.5,
    similarityThreshold: 0.8
  },
  
  // Alert settings
  alerts: {
    enabled: true,
    minAlertScore: 7,
    slackWebhook: process.env.SLACK_WEBHOOK_URL
  }
};
```

### **Conflict Zones**
Configure active conflict zones in the configuration:

```javascript
conflictZones: {
  active: [
    { name: 'Ukraine-Russia', countries: ['Ukraine', 'Russia'], priority: 'critical' },
    { name: 'Israel-Palestine', countries: ['Israel', 'Palestine', 'Gaza'], priority: 'critical' }
  ]
}
```

## 📊 Usage

### **Intelligence Center**
The main dashboard provides:
- **Interactive 3D Globe**: Real-time conflict mapping
- **Timeline View**: Chronological event tracking
- **Escalation Monitoring**: Real-time conflict escalation scores
- **Arms Deals**: Global weapons trade tracking

### **API Endpoints**
```bash
# Manual ingestion trigger
POST /api/ingest

# Get events
GET /api/events

# Get arms deals
GET /api/arms-deals

# Health check
GET /api/health
```

### **CLI Commands**
```bash
# Run enhanced ingestion cycle
node cli-enhanced.js ingest

# Monitor mode with alerts
node cli-enhanced.js monitor --interval 15 --alerts

# Initialize database
node cli-enhanced.js init-db
```

## 🚀 Deployment

### **Vercel Deployment**
1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### **Docker Deployment**
```bash
# Build Docker image
docker build -t argos-osint .

# Run container
docker run -p 3001:3001 argos-osint
```

### **Production Checklist**
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Monitoring and alerting configured
- [ ] Backup strategy implemented

## 🔍 Advanced Features

### **Media Analysis**
Enable advanced media analysis capabilities:

```bash
# Enable media analysis
node cli-enhanced.js ingest --enable-media-analysis

# Enable steganography detection
node cli-enhanced.js ingest --enable-media-analysis --enable-steganography
```

### **Custom Intelligence Sources**
Add custom RSS feeds and APIs:

```javascript
// Add to config.js
customSources: [
  {
    name: 'Custom Intelligence Feed',
    url: 'https://your-feed.com/rss',
    type: 'rss',
    priority: 0.8
  }
]
```

### **Alert Configuration**
Configure real-time alerts:

```javascript
alerts: {
  enabled: true,
  minAlertScore: 7,
  channels: {
    slack: process.env.SLACK_WEBHOOK_URL,
    email: process.env.ALERT_EMAIL,
    webhook: process.env.WEBHOOK_URL
  }
}
```

## 📈 Monitoring & Analytics

### **Health Monitoring**
```bash
# Check pipeline health
npm run health-check

# Monitor ingestion stats
npm run monitor-ingestion-stats
```

### **Performance Metrics**
- Response time tracking
- API usage monitoring
- Database performance metrics
- Error rate monitoring

### **Cost Tracking**
- OpenAI API usage
- External API costs
- Infrastructure costs
- Storage costs

## 🤝 Contributing

### **Development Setup**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### **Code Style**
- Use TypeScript for frontend code
- Follow ESLint configuration
- Write meaningful commit messages
- Add documentation for new features

### **Testing**
```bash
# Run frontend tests
cd osint_app
npm test

# Run backend tests
cd ../osint-ingestion
npm test
```

## 🔒 Security

### **Data Protection**
- Encrypted data storage
- Secure API endpoints
- Role-based access control
- Audit logging

### **Privacy Compliance**
- GDPR compliance
- Data retention policies
- User consent management
- Privacy controls

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for GPT-4 integration
- **Supabase** for database infrastructure
- **Mapbox** for mapping services
- **Vercel** for deployment platform

## 📞 Support

- **Documentation**: [docs.argosintel.org](https://docs.argosintel.org)
- **Issues**: [GitHub Issues](https://github.com/your-username/argos/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/argos/discussions)

---
*Argos - Global Conflict Intelligence Platform*
