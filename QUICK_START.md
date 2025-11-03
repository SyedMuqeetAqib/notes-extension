# Quick Start Guide - Extension Hot Reload

## ✅ Setup Complete!

Your Chrome extension hot reload development environment is now set up. Here's how to use it:

## 🚀 Start Development

1. **Run the development command:**

   ```bash
   npm run dev:extension
   ```

2. **Load the extension in Chrome:**

   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `out` folder from this project

3. **Start coding:**
   - Make changes to files in `src/`
   - Extension automatically rebuilds and reloads
   - See changes immediately in the new tab page

## 📁 What Was Created

- `public/reload-extension.js` - Auto-reload background script
- `build-extension-dev.sh` - Development build script
- `watch-and-build.js` - File watcher for automatic rebuilds
- `initial-extension-build.js` - Initial build runner
- `cleanup.sh` - Cleanup script for build directories

## 🔧 Available Commands

- `npm run dev:extension` - Complete development workflow
- `npm run watch:build` - Start file watcher only
- `npm run build:dev` - Manual development build
- `./cleanup.sh` - Clean build directories

## 🎯 How It Works

1. **File Watching**: Monitors `src/` directory for changes
2. **Auto Build**: Triggers Next.js build when files change
3. **Extension Processing**: Converts build output for Chrome extension
4. **Auto Reload**: Extension automatically reloads in Chrome

## ⚠️ Note About Permissions

Some permission warnings may appear during build - this is normal and doesn't affect functionality. The extension will still work properly.

## 🐛 Troubleshooting

If you encounter issues:

1. **Clean and rebuild:**

   ```bash
   ./cleanup.sh
   npm run build:dev
   ```

2. **Check Chrome console** for any extension errors

3. **Verify extension is loaded** from the `out` folder

4. **Restart development process** if file watching stops

## 🎉 You're Ready!

Your extension development environment is now set up for seamless hot reloading. Just run `npm run dev:extension` and start coding!
