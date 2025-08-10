#!/usr/bin/env python3

import sys
import os

# Add BigSister to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../lib/BigSister/src'))

try:
    from main import run_metadata_chain
    from metadata.exiftool_scraper import MetadataScraper
    
    print("✓ BigSister modules imported successfully")
    
    # Test metadata extraction
    scraper = MetadataScraper()
    test_image = "/tmp/test.jpg"
    
    # Create a test image
    from PIL import Image
    img = Image.new('RGB', (100, 100), color='red')
    img.save(test_image)
    
    print(f"✓ Test image created at {test_image}")
    
    # Try to extract metadata
    result = scraper.scrape(test_image)
    print(f"✓ Metadata extraction completed")
    print(f"  Found {len(result)} metadata fields")
    
    # Try the full chain
    chain_result = run_metadata_chain(test_image)
    print(f"✓ Full metadata chain completed")
    
    # Cleanup
    os.remove(test_image)
    
except ImportError as e:
    print(f"✗ Import error: {e}")
    print("\nMake sure BigSister dependencies are installed:")
    print("  cd lib/BigSister")
    print("  python3 -m venv venv")
    print("  source venv/bin/activate")
    print("  pip install pillow")
    
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()