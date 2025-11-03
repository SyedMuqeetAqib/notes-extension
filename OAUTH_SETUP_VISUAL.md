# OAuth Setup Visual Guide

## Current Status

❌ **Error**: `OAuth2 request failed: Service responded with error: 'bad client id: {0}'`
✅ **Fallback system**: Working correctly
🔧 **Next step**: Set up OAuth client ID

## Step-by-Step Setup

### 1. Get Extension ID

```
1. Open Chrome
2. Go to chrome://extensions/
3. Enable Developer mode (toggle top right)
4. Find "TabulaNote" extension
5. Copy the Extension ID (looks like: abcdefghijklmnopqrstuvwxyz123456)
```

### 2. Create OAuth Client ID

```
1. Go to https://console.cloud.google.com/
2. Select your project (or create new one)
3. Navigate to APIs & Services > Credentials
4. Click Create Credentials > OAuth 2.0 Client IDs
5. Choose "Chrome extension" as application type
6. Enter your Extension ID from Step 1
7. Click Create
8. Copy the generated Client ID (ends with .apps.googleusercontent.com)
```

### 3. Update Extension

**Option A: Use helper script**

```bash
node setup-oauth.js YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com
```

**Option B: Manual edit**
Edit `public/manifest.json`:

```json
{
  "oauth2": {
    "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com"
  }
}
```

### 4. Rebuild and Test

```bash
npm run build
```

Then reload extension in Chrome.

## Expected Result

After setup, you should see:

- ✅ No more "bad client id" errors
- ✅ Successful OAuth flow
- ✅ Proper sign-in functionality
- ✅ Google Drive sync working

## Current Manifest (Needs Update)

```json
{
  "oauth2": {
    "client_id": "YOUR_CHROME_EXTENSION_CLIENT_ID.apps.googleusercontent.com"  ← This is a placeholder
  }
}
```

## Troubleshooting

- Make sure client ID ends with `.apps.googleusercontent.com`
- Ensure extension ID in Google Cloud Console matches your actual extension ID
- Check that OAuth client is "Chrome extension" type, not "Web application"
- Rebuild and reload extension after changes
