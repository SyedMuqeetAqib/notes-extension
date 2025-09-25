"use client";

// A lot of this code is from the Google Drive API documentation
// https://developers.google.com/drive/api/guides/file

import { SecureAuthManager } from "./secure-auth-manager";

// TypeScript declarations for Google APIs
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
  namespace google {
    namespace accounts {
      namespace oauth2 {
        interface TokenResponse {
          access_token: string;
          expires_in: number;
          scope: string;
          token_type: string;
        }
        interface TokenClient {
          requestAccessToken: (options?: { prompt?: string }) => void;
        }
        function initTokenClient(config: {
          client_id: string;
          scope: string;
          callback: (response: TokenResponse) => void;
        }): TokenClient;
        function revoke(token: string, callback: () => void): void;
      }
    }
  }
  const gapi: any;
}

export type Note = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  lastUpdatedAt: number;
};

// Console log the Note type structure for debugging
console.log("📋 [Google Drive] Note type structure:", {
  type: "Note",
  properties: {
    id: "string - unique identifier for the note",
    name: "string - display name of the note",
    content: "string - JSON string of BlockNote editor blocks (not HTML)",
    createdAt: "number - timestamp when note was created",
    lastUpdatedAt: "number - timestamp when note was last modified",
  },
  example: {
    id: "note-1234567890",
    name: "My Sample Note",
    content: JSON.stringify([
      {
        id: "1",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "Hello World!", styles: {} }],
        children: [],
      },
    ]),
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
  },
});

let tokenClient: google.accounts.oauth2.TokenClient | null = null;

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const APP_FOLDER = "Tabula-notes";
const NOTES_FILE_NAME_PREFIX = "tabula-notes";
const TOKEN_STORAGE_KEY = "tabula-google-token";

let gapiLoaded = false;
let gisLoaded = false;

// Cache for folder and file IDs to prevent repeated API calls
let cachedAppFolderId: string | null = null;
let cachedNotesFileId: string | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function clearCache() {
  cachedAppFolderId = null;
  cachedNotesFileId = null;
  cacheTimestamp = 0;
  console.log("🗑️ [Google Drive] Cache cleared");
}

/**
 * Generate a filename with current timestamp
 */
function generateNotesFileName(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, -5); // Remove milliseconds and colons
  return `${NOTES_FILE_NAME_PREFIX}-${timestamp}.json`;
}

/**
 * Force clear cache and re-sync (useful for debugging)
 */
export function clearDriveCache(): void {
  clearCache();
  console.log(
    "🔄 [Google Drive] Drive cache cleared - next sync will be fresh"
  );
}

/**
 * Simple test function to verify Google Drive API is working
 */
export async function debugTestDriveAPI(): Promise<void> {
  if (!gapi.client.getToken()) {
    console.error("❌ [Google Drive Debug] Not signed in");
    return;
  }

  try {
    console.log("🧪 [Google Drive Debug] Testing basic API connectivity...");

    // Test 1: List files in root
    const rootResponse = await gapi.client.drive.files.list({
      q: "trashed=false",
      fields: "files(id, name, mimeType, parents)",
      pageSize: 5,
    });

    console.log("✅ [Google Drive Debug] API connectivity test passed:", {
      filesFound: rootResponse.result.files?.length || 0,
      sampleFiles: rootResponse.result.files?.slice(0, 3).map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        hasParents: !!f.parents,
      })),
    });

    // Test 2: Check if we can create a folder
    console.log("🧪 [Google Drive Debug] Testing folder creation...");
    const testFolderResponse = await gapi.client.drive.files.create({
      resource: {
        name: "Tabula-notes-test-folder",
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id, name",
    });

    if (testFolderResponse.result.id) {
      console.log("✅ [Google Drive Debug] Folder creation test passed:", {
        folderId: testFolderResponse.result.id,
        folderName: testFolderResponse.result.name,
      });

      // Clean up test folder
      await gapi.client.drive.files.delete({
        fileId: testFolderResponse.result.id,
      });
      console.log("🗑️ [Google Drive Debug] Test folder cleaned up");
    }
  } catch (error) {
    console.error("❌ [Google Drive Debug] API test failed:", error);
  }
}

/**
 * Debug function to list all files in the app folder
 */
export async function debugListDriveFiles(): Promise<void> {
  if (!gapi.client.getToken()) {
    console.error("❌ [Google Drive Debug] Not signed in");
    return;
  }

  try {
    const folderId = await getAppFolderId();
    if (!folderId) {
      console.log("📁 [Google Drive Debug] No app folder found");
      return;
    }

    console.log(
      "🔍 [Google Drive Debug] Listing files in app folder:",
      folderId
    );

    const response = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, mimeType, size, createdTime, modifiedTime)",
    });

    const files = response.result.files || [];
    console.log("📋 [Google Drive Debug] Files found:", {
      count: files.length,
      files: files.map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      })),
    });

    // Also check for any files with "Untitled" in the root
    const rootResponse = await gapi.client.drive.files.list({
      q: `name contains 'Untitled' and trashed=false`,
      fields: "files(id, name, mimeType, parents, size, createdTime)",
    });

    const untitledFiles = rootResponse.result.files || [];
    if (untitledFiles.length > 0) {
      console.log("⚠️ [Google Drive Debug] Found Untitled files in root:", {
        count: untitledFiles.length,
        files: untitledFiles.map((file: any) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          parents: file.parents,
          size: file.size,
          createdTime: file.createdTime,
        })),
      });
    }
  } catch (error) {
    console.error("❌ [Google Drive Debug] Error listing files:", error);
  }
}

// Sync lock to prevent concurrent sync operations
let syncInProgress = false;
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 1000; // Minimum 1 second between syncs

function loadScript(src: string, onload: () => void) {
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.defer = true;
  script.onload = onload;
  document.body.appendChild(script);
}

function ensureGoogleScriptsLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (gapiLoaded && gisLoaded) {
      resolve();
      return;
    }

    const checkScripts = () => {
      if (gapiLoaded && gisLoaded) {
        resolve();
      }
    };

    if (!gapiLoaded) {
      loadScript("https://apis.google.com/js/api.js", () => {
        gapiLoaded = true;
        gapi.load("client", checkScripts);
      });
    }

    if (!gisLoaded) {
      loadScript("https://accounts.google.com/gsi/client", () => {
        gisLoaded = true;
        checkScripts();
      });
    }
  });
}

/**
 * Callback after the GIS client is loaded.
 */
export async function initGis(
  clientId: string,
  callback: (tokenResponse: google.accounts.oauth2.TokenResponse) => void
) {
  await ensureGoogleScriptsLoaded();
  if (
    !window.google ||
    !window.google.accounts ||
    !window.google.accounts.oauth2
  ) {
    // This should not happen if loadGapi is awaited correctly
    throw new Error("Google Identity Services not loaded");
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (tokenResponse: google.accounts.oauth2.TokenResponse) => {
      // Store token for session persistence
      if (tokenResponse.access_token) {
        callback(tokenResponse);
      }
    },
  });
}

/**
 *  Sign in the user upon button click.
 */
export function requestToken() {
  if (!tokenClient) {
    throw new Error("Token client not initialized");
  }
  // Settle this promise in the response callback for requestAccessToken()
  tokenClient.requestAccessToken({ prompt: "consent" });
}

/**
 *  Sign out the user upon button click.
 */
export async function signOut(): Promise<void> {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {});
    gapi.client.setToken(null);
    await SecureAuthManager.clearToken();
  }
}

/**
 * Set the token for gapi client
 */
export function setToken(token: google.accounts.oauth2.TokenResponse | null) {
  gapi.client.setToken(token);
}

/**
 * Save token securely for long-term persistence
 */
export async function saveTokenToStorage(
  token: google.accounts.oauth2.TokenResponse
): Promise<void> {
  await SecureAuthManager.saveToken(token);
}

/**
 * Get valid token from secure storage
 */
export async function getTokenFromStorage(): Promise<google.accounts.oauth2.TokenResponse | null> {
  return await SecureAuthManager.getValidToken();
}

/**
 * Check if user is signed in with valid token
 */
export async function isUserSignedIn(): Promise<boolean> {
  return await SecureAuthManager.isSignedIn();
}

/**
 * Load the GAPI client.
 */
export async function loadGapi(): Promise<void> {
  await ensureGoogleScriptsLoaded();
  await new Promise<void>((resolve, reject) => {
    gapi.load("client", () => {
      gapi.client
        .init({
          apiKey: GOOGLE_API_KEY,
          discoveryDocs: [DISCOVERY_DOC],
        })
        .then(() => resolve())
        .catch((e: any) => reject(e));
    });
  });
}

async function getAppFolderId(): Promise<string | null> {
  // Check cache first
  const now = Date.now();
  if (cachedAppFolderId && now - cacheTimestamp < CACHE_DURATION) {
    console.log(
      "💾 [Google Drive] Using cached app folder ID:",
      cachedAppFolderId
    );
    return cachedAppFolderId;
  }

  console.log("🔍 [Google Drive] Searching for app folder...");
  try {
    const response = await gapi.client.drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER}' and trashed=false`,
      fields: "files(id)",
    });

    console.log("📡 [Google Drive] App folder search response:", {
      status: response.status,
      filesFound: response.result.files?.length || 0,
    });

    const files = response.result.files;
    if (files && files.length > 0) {
      cachedAppFolderId = files[0].id!;
      cacheTimestamp = now;
      console.log(
        "✅ [Google Drive] App folder found and cached:",
        cachedAppFolderId
      );
      return cachedAppFolderId;
    } else {
      cachedAppFolderId = null;
      cacheTimestamp = now;
      console.log("❌ [Google Drive] App folder not found");
      return null;
    }
  } catch (err) {
    console.error("❌ [Google Drive] Error searching for app folder:", err);
    return null;
  }
}

async function createAppFolder(): Promise<string | null> {
  try {
    const response = await gapi.client.drive.files.create({
      resource: {
        name: APP_FOLDER,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });
    const folderId = response.result.id!;
    // Clear cache since we created a new folder
    clearCache();
    cachedAppFolderId = folderId;
    cacheTimestamp = Date.now();
    return folderId;
  } catch (err) {
    console.error("Error creating app folder:", err);
    return null;
  }
}

async function getNotesFileId(folderId: string): Promise<string | null> {
  // Check cache first
  const now = Date.now();
  if (cachedNotesFileId && now - cacheTimestamp < CACHE_DURATION) {
    console.log(
      "💾 [Google Drive] Using cached notes file ID:",
      cachedNotesFileId
    );
    return cachedNotesFileId;
  }

  console.log(
    "🔍 [Google Drive] Searching for most recent notes file in folder:",
    folderId
  );
  try {
    // Search for files that start with our prefix and are in the correct folder
    const response = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and name contains '${NOTES_FILE_NAME_PREFIX}' and trashed=false`,
      fields: "files(id, name, createdTime, modifiedTime)",
      orderBy: "modifiedTime desc", // Get the most recently modified file
      pageSize: 1, // Only get the most recent one
    });

    console.log("📡 [Google Drive] Notes file search response:", {
      status: response.status,
      filesFound: response.result.files?.length || 0,
    });

    const files = response.result.files;
    const fileId = files && files.length > 0 ? files[0].id! : null;
    cachedNotesFileId = fileId;
    cacheTimestamp = now;

    if (fileId) {
      console.log(
        "✅ [Google Drive] Most recent notes file found and cached:",
        {
          fileId,
          fileName: files[0].name,
          modifiedTime: files[0].modifiedTime,
        }
      );
    } else {
      console.log("❌ [Google Drive] No notes files found");
    }

    return fileId;
  } catch (err) {
    console.error("❌ [Google Drive] Error searching for notes file:", err);
    return null;
  }
}

export async function saveNotesToDrive(notes: Note[]): Promise<void> {
  console.log("🔄 [Google Drive] Starting save operation...", {
    notesCount: notes.length,
    timestamp: new Date().toISOString(),
    notesArray: notes, // Log the actual notes array
  });

  if (!gapi.client.getToken()) {
    console.error("❌ [Google Drive] Not signed in - cannot save");
    throw new Error("Not signed in");
  }

  // If no notes provided, create a test note to ensure we're not saving empty data
  let notesToSave = notes;
  if (notes.length === 0) {
    console.log(
      "⚠️ [Google Drive] No notes provided, creating debug test note..."
    );
    const testNote = createTestNoteWithContent();
    notesToSave = [testNote];
    console.log("📝 [Google Drive] Debug test note created:", {
      testNoteId: testNote.id,
      testNoteName: testNote.name,
      testNoteContentLength: testNote.content.length,
    });
  } else {
    console.log("📝 [Google Drive] Using provided notes:", {
      notesCount: notes.length,
      noteDetails: notes.map((note, index) => ({
        index,
        id: note.id,
        name: note.name,
        contentLength: note.content.length,
        hasContent: note.content && note.content.length > 0,
        contentPreview: note.content
          ? note.content.substring(0, 100) + "..."
          : "NO CONTENT",
      })),
    });
  }

  // Prevent concurrent sync operations
  if (syncInProgress) {
    console.log("⏸️ [Google Drive] Sync already in progress, skipping...");
    return;
  }

  // Prevent rapid successive syncs
  const now = Date.now();
  if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
    console.log("⏱️ [Google Drive] Sync too soon, skipping...", {
      timeSinceLastSync: now - lastSyncTime,
      minInterval: MIN_SYNC_INTERVAL,
    });
    return;
  }

  syncInProgress = true;
  lastSyncTime = now;
  console.log("🔒 [Google Drive] Sync lock acquired");

  let folderId = await getAppFolderId();
  console.log(
    "📁 [Google Drive] App folder ID:",
    folderId ? "Found" : "Not found"
  );

  if (!folderId) {
    console.log("📁 [Google Drive] Creating new app folder...");
    folderId = await createAppFolder();
    if (!folderId) {
      console.error("❌ [Google Drive] Failed to create app folder");
      throw new Error("Could not create app folder in Google Drive.");
    }
    console.log("✅ [Google Drive] App folder created successfully:", folderId);
  }

  let fileId = await getNotesFileId(folderId);
  console.log(
    "📄 [Google Drive] Notes file ID:",
    fileId ? "Found" : "Not found"
  );

  // Add metadata to track sync information
  const syncData = {
    notes: notesToSave,
    syncMetadata: {
      lastSync: Date.now(),
      version: "1.0",
      appVersion: "tabula-notes-v1",
    },
  };

  const content = JSON.stringify(syncData, null, 2);
  const blob = new Blob([content], { type: "application/json" });

  console.log("📊 [Google Drive] Sync data prepared:", {
    dataSize: content.length,
    notesCount: notesToSave.length,
    syncMetadata: syncData.syncMetadata,
  });

  // Console log the complete data structure that should be stored in Google Drive
  console.log("🔍 [Google Drive] Complete data structure to be stored:", {
    structure: "Object with 'notes' array and 'syncMetadata' object",
    example: {
      notes: [
        {
          id: "note-1234567890",
          name: "My Note Title",
          content: "JSON string of BlockNote editor blocks",
          createdAt: 1234567890000,
          lastUpdatedAt: 1234567890000,
        },
      ],
      syncMetadata: {
        lastSync: 1234567890000,
        version: "1.0",
        appVersion: "tabula-notes-v1",
      },
    },
    actualData: syncData,
    noteContentExample:
      notesToSave.length > 0
        ? {
            noteId: notesToSave[0].id,
            noteName: notesToSave[0].name,
            contentPreview: notesToSave[0].content.substring(0, 200) + "...",
            contentType: "BlockNote JSON blocks (not HTML)",
          }
        : "No notes to show example",
  });

  // Determine if we should create a new file or update existing one
  const isNewFile = !fileId;
  const fileName = isNewFile ? generateNotesFileName() : "tabula-notes.json";

  const metadata = {
    name: fileName,
    mimeType: "application/json",
    parents: isNewFile ? [folderId] : undefined, // Only set parents for new files
    description:
      "Tabula Notes - Auto-synced note data with formatting preserved",
  };

  console.log("🚀 [Google Drive] Uploading to Drive:", {
    method: isNewFile ? "CREATE + PATCH (new file)" : "PATCH (update existing)",
    fileName: fileName,
    folderId: folderId,
    fileId: fileId,
    isNewFile: isNewFile,
    contentSize: content.length,
    hasValidContent: content.length > 0,
    contentPreview: content.substring(0, 200) + "...",
    metadata: {
      name: metadata.name,
      mimeType: metadata.mimeType,
      parents: metadata.parents,
      description: metadata.description,
    },
  });

  try {
    let targetFileId: string;

    if (isNewFile) {
      // Create new file
      console.log("🚀 [Google Drive] Step 1: Creating new file metadata...");

      const createResponse = await gapi.client.drive.files.create({
        resource: metadata,
        fields: "id, name, parents",
      });

      console.log("📡 [Google Drive] File creation response:", {
        status: createResponse.status,
        fileId: createResponse.result.id,
        fileName: createResponse.result.name,
        parents: createResponse.result.parents,
        expectedFolderId: folderId,
        folderAssignmentCorrect:
          createResponse.result.parents?.includes(folderId),
      });

      if (!createResponse.result.id) {
        throw new Error("Failed to create file - no file ID returned");
      }

      targetFileId = createResponse.result.id;
    } else {
      // Update existing file
      console.log(
        "🚀 [Google Drive] Step 1: Updating existing file metadata..."
      );

      const updateResponse = await gapi.client.drive.files.update({
        fileId: fileId,
        resource: {
          name: metadata.name,
          description: metadata.description,
        },
        fields: "id, name, parents",
      });

      console.log("📡 [Google Drive] File update response:", {
        status: updateResponse.status,
        fileId: updateResponse.result.id,
        fileName: updateResponse.result.name,
        parents: updateResponse.result.parents,
        expectedFolderId: folderId,
        folderAssignmentCorrect:
          updateResponse.result.parents?.includes(folderId),
      });

      targetFileId = fileId;
    }

    console.log("🚀 [Google Drive] Step 2: Uploading file content...");

    // Upload the content using media upload
    const response = await gapi.client.request({
      path: `/upload/drive/v3/files/${targetFileId}`,
      method: "PATCH",
      params: { uploadType: "media" },
      body: content,
    });

    console.log("📡 [Google Drive] Content upload response:", {
      status: response.status,
      statusText: response.statusText,
      success: response.status >= 200 && response.status < 300,
    });

    if (response.status < 200 || response.status >= 300) {
      console.error("❌ [Google Drive] Content upload failed:", response.body);
      throw new Error(`Failed to upload file content: ${response.body}`);
    }

    // Clear cache since we modified the file
    clearCache();

    console.log("✅ [Google Drive] Save successful!", {
      operation: isNewFile ? "Created new file" : "Updated existing file",
      fileId: targetFileId,
      fileName: fileName,
      folderId: folderId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ [Google Drive] Error saving notes to drive:", err);
    const error = err as { result?: { error?: { message: string } } };
    const errorMessage =
      error.result?.error?.message ||
      "An unknown error occurred while saving to Drive.";
    console.error("❌ [Google Drive] Error details:", {
      errorMessage,
      errorType: typeof err,
      errorStack: err instanceof Error ? err.stack : undefined,
    });
    throw new Error(errorMessage);
  } finally {
    // Always release the sync lock
    syncInProgress = false;
    console.log("🔓 [Google Drive] Sync lock released");
  }
}

/**
 * Create a simple test note with basic content
 */
export function createSimpleTestNote(): Note {
  const simpleTestNote: Note = {
    id: `simple-test-${Date.now()}`,
    name: "Simple Test Note",
    content: JSON.stringify([
      {
        id: "1",
        type: "paragraph",
        props: {},
        content: [
          {
            type: "text",
            text: "This is a simple test note to verify Google Drive sync is working.",
            styles: {},
          },
        ],
        children: [],
      },
    ]),
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
  };

  console.log("📝 [Google Drive] Simple test note created:", {
    id: simpleTestNote.id,
    name: simpleTestNote.name,
    contentLength: simpleTestNote.content.length,
    timestamp: new Date().toISOString(),
  });

  return simpleTestNote;
}

/**
 * Create a test note with actual content for debugging
 */
export function createTestNoteWithContent(): Note {
  const testNote: Note = {
    id: `debug-note-${Date.now()}`,
    name: "Debug Test Note - Real Content",
    content: JSON.stringify([
      {
        id: "1",
        type: "paragraph",
        props: {},
        content: [
          { type: "text", text: "🔍 ", styles: {} },
          {
            type: "text",
            text: "Debug Test Note",
            styles: { bold: true },
          },
          { type: "text", text: " 🔍", styles: {} },
        ],
        children: [],
      },
      {
        id: "2",
        type: "paragraph",
        props: {},
        content: [
          {
            type: "text",
            text: "This is a test note created to debug the Google Drive sync issue. It contains real BlockNote content that should be properly saved.",
            styles: {},
          },
        ],
        children: [],
      },
      {
        id: "3",
        type: "paragraph",
        props: {},
        content: [
          {
            type: "text",
            text: "Timestamp: ",
            styles: { bold: true },
          },
          {
            type: "text",
            text: new Date().toISOString(),
            styles: { italic: true },
          },
        ],
        children: [],
      },
    ]),
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
  };

  console.log("📝 [Google Drive] Debug test note created:", {
    id: testNote.id,
    name: testNote.name,
    contentLength: testNote.content.length,
    contentPreview: testNote.content.substring(0, 200) + "...",
  });

  return testNote;
}

/**
 * Create a test note for Google Drive sync testing
 */
export function createTestNote(): Note {
  const testNote: Note = {
    id: `test-note-${Date.now()}`,
    name: "Test Note - Google Drive Sync",
    content: JSON.stringify([
      {
        id: "1",
        type: "paragraph",
        props: {},
        content: [
          { type: "text", text: "🎉 ", styles: {} },
          {
            type: "text",
            text: "Google Drive Sync Test",
            styles: { bold: true },
          },
          { type: "text", text: " 🎉", styles: {} },
        ],
        children: [],
      },
      {
        id: "2",
        type: "paragraph",
        props: {},
        content: [
          {
            type: "text",
            text: "This is a test note created to verify Google Drive sync is working properly.",
            styles: {},
          },
        ],
        children: [],
      },
      {
        id: "3",
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Sync Status", styles: {} }],
        children: [],
      },
      {
        id: "4",
        type: "bulletListItem",
        props: {},
        content: [
          { type: "text", text: "✅ ", styles: {} },
          { type: "text", text: "File created successfully", styles: {} },
        ],
        children: [],
      },
      {
        id: "5",
        type: "bulletListItem",
        props: {},
        content: [
          { type: "text", text: "✅ ", styles: {} },
          { type: "text", text: "Data structure is correct", styles: {} },
        ],
        children: [],
      },
      {
        id: "6",
        type: "bulletListItem",
        props: {},
        content: [
          { type: "text", text: "✅ ", styles: {} },
          { type: "text", text: "Sync metadata included", styles: {} },
        ],
        children: [],
      },
      {
        id: "7",
        type: "paragraph",
        props: {},
        content: [
          { type: "text", text: "Timestamp: ", styles: {} },
          {
            type: "text",
            text: new Date().toISOString(),
            styles: { code: true },
          },
        ],
        children: [],
      },
    ]),
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
  };

  console.log("📝 [Google Drive] Test note created:", {
    id: testNote.id,
    name: testNote.name,
    contentLength: testNote.content.length,
    timestamp: new Date().toISOString(),
  });

  return testNote;
}

export async function loadNotesFromDrive(): Promise<Note[] | null> {
  console.log("📥 [Google Drive] Starting load operation...", {
    timestamp: new Date().toISOString(),
  });

  if (!gapi.client.getToken()) {
    console.error("❌ [Google Drive] Not signed in - cannot load");
    throw new Error("Not signed in");
  }

  // Prevent concurrent sync operations
  if (syncInProgress) {
    console.log("⏸️ [Google Drive] Sync already in progress, skipping load...");
    return null;
  }

  // Prevent rapid successive syncs
  const now = Date.now();
  if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
    console.log("⏱️ [Google Drive] Load too soon, skipping...", {
      timeSinceLastSync: now - lastSyncTime,
      minInterval: MIN_SYNC_INTERVAL,
    });
    return null;
  }

  syncInProgress = true;
  lastSyncTime = now;
  console.log("🔒 [Google Drive] Load lock acquired");

  try {
    const folderId = await getAppFolderId();
    console.log(
      "📁 [Google Drive] App folder ID for load:",
      folderId ? "Found" : "Not found"
    );

    if (!folderId) {
      console.log("📁 [Google Drive] No app folder found - no notes to load");
      return null; // No app folder, so no notes to load
    }

    const fileId = await getNotesFileId(folderId);
    console.log(
      "📄 [Google Drive] Notes file ID for load:",
      fileId ? "Found" : "Not found"
    );

    if (!fileId) {
      console.log("📄 [Google Drive] No notes file found - no notes to load");
      return null; // No notes file, so no notes to load
    }

    console.log("📡 [Google Drive] Fetching file content from Drive...", {
      fileId,
    });
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: "media",
    });

    console.log("📡 [Google Drive] Load API Response:", {
      status: response.status,
      statusText: response.statusText,
      success: response.status === 200,
      bodySize: response.body ? String(response.body).length : 0,
    });

    if (response.status !== 200) {
      console.error("❌ [Google Drive] Load failed:", response.body);
      throw new Error(`Failed to load file: ${response.body}`);
    }

    // The body is a string, so we need to parse it as JSON.
    // GAPI types are a bit tricky here, so we cast to 'any' first.
    const data = JSON.parse(response.body as any);
    console.log("📊 [Google Drive] Parsed data:", {
      dataType: Array.isArray(data) ? "array" : typeof data,
      hasNotes: !Array.isArray(data) && data.notes ? "yes" : "no",
      notesCount: Array.isArray(data)
        ? data.length
        : data.notes
        ? data.notes.length
        : 0,
    });

    // Console log the complete data structure that was loaded from Google Drive
    console.log("🔍 [Google Drive] Data structure loaded from Drive:", {
      rawData: data,
      dataStructure: {
        isArray: Array.isArray(data),
        hasNotesProperty: !Array.isArray(data) && data.notes,
        hasSyncMetadata: !Array.isArray(data) && data.syncMetadata,
        expectedStructure:
          "Object with 'notes' array and 'syncMetadata' object",
      },
      notesPreview: Array.isArray(data)
        ? data.slice(0, 2).map((note: any) => ({
            id: note.id,
            name: note.name,
            contentLength: note.content?.length || 0,
            createdAt: note.createdAt,
            lastUpdatedAt: note.lastUpdatedAt,
          }))
        : data.notes
        ? data.notes.slice(0, 2).map((note: any) => ({
            id: note.id,
            name: note.name,
            contentLength: note.content?.length || 0,
            createdAt: note.createdAt,
            lastUpdatedAt: note.lastUpdatedAt,
          }))
        : "No notes found",
      syncMetadata: !Array.isArray(data)
        ? data.syncMetadata
        : "Not available (old format)",
    });

    // Handle both old format (direct array) and new format (with metadata)
    let notes: Note[];
    if (Array.isArray(data)) {
      // Old format - direct array of notes
      console.log("📋 [Google Drive] Using old format (direct array)");
      notes = data as Note[];
    } else if (data.notes && Array.isArray(data.notes)) {
      // New format - with sync metadata
      console.log("📋 [Google Drive] Using new format (with metadata)", {
        syncMetadata: data.syncMetadata,
      });
      notes = data.notes as Note[];
    } else {
      console.warn(
        "⚠️ [Google Drive] Unexpected data format from Google Drive:",
        data
      );
      return null;
    }

    console.log("✅ [Google Drive] Load successful!", {
      notesCount: notes.length,
      timestamp: new Date().toISOString(),
    });

    return notes;
  } catch (err) {
    console.error("❌ [Google Drive] Error loading notes from drive:", err);
    const error = err as { result?: { error?: { message: string } } };
    const errorMessage =
      error.result?.error?.message ||
      "An unknown error occurred while loading from Drive.";
    console.error("❌ [Google Drive] Error details:", {
      errorMessage,
      errorType: typeof err,
      errorStack: err instanceof Error ? err.stack : undefined,
    });
    throw new Error(errorMessage);
  } finally {
    // Always release the sync lock
    syncInProgress = false;
    console.log("🔓 [Google Drive] Load lock released");
  }
}
