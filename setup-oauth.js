#!/usr/bin/env node

/**
 * OAuth Setup Helper Script
 * This script helps configure the OAuth client ID for the Chrome extension
 */

const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = path.join(__dirname, "public", "manifest.json");

function updateManifestWithClientId(clientId) {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

    if (!manifest.oauth2) {
      manifest.oauth2 = {
        client_id: "",
        scopes: [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
        ],
      };
    }

    manifest.oauth2.client_id = clientId;

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log("✅ Manifest updated with OAuth client ID");
    console.log(`📝 Client ID: ${clientId}`);
  } catch (error) {
    console.error("❌ Error updating manifest:", error.message);
    process.exit(1);
  }
}

function validateClientId(clientId) {
  if (!clientId) {
    console.error("❌ Client ID is required");
    return false;
  }

  if (!clientId.includes(".apps.googleusercontent.com")) {
    console.error(
      "❌ Invalid client ID format. Should end with .apps.googleusercontent.com"
    );
    return false;
  }

  return true;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
🔧 Chrome Extension OAuth Setup Helper

Usage:
  node setup-oauth.js <client_id>

Example:
  node setup-oauth.js 123456789-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com

Steps to get your client ID:
1. Go to https://console.cloud.google.com/
2. Select your project
3. Navigate to APIs & Services > Credentials
4. Create OAuth 2.0 Client ID for Chrome extension
5. Use your extension ID (from chrome://extensions/)
6. Copy the generated client ID

Current manifest path: ${MANIFEST_PATH}
    `);
    process.exit(1);
  }

  const clientId = args[0];

  if (!validateClientId(clientId)) {
    process.exit(1);
  }

  updateManifestWithClientId(clientId);

  console.log(`
🎉 OAuth setup complete!

Next steps:
1. Run your build script: npm run build
2. Reload the extension in Chrome
3. Test the OAuth flow

If you need help, check CHROME_OAUTH_SETUP.md
  `);
}

main();
