# Quick OAuth Setup Guide

## The Issue

You're getting these errors:

- `OAuth2 request failed: Service responded with error: 'bad client id: {0}'`
- `window.google.accounts.oauth2.revoke is not a function`

## Quick Fix

### Step 1: Get Your Extension ID

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Load your extension (if not already loaded)
4. Copy the **Extension ID** (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

### Step 2: Create OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client IDs**
5. Choose **Chrome extension** as application type
6. Enter your extension ID from Step 1
7. Click **Create**
8. Copy the generated **Client ID**

### Step 3: Update Your Extension

Run this command with your actual client ID:

```bash
node setup-oauth.js YOUR_CLIENT_ID.apps.googleusercontent.com
```

Or manually edit `public/manifest.json`:

```json
{
  "oauth2": {
    "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com"
  }
}
```

### Step 4: Rebuild and Test

```bash
npm run build
```

Then reload your extension in Chrome.

## Why This Happens

- Chrome extensions need a **specific type** of OAuth client ID (Chrome extension, not web app)
- The client ID must be **registered** with your extension ID
- The placeholder `YOUR_CHROME_EXTENSION_CLIENT_ID.apps.googleusercontent.com` in the manifest is invalid

## Expected Result

After setup, you should see:

- ✅ No more "bad client id" errors
- ✅ Successful OAuth flow
- ✅ Proper sign-in functionality
- ✅ No more revoke function errors

## Troubleshooting

- Make sure the client ID ends with `.apps.googleusercontent.com`
- Ensure the extension ID in Google Cloud Console matches your actual extension ID
- Check that the OAuth client is set up as "Chrome extension" type, not "Web application"
