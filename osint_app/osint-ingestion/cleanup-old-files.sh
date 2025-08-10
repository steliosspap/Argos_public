#!/bin/bash

# Script to clean up old redundant files
# Run with: ./cleanup-old-files.sh

echo "This will move all old files to an 'old-structure' directory."
echo "You can delete that directory once you're confident the new system works."
read -p "Continue? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]
then
    # Create backup directory
    mkdir -p old-structure
    
    # Move old files
    echo "Moving old files..."
    
    # Old scripts and test files in root
    mv -f runAll.js batch-processor*.js check*.js debug*.js test*.js fix*.js demonstrate*.js final*.js update*.patch old-structure/ 2>/dev/null
    
    # Old directories
    mv -f fetchers parsers nlp sync utils test old-structure/ 2>/dev/null
    
    # Old documentation
    mv -f DATABASE_SCHEMA_OPTIMIZATION_REPORT.md old-structure/ 2>/dev/null
    
    echo "✓ Old files moved to old-structure/"
    echo ""
    echo "New simplified structure:"
    echo "  - ingestion.js    (main script)"
    echo "  - continuous.js   (continuous runner)"
    echo "  - README.md       (documentation)"
    echo ""
    echo "To remove old files permanently: rm -rf old-structure/"
fi