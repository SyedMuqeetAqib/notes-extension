#!/bin/bash

echo "Building TabulaNote Chrome Extension (Simple Version)..."

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf out .next

# Build the Next.js app
echo "Building Next.js app..."
yarn build

# Copy manifest and icons
echo "Copying extension files..."
cp public/manifest.json out/
cp -r public/icons out/

# Rename _next to next-assets for Chrome extension compatibility
if [ -d "out/_next" ]; then
    echo "Renaming _next to next-assets..."
    mv out/_next out/next-assets
    
    # Update references in HTML files
    find out -name "*.html" -type f -exec sed -i '' 's/_next\//next-assets\//g' {} \;
fi

echo ""
echo "✅ Extension built successfully!"
echo ""
echo "📁 Extension files are in the 'out' directory"
echo ""
echo "🚀 To load the extension in Chrome:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select the 'out' folder from this project"
echo ""
echo "🎉 The extension will replace your new tab page!"
