import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import ToolAvailability from './tool-availability.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SteganographyDetectorService {
  constructor(config = {}) {
    this.config = {
      pythonPath: config.pythonPath || 'python3',
      bigSisterPath: path.join(__dirname, '../../lib/BigSister/src'),
      extractDir: config.extractDir || '/tmp/osint-steg-extract',
      autoExtract: config.autoExtract || false,
      passphrases: config.passphrases || [],
      ...config
    };
    
    this.toolAvailability = new ToolAvailability();
    this.capabilities = this.toolAvailability.getCapabilities();
    
    if (!this.capabilities.steganography.any) {
      console.warn('Warning: No steganography detection tools available. Install steghide, binwalk, or zsteg for full functionality.');
    }
    
    this.initializeExtractDir();
  }

  async initializeExtractDir() {
    try {
      await fs.mkdir(this.config.extractDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create extraction directory:', error);
    }
  }

  /**
   * Run comprehensive steganography detection on a file
   */
  async detectSteganography(filePath, options = {}) {
    const result = {
      filePath,
      timestamp: new Date().toISOString(),
      findings: {
        steghide: null,
        binwalk: null,
        zsteg: null
      },
      suspiciousIndicators: [],
      extractedFiles: []
    };

    try {
      // Run Steghide detection
      result.findings.steghide = await this.runSteghide(filePath, options);
      
      // Run Binwalk detection
      result.findings.binwalk = await this.runBinwalk(filePath, options);
      
      // Run Zsteg detection (for PNG/BMP files)
      if (await this.isZstegCompatible(filePath)) {
        result.findings.zsteg = await this.runZsteg(filePath, options);
      }

      // Analyze findings for suspicious indicators
      result.suspiciousIndicators = this.analyzeFindingsForIndicators(result.findings);
      
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * Run Steghide detection
   */
  async runSteghide(filePath, options = {}) {
    // Check if steghide is available
    if (!this.toolAvailability.isAvailable('steghide')) {
      return {
        error: 'Steghide not available',
        hasEmbeddedData: false,
        metadata: {},
        skipped: true
      };
    }
    const passphrases = [
      ...this.config.passphrases,
      ...(options.passphrases || []),
      '' // Try empty passphrase
    ];

    const results = {
      hasEmbeddedData: false,
      metadata: {},
      extractedContent: null,
      testedPassphrases: passphrases.length
    };

    // Try each passphrase
    for (const passphrase of passphrases) {
      try {
        const steghideResult = await this.executeSteghide(filePath, passphrase);
        
        if (steghideResult.success) {
          results.hasEmbeddedData = true;
          results.metadata = steghideResult.metadata;
          results.successfulPassphrase = passphrase ? '[REDACTED]' : '[EMPTY]';
          
          // Extract if auto-extract is enabled
          if (this.config.autoExtract && steghideResult.canExtract) {
            results.extractedContent = await this.extractWithSteghide(filePath, passphrase);
          }
          
          break; // Stop on first successful passphrase
        }
      } catch (error) {
        // Continue to next passphrase
      }
    }

    return results;
  }

  /**
   * Execute Steghide command
   */
  async executeSteghide(filePath, passphrase = '') {
    return new Promise((resolve, reject) => {
      const wrapperScript = `
import sys
import json
sys.path.insert(0, '${this.config.bigSisterPath}')
from steganography.steghide_scraper import SteghideScraper
from metadata.parser import MetadataParser

try:
    scraper = SteghideScraper()
    parser = MetadataParser()
    
    raw_output = scraper.scrape('${filePath}', passphrase='${passphrase}')
    parsed = parser.parse_steghide(raw_output)
    
    result = {
        'success': 'embedded' in parsed and parsed.get('embedded', '').lower() == 'yes',
        'metadata': parsed,
        'canExtract': 'embedded file' in str(raw_output).lower()
    }
    
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({'error': str(e), 'success': False}))
`;

      const python = spawn(this.config.pythonPath, ['-c', wrapperScript]);
      
      let output = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.on('close', (code) => {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          reject(new Error('Failed to parse Steghide output'));
        }
      });
    });
  }

  /**
   * Run Binwalk detection
   */
  async runBinwalk(filePath, options = {}) {
    // Check if binwalk is available
    if (!this.toolAvailability.isAvailable('binwalk')) {
      return {
        error: 'Binwalk not available',
        signatures: [],
        hasEmbeddedFiles: false,
        skipped: true
      };
    }
    return new Promise((resolve, reject) => {
      const wrapperScript = `
import sys
import json
sys.path.insert(0, '${this.config.bigSisterPath}')
from steganography.binwalk_scraper import BinwalkScraper
from metadata.parser import MetadataParser

try:
    scraper = BinwalkScraper()
    parser = MetadataParser()
    
    raw_output = scraper.scrape('${filePath}', extract=${this.config.autoExtract})
    parsed = parser.parse_binwalk(raw_output)
    
    result = {
        'signatures': parsed.get('Signatures', []),
        'hasEmbeddedFiles': len(parsed.get('Signatures', [])) > 0,
        'extractionDir': raw_output.get('Extraction Directory')
    }
    
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({'error': str(e), 'signatures': []}))
`;

      const python = spawn(this.config.pythonPath, ['-c', wrapperScript]);
      
      let output = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.on('close', (code) => {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          resolve({ error: 'Failed to parse Binwalk output', signatures: [] });
        }
      });
    });
  }

  /**
   * Run Zsteg detection for PNG/BMP files
   */
  async runZsteg(filePath, options = {}) {
    // Check if zsteg is available
    if (!this.toolAvailability.isAvailable('zsteg')) {
      return {
        error: 'Zsteg not available',
        hasFindings: false,
        findings: [],
        skipped: true
      };
    }
    
    // Note: Zsteg is a Ruby tool, so we'll need to call it differently
    return new Promise((resolve, reject) => {
      const zsteg = spawn('zsteg', [filePath]);
      
      let output = '';
      let error = '';
      
      zsteg.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      zsteg.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      zsteg.on('close', (code) => {
        const findings = [];
        
        if (output) {
          // Parse zsteg output for interesting findings
          const lines = output.split('\n');
          for (const line of lines) {
            if (line.includes('text') || line.includes('file')) {
              findings.push({
                type: 'zsteg',
                description: line.trim()
              });
            }
          }
        }
        
        resolve({
          hasFindings: findings.length > 0,
          findings: findings,
          rawOutput: output
        });
      });
      
      zsteg.on('error', (err) => {
        // Zsteg might not be installed
        resolve({
          error: 'Zsteg not available',
          hasFindings: false,
          findings: []
        });
      });
    });
  }

  /**
   * Check if file is compatible with Zsteg (PNG/BMP)
   */
  async isZstegCompatible(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.png', '.bmp'].includes(ext);
  }

  /**
   * Analyze all findings for suspicious indicators
   */
  analyzeFindingsForIndicators(findings) {
    const indicators = [];
    
    // Check Steghide findings
    if (findings.steghide && findings.steghide.hasEmbeddedData) {
      indicators.push({
        severity: 'high',
        type: 'steghide_embedded_data',
        description: 'File contains hidden data embedded with Steghide',
        tool: 'steghide'
      });
    }
    
    // Check Binwalk findings
    if (findings.binwalk && findings.binwalk.signatures) {
      for (const signature of findings.binwalk.signatures) {
        // Look for suspicious embedded file types
        const suspicious = ['executable', 'archive', 'encrypted'];
        const description = signature.Description || '';
        
        if (suspicious.some(type => description.toLowerCase().includes(type))) {
          indicators.push({
            severity: 'medium',
            type: 'suspicious_embedded_file',
            description: `Embedded file detected: ${description}`,
            offset: signature.Offset,
            tool: 'binwalk'
          });
        }
      }
    }
    
    // Check Zsteg findings
    if (findings.zsteg && findings.zsteg.hasFindings) {
      for (const finding of findings.zsteg.findings) {
        indicators.push({
          severity: 'low',
          type: 'lsb_steganography',
          description: finding.description,
          tool: 'zsteg'
        });
      }
    }
    
    return indicators;
  }

  /**
   * Extract embedded content with Steghide
   */
  async extractWithSteghide(filePath, passphrase = '') {
    const outputFile = path.join(
      this.config.extractDir,
      `steghide_extract_${Date.now()}.out`
    );
    
    return new Promise((resolve, reject) => {
      const steghide = spawn('steghide', [
        'extract',
        '-sf', filePath,
        '-p', passphrase,
        '-xf', outputFile,
        '-f'
      ]);
      
      steghide.on('close', async (code) => {
        if (code === 0) {
          try {
            const content = await fs.readFile(outputFile);
            await fs.unlink(outputFile); // Clean up
            
            resolve({
              success: true,
              content: content.toString('base64'),
              size: content.length
            });
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        } else {
          resolve({ success: false, error: 'Extraction failed' });
        }
      });
    });
  }

  /**
   * Batch steganography detection
   */
  async batchDetect(filePaths, options = {}) {
    const results = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.detectSteganography(filePath, options);
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
   * Generate steganography report
   */
  generateReport(detectionResults) {
    const report = {
      summary: {
        totalFiles: detectionResults.length,
        filesWithSteganography: 0,
        highSeverityFindings: 0,
        toolsUsed: ['steghide', 'binwalk', 'zsteg']
      },
      details: []
    };
    
    for (const result of detectionResults) {
      if (result.suspiciousIndicators && result.suspiciousIndicators.length > 0) {
        report.summary.filesWithSteganography++;
        
        const highSeverity = result.suspiciousIndicators.filter(
          ind => ind.severity === 'high'
        ).length;
        
        report.summary.highSeverityFindings += highSeverity;
        
        report.details.push({
          file: result.filePath,
          indicators: result.suspiciousIndicators,
          timestamp: result.timestamp
        });
      }
    }
    
    return report;
  }
}

export default SteganographyDetectorService;