const { spawn } = require("child_process");
const path = require("path");

console.log("🚀 Running initial extension build...\n");

// Function to run the initial build
function runInitialBuild() {
  return new Promise((resolve, reject) => {
    console.log("📦 Building Next.js application...");

    const buildProcess = spawn("yarn", ["build"], {
      stdio: "inherit",
      shell: true,
      cwd: __dirname,
    });

    buildProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Next.js build completed successfully!");
        resolve();
      } else {
        console.log("❌ Next.js build failed with code:", code);
        reject(new Error(`Build failed with code ${code}`));
      }
    });

    buildProcess.on("error", (error) => {
      console.log("❌ Build process error:", error.message);
      reject(error);
    });
  });
}

// Function to run the extension build
function runExtensionBuild() {
  return new Promise((resolve, reject) => {
    console.log("🔧 Building Chrome extension...");

    const extensionBuildProcess = spawn("bash", ["build-extension-dev.sh"], {
      stdio: "inherit",
      shell: true,
      cwd: __dirname,
    });

    extensionBuildProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Extension build completed successfully!");
        resolve();
      } else {
        console.log("❌ Extension build failed with code:", code);
        reject(new Error(`Extension build failed with code ${code}`));
      }
    });

    extensionBuildProcess.on("error", (error) => {
      console.log("❌ Extension build process error:", error.message);
      reject(error);
    });
  });
}

// Main function to run both builds
async function main() {
  try {
    await runInitialBuild();
    await runExtensionBuild();

    console.log("\n🎉 Initial build completed successfully!");
    console.log("📋 Next steps:");
    console.log('1. Load the extension from the "out" folder in Chrome');
    console.log('2. Run "npm run dev:extension" to start development mode');
    console.log("3. Make changes to your source files");
    console.log("4. Extension will automatically rebuild and reload!\n");
  } catch (error) {
    console.log("\n❌ Initial build failed:", error.message);
    console.log("Please fix the errors and try again.\n");
    process.exit(1);
  }
}

// Run the main function
main();
