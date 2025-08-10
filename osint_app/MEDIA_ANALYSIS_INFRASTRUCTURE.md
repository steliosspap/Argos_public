# Media Analysis Infrastructure Requirements

## Overview
The media analysis system is the most complex ML feature, requiring significant infrastructure investment. Here's exactly what you need to activate it.

## Infrastructure Components

### 1. GPU Processing Server
**Purpose**: Real-time image/video analysis
**Options**:

#### Option A: Cloud GPU (Recommended for Start)
- **AWS EC2 p3.2xlarge**: $3.06/hour (~$2,200/month)
  - 1x NVIDIA V100 GPU (16GB)
  - 8 vCPUs, 61GB RAM
  - Good for 1000-2000 images/hour

#### Option B: Dedicated GPU Server
- **NVIDIA RTX 4090 Server**: ~$5,000 one-time
  - 24GB VRAM
  - Process 5000+ images/hour
  - ROI in 2-3 months vs cloud

#### Option C: Serverless GPU
- **Replicate.com**: $0.0023/second
- **Banana.dev**: $0.002/second
- **Modal.com**: $0.000725/second
- Best for variable workloads

### 2. Object Storage (Media Files)
**Purpose**: Store analyzed images/videos

#### Recommended: Cloudflare R2
- **Cost**: $0.015/GB/month + $0.36/million requests
- **Free egress** (huge savings)
- **S3-compatible API**
- **Example**: 1TB storage = $15/month

#### Alternative: AWS S3
- **Cost**: $0.023/GB/month + egress fees
- **Example**: 1TB storage + 100GB egress = $32/month

### 3. CDN (Content Delivery)
**Purpose**: Fast global media delivery

#### Recommended: Cloudflare
- **Free tier**: Unlimited bandwidth
- **Pro**: $25/month (better analytics)
- **Integrates with R2**

### 4. Queue System
**Purpose**: Handle media processing jobs

#### Recommended: Redis + BullMQ
- **Redis Cloud**: $5-50/month
- **Features**: Priority queues, retries, monitoring
- **Scale**: 10k-100k jobs/day

### 5. Computer Vision APIs
**Purpose**: Advanced analysis beyond open-source models

#### Primary: Azure Computer Vision
- **Cost**: $1 per 1000 transactions
- **Features**: OCR, object detection, scene analysis
- **Free tier**: 5000 transactions/month

#### Backup: Google Cloud Vision
- **Cost**: $1.50 per 1000 images
- **Features**: Similar to Azure + better landmark detection

### 6. Specialized Analysis Services

#### Facial Recognition (if needed)
- **AWS Rekognition**: $0.001 per image
- **Face++**: $0.0005 per request
- **Legal considerations apply**

#### Video Analysis
- **AWS Rekognition Video**: $0.10 per minute
- **Google Video Intelligence**: $0.10 per minute

#### Reverse Image Search
- **TinEye API**: $200/month (50k searches)
- **Google Custom Search**: $5 per 1000 queries

## Total Infrastructure Costs

### Minimal Setup (Serverless)
- Replicate GPU: ~$50/month (processing 1000 images/day)
- Cloudflare R2: $15/month (1TB)
- Redis Cloud: $5/month
- Azure Vision: $30/month (30k images)
- **Total: ~$100/month**

### Production Setup (Dedicated)
- AWS p3.2xlarge: $2,200/month
- Cloudflare R2: $50/month (5TB)
- Redis Cloud: $50/month
- Vision APIs: $200/month
- CDN: $25/month
- **Total: ~$2,525/month**

### Enterprise Setup (On-premise)
- RTX 4090 Server: $5,000 (one-time)
- Hosting: $200/month
- Storage/CDN: $100/month
- Vision APIs: $500/month
- **Total: $800/month + $5,000 initial**

## Implementation Checklist

### Phase 1: Basic Setup (Week 1)
```bash
# 1. Set up object storage
- [ ] Create Cloudflare R2 bucket
- [ ] Configure CORS for web access
- [ ] Set up lifecycle rules

# 2. Set up Redis
- [ ] Deploy Redis instance
- [ ] Configure BullMQ
- [ ] Set up monitoring

# 3. Configure serverless GPU
- [ ] Create Replicate account
- [ ] Get API keys
- [ ] Test basic inference
```

### Phase 2: Integration (Week 2)
```bash
# 1. Update environment variables
MEDIA_ANALYSIS_ENABLED=true
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=argos-media
REPLICATE_API_TOKEN=your_token
AZURE_VISION_KEY=your_key
AZURE_VISION_ENDPOINT=your_endpoint
REDIS_URL=redis://your_redis_url

# 2. Deploy workers
npm run deploy:media-worker

# 3. Test pipeline
npm run test:media-pipeline
```

### Phase 3: Optimization (Week 3)
- Implement caching layer
- Add fallback providers
- Set up monitoring dashboards
- Configure auto-scaling

## Code Activation

The media analysis code is already built. To activate:

```bash
# 1. Enable in environment
echo "MEDIA_ANALYSIS_ENABLED=true" >> .env.local

# 2. Install additional dependencies
cd osint-ingestion
pip install opencv-python pillow tensorflow

# 3. Run media worker
python scripts/media_worker.py

# 4. Test the endpoint
curl -X POST http://localhost:3000/api/analyze-media \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://example.com/image.jpg"}'
```

## ROI Calculation

### Current Manual Analysis
- Analyst time: $50/hour
- Images analyzed: 10/hour
- Cost per image: $5

### With Media Analysis System
- Infrastructure: $800/month
- Images analyzed: 100,000/month
- Cost per image: $0.008
- **Savings: 99.84%**

### Break-even Point
- Manual: 160 images = $800
- System processes 160 images in 4 hours
- **ROI realized in first week**

## Security Considerations

1. **Data Privacy**
   - Implement encryption at rest
   - Use private VPC endpoints
   - Regular security audits

2. **Content Moderation**
   - Implement NSFW detection
   - Flag potentially harmful content
   - Maintain audit logs

3. **Legal Compliance**
   - GDPR compliance for EU content
   - Respect robots.txt
   - Implement data retention policies

## Recommended Implementation Path

### Month 1: Start Small
- Use serverless GPU (Replicate)
- Basic object storage (R2)
- Manual queue management
- **Cost: ~$100/month**

### Month 2: Scale Up
- Add Redis queue system
- Implement caching
- Add backup providers
- **Cost: ~$300/month**

### Month 3: Production Ready
- Consider dedicated GPU
- Add monitoring/alerting
- Implement auto-scaling
- **Cost: ~$800/month**

## Quick Start Commands

```bash
# 1. Install media analysis dependencies
cd osint_app
npm install @aws-sdk/client-s3 bull ioredis sharp

# 2. Set up Python environment
cd osint-ingestion
pip install -r requirements-media.txt

# 3. Configure services
export MEDIA_ANALYSIS_ENABLED=true
export REPLICATE_API_TOKEN=your_token

# 4. Run the media worker
python scripts/media_worker.py

# 5. Test the system
curl http://localhost:3000/api/health/media
```

## Support & Monitoring

### Metrics to Track
- Processing time per image
- Queue depth
- Error rates
- Storage usage
- API costs

### Alerting Thresholds
- Queue depth > 1000
- Error rate > 5%
- Processing time > 30s
- Storage > 80% capacity

The infrastructure investment pays for itself quickly through automation and scale. Start with the minimal setup ($100/month) and scale based on usage.