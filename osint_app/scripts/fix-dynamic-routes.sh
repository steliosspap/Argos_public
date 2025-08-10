#!/bin/bash

# Script to add dynamic export to all API routes

echo "Adding dynamic export to all API routes..."

# Find all route.ts files in the api directory
find src/app/api -name "route.ts" -type f | while read -r file; do
    echo "Processing: $file"
    
    # Check if the file already has the dynamic export
    if grep -q "export const dynamic" "$file"; then
        echo "  ✓ Already has dynamic export"
    else
        # Add the dynamic export after imports
        # This uses a temporary file to avoid issues with sed -i on macOS
        awk '
            /^import/ { imports = 1 }
            imports && !/^import/ && !done {
                print ""
                print "// Force dynamic rendering"
                print "export const dynamic = '\''force-dynamic'\'';"
                print "export const runtime = '\''nodejs'\'';"
                done = 1
            }
            { print }
        ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
        
        echo "  ✓ Added dynamic export"
    fi
done

echo "Done! All API routes now have dynamic exports."