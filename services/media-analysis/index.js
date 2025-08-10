import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MediaAnalysisService {
  constructor(config = {}) {
    // Set defaults first
    const defaults = {
      pythonPath: 'python3',
      bigSisterPath: path.join(__dirname, '../../lib/BigSister/src'),
      tempDir: path.join(os.tmpdir(), 'osint-media-analysis'),
      enableSteganography: false,
      enableReverseImageSearch: false
    };
    
    // Merge config, but filter out undefined values
    this.config = Object.entries({ ...defaults, ...config })
      .reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        } else {
          acc[key] = defaults[key];
        }
        return acc;
      }, {});
    
    this.initializeTempDir();
  }

  async initializeTempDir() {
    try {
      await fs.mkdir(this.config.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Analyze media file using BigSister tools
   * @param {string} filePath - Path to the media file
   * @param {object} options - Analysis options
   * @returns {object} Analysis results
   */
  async analyzeMedia(filePath, options = {}) {
    const results = {
      filePath,
      fileHash: await this.calculateFileHash(filePath),
      timestamp: new Date().toISOString(),
      metadata: {},
      anomalies: [],
      steganography: null,
      imageSearch: null,
      errors: []
    };

    try {
      // Extract metadata using BigSister
      try {
        const metadataResult = await this.extractMetadata(filePath);
        results.metadata = metadataResult.metadata || {};
        results.anomalies = metadataResult.anomalies || [];
      } catch (metaError) {
        console.error('Metadata extraction error:', metaError.message);
        results.metadata = {};
        results.anomalies = [];
        results.errors.push({ type: 'metadata', message: metaError.message });
      }

      // Extract geolocation if available
      if (results.metadata.GPSLatitude && results.metadata.GPSLongitude) {
        results.geolocation = {
          latitude: this.convertDMSToDD(results.metadata.GPSLatitude, results.metadata.GPSLatitudeRef),
          longitude: this.convertDMSToDD(results.metadata.GPSLongitude, results.metadata.GPSLongitudeRef)
        };
      }

      // Optional: Run steganography detection
      if (this.config.enableSteganography && options.checkSteganography !== false) {
        try {
          results.steganography = await this.detectSteganography(filePath);
        } catch (error) {
          results.errors.push({ type: 'steganography', message: error.message });
        }
      }

      // Optional: Generate image thumbnail for storage
      if (await this.isImage(filePath)) {
        results.thumbnail = await this.generateThumbnail(filePath);
      }

    } catch (error) {
      results.errors.push({ type: 'general', message: error.message });
    }

    return results;
  }

  /**
   * Extract metadata using BigSister's metadata extraction chain
   */
  async extractMetadata(filePath) {
    const pythonScript = path.join(this.config.bigSisterPath, 'main.py');
    
    // Use the virtual environment Python if available
    const venvPython = path.join(this.config.bigSisterPath, '../venv/bin/python');
    let pythonPath = this.config.pythonPath;
    
    try {
      await fs.access(venvPython);
      pythonPath = venvPython;
      console.log('Using venv Python:', venvPython);
    } catch (e) {
      console.log('Using system Python:', pythonPath);
    }
    
    return new Promise((resolve, reject) => {
      
      // Create a Python script to call run_metadata_chain
      const wrapperScript = `
import sys
import json
sys.path.insert(0, '${this.config.bigSisterPath}')
from main_headless import run_metadata_chain

try:
    result = run_metadata_chain('${filePath}')
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

      const python = spawn(pythonPath, ['-c', wrapperScript]);
      
      let output = '';
      let error = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          console.error('Python error:', error);
          console.error('Python output:', output);
          reject(new Error(`Python process exited with code ${code}: ${error}`));
          return;
        }

        try {
          if (!output) {
            reject(new Error('No output from Python script'));
            return;
          }
          const result = JSON.parse(output);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(this.parseMetadataResult(result));
          }
        } catch (parseError) {
          console.error('Parse error:', parseError);
          console.error('Raw output:', output);
          reject(new Error(`Failed to parse output: ${parseError.message}`));
        }
      });
    });
  }

  /**
   * Parse and normalize metadata results from BigSister
   */
  parseMetadataResult(rawResult) {
    const result = {
      metadata: {},
      anomalies: []
    };

    // Extract EXIF metadata
    if (rawResult.exif_metadata) {
      result.metadata = { ...rawResult.exif_metadata };
      
      // Check for timestamp anomalies
      if (rawResult.exif_metadata.anomalies) {
        result.anomalies = Object.entries(rawResult.exif_metadata.anomalies).map(([key, value]) => ({
          type: 'timestamp',
          field: key,
          ...value
        }));
      }
    }

    // Add steganography indicators if detected
    if (rawResult.steghide_metadata && rawResult.steghide_metadata.embedded) {
      result.anomalies.push({
        type: 'steganography',
        tool: 'steghide',
        details: rawResult.steghide_metadata
      });
    }

    // Add embedded file indicators from binwalk
    if (rawResult.binwalk_metadata && rawResult.binwalk_metadata.Signatures) {
      const signatures = rawResult.binwalk_metadata.Signatures;
      if (signatures.length > 0) {
        result.anomalies.push({
          type: 'embedded_files',
          tool: 'binwalk',
          count: signatures.length,
          signatures: signatures
        });
      }
    }

    return result;
  }

  /**
   * Detect steganography in media files
   */
  async detectSteganography(filePath) {
    // Implementation would call BigSister's steganography tools
    // For now, return a placeholder
    return {
      checked: true,
      tools: ['steghide', 'binwalk', 'zsteg'],
      findings: []
    };
  }

  /**
   * Convert EXIF GPS coordinates from DMS to decimal degrees
   */
  convertDMSToDD(dms, ref) {
    if (!dms || !Array.isArray(dms) || dms.length < 3) return null;
    
    let dd = dms[0] + dms[1]/60 + dms[2]/3600;
    
    if (ref === 'S' || ref === 'W') {
      dd = dd * -1;
    }
    
    return dd;
  }

  /**
   * Calculate file hash for deduplication
   */
  async calculateFileHash(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    return createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Check if file is an image
   */
  async isImage(filePath) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];
    const ext = path.extname(filePath).toLowerCase();
    return imageExtensions.includes(ext);
  }

  /**
   * Generate thumbnail for image storage
   */
  async generateThumbnail(filePath) {
    try {
      const thumbnailPath = path.join(
        this.config.tempDir, 
        `thumb_${Date.now()}_${path.basename(filePath)}`
      );
      
      await sharp(filePath)
        .resize(200, 200, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);
      
      const thumbnailBuffer = await fs.readFile(thumbnailPath);
      await fs.unlink(thumbnailPath); // Clean up
      
      return {
        data: thumbnailBuffer.toString('base64'),
        mimeType: 'image/jpeg'
      };
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return null;
    }
  }

  /**
   * Batch analyze multiple media files
   */
  async batchAnalyze(filePaths, options = {}) {
    const results = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.analyzeMedia(filePath, options);
        results.push(result);
      } catch (error) {
        results.push({
          filePath,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  /**
   * Analyze media from URL
   */
  async analyzeFromUrl(url, options = {}) {
    // Download file to temp directory
    const tempPath = path.join(this.config.tempDir, `download_${Date.now()}`);
    
    try {
      // Download logic would go here
      // For now, throw not implemented
      throw new Error('URL analysis not yet implemented');
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

export default MediaAnalysisService;