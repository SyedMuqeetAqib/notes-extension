#!/bin/bash

echo "🚀 Building TabulaNote Chrome Extension for development..."

# Build the Next.js app
echo "📦 Building Next.js application..."
yarn build

# Copy existing icon files to the out directory
echo "📁 Copying icon files..."
cp -r public/icons out/ 2>/dev/null || echo "⚠️  Could not copy icons (permission issue)"

# Copy manifest.json to the out directory
echo "📄 Copying manifest.json..."
cp public/manifest.json out/ 2>/dev/null || echo "⚠️  Could not copy manifest (permission issue)"

# Copy the reload script to the out directory
echo "🔄 Copying auto-reload script..."
cp public/reload-extension.js out/ 2>/dev/null || echo "⚠️  Could not copy reload script (permission issue)"

# Fix Chrome extension issue: rename _next directory to next-assets
if [ -d "out/_next" ]; then
    echo "🔄 Renaming _next directory to next-assets to comply with Chrome extension requirements..."
    mv out/_next out/next-assets
    
    # Update all references to _next in HTML and JS files
    find out -name "*.html" -exec sed -i '' 's/_next\//next-assets\//g' {} \;
    find out -name "*.js" -exec sed -i '' 's/_next\//next-assets\//g' {} \;
    find out -name "*.css" -exec sed -i '' 's/_next\//next-assets\//g' {} \;
fi

# Extract inline scripts to external files for Chrome extension compatibility
echo "📝 Extracting inline scripts to external files..."
node extract-inline-scripts.js

# Signal to the extension that a build has completed
echo "📡 Signaling build completion to extension..."
node -e "
const fs = require('fs');
const path = require('path');

try {
  // Create a build marker file
  const buildMarker = path.join(__dirname, 'out', '.build-marker');
  fs.writeFileSync(buildMarker, Date.now().toString());
  console.log('✅ Build marker created');
} catch (error) {
  console.log('⚠️  Could not create build marker:', error.message);
}
" 2>/dev/null || echo "⚠️  Could not signal build completion"

echo "✅ Extension built successfully for development!"
echo ""
echo "📋 To load the extension in Chrome:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select the 'out' folder from this project"
echo ""
echo "🔄 The extension will now auto-reload when you make changes!"
