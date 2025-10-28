// Auto-reload extension in development mode
// This script monitors for file changes and automatically reloads the extension

(function () {
  "use strict";

  // Only run in development mode
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.log("🔄 Extension Auto-Reload: Monitoring for changes...");

  let reloadTimeout;
  let isReloading = false;

  // Function to reload the extension
  function reloadExtension() {
    if (isReloading) {
      return;
    }

    isReloading = true;
    console.log("🔄 Extension Auto-Reload: Reloading extension...");

    try {
      chrome.runtime.reload();
    } catch (error) {
      console.error(
        "❌ Extension Auto-Reload: Failed to reload extension:",
        error
      );
      isReloading = false;
    }
  }

  // Function to check for changes by monitoring the extension's files
  function checkForChanges() {
    // Clear existing timeout
    if (reloadTimeout) {
      clearTimeout(reloadTimeout);
    }

    // Set a new timeout to reload after a short delay
    // This prevents multiple rapid reloads
    reloadTimeout = setTimeout(() => {
      reloadExtension();
    }, 1000);
  }

  // Monitor for storage changes (can be triggered by external build process)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.extensionReload) {
      console.log("🔄 Extension Auto-Reload: Build detected, reloading...");
      checkForChanges();
    }
  });

  // Monitor for messages from the build process
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "RELOAD_EXTENSION") {
      console.log("🔄 Extension Auto-Reload: Reload message received");
      checkForChanges();
    }
  });

  // Set up a periodic check as a fallback
  // This ensures we catch changes even if other methods fail
  setInterval(() => {
    // Check if we're still in development mode
    if (process.env.NODE_ENV !== "production") {
      // This is a lightweight check that doesn't cause performance issues
      chrome.storage.local.get(["lastBuildTime"], (result) => {
        if (result.lastBuildTime) {
          const now = Date.now();
          const lastBuild = result.lastBuildTime;
          // If build was more recent than 5 seconds ago, consider reloading
          if (now - lastBuild < 5000) {
            checkForChanges();
          }
        }
      });
    }
  }, 3000); // Increased interval to reduce performance impact

  console.log("✅ Extension Auto-Reload: Initialized successfully");
})();
