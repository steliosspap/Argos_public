import { execSync } from 'child_process';

/**
 * Check availability of external tools and provide fallback options
 */
class ToolAvailability {
  constructor() {
    this.tools = {
      exiftool: { available: false, path: null, required: false },
      steghide: { available: false, path: null, required: false },
      binwalk: { available: false, path: null, required: false },
      zsteg: { available: false, path: null, required: false },
      python3: { available: false, path: null, required: true }
    };
    
    this.checkTools();
  }

  checkTools() {
    for (const [tool, config] of Object.entries(this.tools)) {
      try {
        const path = execSync(`which ${tool}`, { encoding: 'utf8' }).trim();
        if (path) {
          this.tools[tool].available = true;
          this.tools[tool].path = path;
        }
      } catch (error) {
        // Tool not found
        if (config.required) {
          console.error(`Required tool '${tool}' not found. Media analysis may not function properly.`);
        }
      }
    }
  }

  isAvailable(tool) {
    return this.tools[tool]?.available || false;
  }

  getPath(tool) {
    return this.tools[tool]?.path || tool;
  }

  getMissingTools() {
    return Object.entries(this.tools)
      .filter(([_, config]) => !config.available)
      .map(([tool, _]) => tool);
  }

  getAvailableTools() {
    return Object.entries(this.tools)
      .filter(([_, config]) => config.available)
      .map(([tool, _]) => tool);
  }

  printStatus() {
    console.log('Media Analysis Tool Availability:');
    console.log('=================================');
    
    for (const [tool, config] of Object.entries(this.tools)) {
      const status = config.available ? '✓' : '✗';
      const required = config.required ? ' (required)' : '';
      console.log(`${status} ${tool}${required}`);
    }
    
    const missing = this.getMissingTools();
    if (missing.length > 0) {
      console.log('\nMissing tools:', missing.join(', '));
      console.log('\nTo install missing tools on macOS:');
      
      if (missing.includes('exiftool')) {
        console.log('  brew install exiftool');
      }
      if (missing.includes('binwalk')) {
        console.log('  brew install binwalk');
      }
      if (missing.includes('zsteg')) {
        console.log('  gem install zsteg');
      }
      if (missing.includes('steghide')) {
        console.log('  # Steghide requires MacPorts or manual compilation');
        console.log('  # sudo port install steghide');
      }
    }
  }

  /**
   * Get capabilities based on available tools
   */
  getCapabilities() {
    return {
      metadata: this.isAvailable('exiftool') || this.isAvailable('python3'),
      steganography: {
        steghide: this.isAvailable('steghide'),
        binwalk: this.isAvailable('binwalk'),
        zsteg: this.isAvailable('zsteg'),
        any: this.isAvailable('steghide') || this.isAvailable('binwalk') || this.isAvailable('zsteg')
      },
      imageProcessing: this.isAvailable('python3')
    };
  }
}

export default ToolAvailability;