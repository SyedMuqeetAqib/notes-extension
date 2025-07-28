#!/bin/bash

echo "Building TabulaNote Chrome Extension..."

# Build the Next.js app
npm run build

# Copy existing icon files to the out directory
echo "Copying icon files..."
cp -r public/icons out/

# Copy manifest.json to the out directory
cp public/manifest.json out/

# Fix Chrome extension issue: rename _next directory to next-assets
if [ -d "out/_next" ]; then
    echo "Renaming _next directory to next-assets to comply with Chrome extension requirements..."
    mv out/_next out/next-assets
    
    # Update all references to _next in HTML and JS files
    find out -name "*.html" -exec sed -i '' 's/_next\//next-assets\//g' {} \;
    find out -name "*.js" -exec sed -i '' 's/_next\//next-assets\//g' {} \;
    find out -name "*.css" -exec sed -i '' 's/_next\//next-assets\//g' {} \;
fi

# Extract inline scripts to external files for Chrome extension compatibility
echo "Extracting inline scripts to external files..."
node extract-inline-scripts.js

echo "Extension built successfully!"
echo ""
echo "To load the extension in Chrome:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select the 'out' folder from this project"
echo ""
echo "The extension will replace your new tab page with your app!"
echo ""
echo "Note: You may want to replace the placeholder icon files with actual PNG icons" 