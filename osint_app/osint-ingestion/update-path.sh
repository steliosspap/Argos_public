#!/bin/bash
# Script to add Python user bin to PATH for snscrape and other tools

PYTHON_BIN="/Users/bombafrontistiria/Library/Python/3.13/bin"

# Check if the path is already in PATH
if [[ ":$PATH:" != *":$PYTHON_BIN:"* ]]; then
    echo "Adding $PYTHON_BIN to PATH"
    export PATH="$PYTHON_BIN:$PATH"
else
    echo "$PYTHON_BIN is already in PATH"
fi

# Verify snscrape is available
if command -v snscrape &> /dev/null; then
    echo "✓ snscrape is available at: $(which snscrape)"
else
    echo "✗ snscrape not found in PATH"
fi

# Make this permanent by adding to shell profile
echo ""
echo "To make this permanent, add the following line to your ~/.zshrc or ~/.bash_profile:"
echo 'export PATH="/Users/bombafrontistiria/Library/Python/3.13/bin:$PATH"'