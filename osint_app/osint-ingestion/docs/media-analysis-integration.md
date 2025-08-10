# Media Analysis Integration Guide

## Overview

The OSINT ingestion pipeline now includes integrated media analysis capabilities powered by BigSister, an OSINT tool originally designed for CTF competitions. This integration adds advanced image analysis, metadata extraction, and steganography detection to enhance the verification and analysis of media content in conflict reporting.

## Features

### 1. Metadata Extraction
- **EXIF Data**: Comprehensive metadata extraction from images using ExifTool
- **Geolocation**: Automatic extraction and conversion of GPS coordinates
- **Timestamp Analysis**: Detection of timestamp anomalies between EXIF and file system
- **Device Information**: Camera model, settings, and software information

### 2. Steganography Detection
- **Steghide**: Detects hidden data in JPEG, BMP3, WAV, and AU files
- **Binwalk**: Identifies embedded files and firmware signatures
- **Zsteg**: LSB steganography detection for PNG and BMP files
- **Risk Assessment**: Automatic classification of steganography risk levels

### 3. Image Analysis
- **Thumbnail Generation**: Automatic thumbnail creation for storage
- **Hash Calculation**: SHA256 hashing for deduplication
- **Anomaly Detection**: Identifies suspicious patterns and metadata inconsistencies
- **Reverse Image Search**: Framework for image verification (requires additional setup)

## Installation

### 1. Install System Dependencies

Run the provided installation script:

```bash
cd osint-ingestion
./scripts/install-bigsister-deps.sh
```

This installs:
- ExifTool - Metadata extraction
- Steghide - Steganography detection
- Binwalk - Embedded file detection
- Zsteg - PNG/BMP steganography
- Python environment with required packages

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Apply Database Schema

Run the media analysis schema migration:

```bash
psql -U your_user -d your_database -f sql/media-analysis-schema.sql
```

## Usage

### Command Line Options

Enable media analysis in the enhanced ingestion pipeline:

```bash
# Basic media analysis (metadata extraction only)
node cli-enhanced.js --enable-media-analysis

# Full analysis including steganography detection
node cli-enhanced.js --enable-media-analysis --enable-steganography

# With custom Python path
node cli-enhanced.js --enable-media-analysis --python-path /usr/bin/python3
```

### Configuration Options

When initializing the EnhancedIngestionService:

```javascript
const service = new EnhancedIngestionService({
  enableMediaAnalysis: true,
  enableSteganography: false, // Optional, resource intensive
  enableReverseImageSearch: false, // Requires additional setup
  pythonPath: 'python3',
  mediaAnalysisTempDir: '/tmp/osint-media',
  autoExtractSteganography: false // Extract embedded files automatically
});
```

## Architecture

### Service Structure

```
services/
├── media-analysis/
│   ├── index.js                    # Main MediaAnalysisService
│   ├── reverse-image-search.js     # ReverseImageSearchService
│   └── steganography-detector.js   # SteganographyDetectorService
└── EnhancedIngestionService.js     # Integration point
```

### Database Schema

New tables added:
- `media_assets` - Stores analyzed media files and metadata
- `media_analysis_results` - Detailed analysis results per tool
- `steganography_findings` - Specific steganography detections
- `reverse_image_results` - Reverse image search results
- `media_anomalies` - Detected anomalies and inconsistencies

### Data Flow

1. **Article Processing**: During article extraction, media URLs are identified
2. **Media Download**: Images are temporarily downloaded for analysis
3. **Metadata Extraction**: BigSister's Python modules extract comprehensive metadata
4. **Anomaly Detection**: Timestamps and metadata are checked for inconsistencies
5. **Steganography Scan**: Optional deep scan for hidden data
6. **Results Storage**: Analysis results are stored in the database
7. **Cleanup**: Temporary files are removed

## API Reference

### MediaAnalysisService

```javascript
const analyzer = new MediaAnalysisService(config);

// Analyze single media file
const result = await analyzer.analyzeMedia('/path/to/image.jpg', {
  checkSteganography: true
});

// Batch analysis
const results = await analyzer.batchAnalyze([
  '/path/to/image1.jpg',
  '/path/to/image2.png'
]);
```

### Result Structure

```javascript
{
  filePath: '/path/to/image.jpg',
  fileHash: 'sha256_hash',
  timestamp: '2024-01-20T10:00:00Z',
  metadata: {
    // EXIF and other metadata
  },
  geolocation: {
    latitude: 51.5074,
    longitude: -0.1278
  },
  anomalies: [
    {
      type: 'timestamp',
      field: 'CreateDate',
      fileMtime: '2024-01-20T10:00:00Z',
      exifTime: '2024-01-19T15:30:00Z',
      difference: 64800
    }
  ],
  steganography: {
    checked: true,
    tools: ['steghide', 'binwalk', 'zsteg'],
    findings: []
  },
  thumbnail: {
    data: 'base64_encoded_jpeg',
    mimeType: 'image/jpeg'
  }
}
```

## Testing

Run the integration tests:

```bash
# Create test assets directory
mkdir -p tests/test-assets

# Add a test image (optional)
cp /path/to/test-image.jpg tests/test-assets/test-image.jpg

# Run tests
node tests/test-media-analysis.js
```

## Performance Considerations

1. **Resource Usage**: Media analysis is CPU and I/O intensive
2. **Concurrency**: Analysis is limited by the pipeline's concurrency settings
3. **Storage**: Temporary files are created during analysis
4. **Network**: Images must be downloaded before analysis

### Optimization Tips

- Enable media analysis selectively based on source reliability
- Use steganography detection only for high-priority content
- Implement caching for repeated analysis of the same images
- Consider running media analysis as a separate background job

## Security Considerations

1. **File Validation**: Downloaded files are validated before processing
2. **Sandboxing**: Python scripts run in isolated processes
3. **Resource Limits**: Timeouts prevent hanging on malformed files
4. **Temporary File Cleanup**: All temporary files are removed after analysis

## Troubleshooting

### Common Issues

1. **Python not found**
   ```bash
   export PATH="/usr/local/bin:$PATH"
   ```

2. **ExifTool not available**
   ```bash
   sudo apt-get install exiftool
   ```

3. **Permission denied on temporary files**
   ```bash
   mkdir -p /tmp/osint-media
   chmod 755 /tmp/osint-media
   ```

### Debug Mode

Enable verbose logging:

```javascript
const service = new EnhancedIngestionService({
  enableMediaAnalysis: true,
  verbose: true
});
```

## Future Enhancements

1. **AI-Powered Analysis**: Integration with vision models for content analysis
2. **Video Support**: Extend analysis to video files
3. **Cloud Storage**: Direct analysis from cloud URLs
4. **Distributed Processing**: Separate media analysis workers
5. **Real-time Monitoring**: WebSocket updates for long-running analysis

## Contributing

To add new analysis capabilities:

1. Extend the appropriate service in `services/media-analysis/`
2. Update the database schema if needed
3. Add corresponding tests
4. Update this documentation

## License

This integration maintains compatibility with both the OSINT pipeline's MIT license and BigSister's license terms.