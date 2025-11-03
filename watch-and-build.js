const chokidar = require("chokidar");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

console.log("🚀 Starting Extension Development Watcher...\n");

let isBuilding = false;
let buildTimeout;

// Function to run the build process
function runBuild() {
  if (isBuilding) {
    console.log("⏳ Build already in progress, skipping...");
    return;
  }

  isBuilding = true;
  console.log("🔨 Starting build process...");

  // Run the development build script
  const buildProcess = spawn("bash", ["build-extension-dev.sh"], {
    stdio: "inherit",
    shell: true,
    cwd: __dirname,
  });

  buildProcess.on("close", (code) => {
    isBuilding = false;
    if (code === 0) {
      console.log("✅ Build completed successfully!\n");

      // Signal the extension to reload by updating storage
      try {
        const buildMarkerPath = path.join(__dirname, "out", ".build-marker");
        if (fs.existsSync(buildMarkerPath)) {
          const buildTime = fs.readFileSync(buildMarkerPath, "utf8");
          console.log("📡 Signaling extension to reload...");

          // Create a simple signal file that the extension can monitor
          const signalPath = path.join(__dirname, "out", ".reload-signal");
          fs.writeFileSync(signalPath, buildTime);
        }
      } catch (error) {
        console.log("⚠️  Could not signal extension reload:", error.message);
      }
    } else {
      console.log("❌ Build failed with code:", code);
    }
  });

  buildProcess.on("error", (error) => {
    isBuilding = false;
    console.log("❌ Build process error:", error.message);
  });
}

// Debounced build function to prevent multiple rapid builds
function debouncedBuild() {
  if (buildTimeout) {
    clearTimeout(buildTimeout);
  }

  buildTimeout = setTimeout(() => {
    runBuild();
  }, 1000); // Wait 1 second after the last change
}

// Watch for changes in source files
const watcher = chokidar.watch(
  [
    "src/**/*",
    "public/**/*",
    "next.config.ts",
    "tailwind.config.ts",
    "tsconfig.json",
    "package.json",
  ],
  {
    ignored: [
      /(^|[\/\\])\../, // ignore dotfiles
      /node_modules/,
      /\.next/,
      /out/,
      /\.git/,
    ],
    persistent: true,
    ignoreInitial: true,
  }
);

// Handle file changes
watcher.on("change", (filePath) => {
  console.log(`📁 File changed: ${filePath}`);
  debouncedBuild();
});

watcher.on("add", (filePath) => {
  console.log(`📁 File added: ${filePath}`);
  debouncedBuild();
});

watcher.on("unlink", (filePath) => {
  console.log(`📁 File removed: ${filePath}`);
  debouncedBuild();
});

// Handle errors
watcher.on("error", (error) => {
  console.log("❌ Watcher error:", error);
});

// Handle process termination
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down development watcher...");
  watcher.close();
  if (buildTimeout) {
    clearTimeout(buildTimeout);
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down development watcher...");
  watcher.close();
  if (buildTimeout) {
    clearTimeout(buildTimeout);
  }
  process.exit(0);
});

console.log("👀 Watching for changes in:");
console.log("  - src/ directory");
console.log("  - public/ directory");
console.log("  - Configuration files");
console.log(
  "\n💡 Make changes to your source files to trigger automatic rebuilds!"
);
console.log(
  "🔄 Extension will auto-reload in Chrome when changes are detected.\n"
);
