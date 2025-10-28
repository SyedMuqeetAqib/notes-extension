# Chrome Extension Development Guide

This guide explains how to set up and use the hot reload development environment for the TabulaNote Chrome extension.

## Quick Start

1. **Start Development Mode:**

   ```bash
   npm run dev:extension
   ```

2. **Load Extension in Chrome:**

   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `out` folder from this project

3. **Start Developing:**
   - Make changes to your source files in `src/`
   - Extension automatically rebuilds and reloads
   - See changes immediately in the new tab page

## Available Scripts

### Development Scripts

- `npm run dev:extension` - Complete development workflow (initial build + watching)
- `npm run watch:build` - Start file watcher only (after initial build)
- `npm run build:dev` - Manual development build

### Production Scripts

- `npm run build` - Production build
- `npm run dev` - Next.js development server only

## How It Works

### 1. Auto-Reload Mechanism

The extension includes a background service worker (`reload-extension.js`) that:

- Monitors for build completion signals
- Automatically reloads the extension when changes are detected
- Uses Chrome's `chrome.runtime.reload()` API

### 2. File Watching

The development watcher (`watch-and-build.js`) monitors:

- `src/` directory for React components and logic
- `public/` directory for static assets
- Configuration files (`next.config.ts`, `tailwind.config.ts`, etc.)

### 3. Build Process

When changes are detected:

1. Next.js builds the application
2. Extension build script processes the output
3. Files are prepared for Chrome extension compatibility
4. Extension automatically reloads in Chrome

## File Structure

```
├── public/
│   ├── reload-extension.js     # Auto-reload background script
│   ├── manifest.json          # Extension manifest
│   └── icons/                 # Extension icons
├── src/                       # Source code
├── out/                       # Built extension (auto-generated)
├── build-extension-dev.sh     # Development build script
├── watch-and-build.js         # File watcher
├── initial-extension-build.js # Initial build runner
└── extract-inline-scripts.js  # Chrome compatibility script
```

## Development Workflow

### First Time Setup

1. Run `npm run dev:extension`
2. Wait for initial build to complete
3. Load extension in Chrome from `out/` folder
4. Start making changes!

### Daily Development

1. Run `npm run dev:extension`
2. Extension automatically loads and watches for changes
3. Make changes to source files
4. See changes immediately in Chrome

## Troubleshooting

### Extension Not Reloading

1. Check Chrome console for errors
2. Ensure extension is loaded from `out/` folder
3. Verify background service worker is running
4. Try manually reloading the extension

### Build Failures

1. Check terminal output for error messages
2. Ensure all dependencies are installed
3. Try running `npm run build:dev` manually
4. Check file permissions on build scripts

### File Watching Issues

1. Ensure you're running from the project root
2. Check that `chokidar` is installed
3. Verify file paths are correct
4. Try restarting the development process

## Chrome Extension Features

### Manifest V3 Compliance

- Uses service workers instead of background pages
- Implements proper content security policy
- Follows Chrome extension best practices

### Auto-Reload Capabilities

- Monitors build completion signals
- Automatically reloads extension
- Prevents multiple rapid reloads
- Works in development mode only

### Development Optimizations

- Faster build times
- Better error reporting
- Clear console feedback
- Optimized file watching

## Production Build

For production builds, use the standard build process:

```bash
npm run build
./build-extension.sh
```

This creates an optimized extension ready for distribution.

## Tips for Development

1. **Keep Chrome DevTools Open:** Use the extension's DevTools to debug
2. **Check Console:** Look for auto-reload messages and errors
3. **Test Thoroughly:** Verify changes work in the actual extension environment
4. **Use Source Maps:** Enable source maps for better debugging
5. **Monitor Performance:** Watch for memory leaks and performance issues

## Common Issues

### Extension Loads But Doesn't Update

- Check if the background service worker is running
- Verify the reload script is included in the manifest
- Try manually reloading the extension

### Build Process Hangs

- Check for file permission issues
- Ensure no processes are using the `out/` directory
- Try cleaning the build directory

### File Changes Not Detected

- Verify the file watcher is running
- Check if files are in the watched directories
- Restart the development process

## Support

If you encounter issues:

1. Check the terminal output for error messages
2. Verify all dependencies are installed
3. Ensure file permissions are correct
4. Try restarting the development process
5. Check Chrome's extension console for errors

Happy developing! 🚀
