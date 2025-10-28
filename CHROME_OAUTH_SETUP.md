# Chrome Extension OAuth Setup Guide

## The Problem

You're getting the error: `Chrome identity error: {message: 'Invalid OAuth2 Client ID.'}`

This happens because the Chrome extension needs a properly configured OAuth2 client ID that's specifically set up for Chrome extensions.

## Solution Steps

### 1. Create OAuth2 Client ID for Chrome Extension

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client IDs**
5. Choose **Chrome extension** as the application type
6. Fill in the details:
   - **Name**: `TabulaNote Chrome Extension`
   - **Application ID**: Get this from your extension's manifest (it's the extension ID from Chrome's developer mode)

### 2. Get Your Extension ID

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Load your extension by clicking **Load unpacked** and selecting your `out` folder
4. Copy the **Extension ID** (it looks like: `abcdefghijklmnopqrstuvwxyz123456`)

### 3. Update the OAuth Client ID

1. In Google Cloud Console, when creating the OAuth client:
   - **Application type**: Chrome extension
   - **Application ID**: Paste your extension ID here
2. Click **Create**
3. Copy the generated **Client ID** (it looks like: `123456789-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com`)

### 4. Update Your Manifest

Replace the placeholder in `public/manifest.json`:

```json
{
  "oauth2": {
    "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  }
}
```

### 5. Rebuild and Test

1. Run your build script:

   ```bash
   npm run build
   # or
   yarn build
   ```

2. Reload the extension in Chrome:

   - Go to `chrome://extensions/`
   - Click the refresh icon on your extension

3. Test the OAuth flow

## Alternative: Use Environment Variable

If you want to keep the client ID configurable, you can:

1. Create a `.env.local` file:

   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
   ```

2. Update the manifest to use a placeholder that gets replaced during build

## Troubleshooting

### Still getting "Invalid OAuth2 Client ID"?

- Make sure the client ID in the manifest matches exactly what's in Google Cloud Console
- Ensure the extension ID in Google Cloud Console matches your actual extension ID
- Check that the OAuth client is set up as "Chrome extension" type, not "Web application"

### Extension not loading?

- Make sure you're loading the `out` folder, not the `src` folder
- Check the browser console for any errors
- Verify all permissions are correctly set in the manifest

### OAuth popup not appearing?

- Check that the `identity` permission is in your manifest
- Ensure the scopes match what you've configured in Google Cloud Console
- Try clearing browser data and reloading the extension

## Testing the Fix

After following these steps, the OAuth flow should work properly. You should see:

1. A Google OAuth consent screen when clicking sign in
2. Successful token retrieval
3. No more "Invalid OAuth2 Client ID" errors

## Notes

- The Chrome identity API automatically handles the OAuth flow
- No need to manually handle redirects or callbacks
- The token is automatically managed by Chrome
- Make sure to test in the actual Chrome extension environment, not just localhost
