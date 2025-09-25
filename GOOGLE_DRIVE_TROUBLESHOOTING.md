# Google Drive Sync Troubleshooting Guide

## Issue: Empty JSON file being saved to Google Drive

### Files Created for Testing:

1. `test-data.txt` - General test information
2. `expected-google-drive-data.json` - Example of what should be saved
3. Enhanced console logging in the app

### Testing Steps:

#### 1. Basic Test (Start Here)

1. Open the app in your browser
2. Open Developer Tools (F12) and go to Console tab
3. Sign in to Google Drive using the sync button
4. Click the "More" button (three dots) in the toolbar
5. Select "Simple Test Sync" from the dropdown
6. Watch the console for detailed logging
7. Check if the `tabula-notes.json` file in Google Drive contains data

#### 2. Advanced Test

1. If Simple Test works, try "Test Sync with Sample Data"
2. This creates a more complex note with formatting

#### 3. Force Sync Test

1. Create a new note in the app
2. Add some content
3. Use "Force Sync Current Notes" to sync your actual notes

### Console Logging to Watch For:

#### Successful Sync:

```
🧪 [Simple Test] Starting simple test sync...
📝 [Google Drive] Simple test note created: {...}
🔄 [Google Drive] Starting save operation...
📊 [Google Drive] Sync data prepared: {...}
✅ [Google Drive] Save successful!
```

#### Failed Sync:

```
❌ [Google Drive] Error saving notes to drive: [error details]
```

### Expected Google Drive File Structure:

The file `tabula-notes.json` should contain:

```json
{
  "notes": [
    {
      "id": "simple-test-[timestamp]",
      "name": "Simple Test Note",
      "content": "[BlockNote JSON blocks]",
      "createdAt": [timestamp],
      "lastUpdatedAt": [timestamp]
    }
  ],
  "syncMetadata": {
    "lastSync": [timestamp],
    "version": "1.0",
    "appVersion": "tabula-notes-v1"
  }
}
```

### Common Issues and Solutions:

#### 1. Empty JSON File

- **Cause**: Notes array is empty or sync function not receiving data
- **Solution**: Use "Simple Test Sync" to verify sync mechanism works

#### 2. Authentication Issues

- **Cause**: Not signed in or token expired
- **Solution**: Sign out and sign back in to Google Drive

#### 3. API Errors

- **Cause**: Google Drive API issues or quota exceeded
- **Solution**: Check console for specific error messages

#### 4. Network Issues

- **Cause**: No internet connection or blocked requests
- **Solution**: Check network connection and firewall settings

### Debug Information:

- All sync operations are logged to console with 🧪, 📝, 🔄, ✅, or ❌ prefixes
- Check browser Network tab for failed API requests
- Verify Google Drive API credentials are correct

### Next Steps:

1. Try the Simple Test Sync first
2. Check console logs for any errors
3. If it works, the sync mechanism is functional
4. If it doesn't work, there's an API or authentication issue
