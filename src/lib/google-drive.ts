"use client";

// A lot of this code is from the Google Drive API documentation
// https://developers.google.com/drive/api/guides/file

import { SecureAuthManager } from "./secure-auth-manager";
import { IndexedDB } from "./indexeddb";

// TypeScript declarations for Google APIs and Chrome APIs
declare global {
  interface Window {
    google: any;
    gapi: any;
    _gapiToken?: any;
  }
  namespace google {
    namespace accounts {
      namespace oauth2 {
        interface TokenResponse {
          access_token: string;
          expires_in: number;
          scope: string;
          token_type: string;
          error?: string;
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

  // Chrome extension APIs
  namespace chrome {
    namespace identity {
      function getAuthToken(
        details: { interactive: boolean },
        callback: (token: string | null) => void
      ): void;
    }
    namespace runtime {
      const lastError: { message?: string } | null;
    }
  }
}

// Access gapi through the global window object
declare const gapi: typeof window.gapi;

/**
 * Make REST API calls to Google Drive API
 * This is used as a fallback when gapi is not available in Chrome extensions
 */
async function makeRestApiCall(options: {
  path: string;
  method: string;
  params?: any;
  body?: any;
}): Promise<any> {
  const token = window._gapiToken;
  if (!token || !token.access_token) {
    throw new Error("No valid access token available");
  }

  const baseUrl = "https://www.googleapis.com";
  const url = new URL(baseUrl + options.path);

  // Check if this is a media upload
  const uploadType = options.params?.uploadType;
  const isMediaUpload = uploadType === "media";

  // Add query parameters
  if (options.params) {
    Object.keys(options.params).forEach((key) => {
      url.searchParams.append(key, options.params[key]);
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.access_token}`,
  };

  const requestOptions: RequestInit = {
    method: options.method,
    headers,
  };

  if (options.body && options.method !== "GET") {
    if (isMediaUpload && typeof options.body === "string") {
      // For media uploads, send body as-is (raw string)
      requestOptions.body = options.body;
      headers["Content-Type"] = "application/json"; // JSON files
    } else {
      // For regular requests, JSON stringify the body
      requestOptions.body = JSON.stringify(options.body);
      headers["Content-Type"] = "application/json";
    }
  }

  console.log(
    `🔄 [Google Drive] REST API call: ${options.method} ${url.toString()}`
  );

  try {
    const response = await fetch(url.toString(), requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ [Google Drive] API error: ${response.status} ${response.statusText}`,
        errorText
      );
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    // Handle different response types
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      console.log(`✅ [Google Drive] API call successful`);
      return data;
    } else if (response.status === 204) {
      // No content (for DELETE operations)
      console.log(`✅ [Google Drive] API call successful (204 No Content)`);
      return {};
    } else {
      // For media uploads, return the response as text
      const text = await response.text();
      console.log(`✅ [Google Drive] API call successful`);
      return text;
    }
  } catch (error) {
    console.error(`❌ [Google Drive] REST API call failed:`, error);
    throw error;
  }
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
const SCOPES =
  "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";
const APP_FOLDER = "Tabula-notes";
const NOTES_FILE_NAME_PREFIX = "tabula-notes";
const TOKEN_STORAGE_KEY = "tabula-google-token";

let gapiLoaded = false;
let gisLoaded = false;

// Cache for folder and file IDs to prevent repeated API calls
let cachedAppFolderId: string | null = null;
let cachedNoteFiles: Map<string, string> | null = null; // noteId -> fileId
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Extended cache for file metadata
interface FileMetadataCache {
  fileId: string;
  name: string;
  modifiedTime: string;
  cachedAt: number;
}

let fileMetadataCache = new Map<string, FileMetadataCache>();
const METADATA_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function clearCache() {
  cachedAppFolderId = null;
  cachedNoteFiles = null;
  cacheTimestamp = 0;
  fileMetadataCache.clear();
  if (process.env.NODE_ENV === "development") {
    console.log("🗑️ [Google Drive] Cache cleared");
  }
}

/**
 * Clean up stale metadata cache entries
 */
function cleanupMetadataCache(): void {
  const now = Date.now();
  for (const [key, metadata] of fileMetadataCache.entries()) {
    if (now - metadata.cachedAt > METADATA_CACHE_DURATION) {
      fileMetadataCache.delete(key);
    }
  }
}

/**
 * Filter out image blocks from BlockNote JSON content
 * This ensures images are not synced to Google Drive while keeping them locally
 */
function filterOutImageBlocks(content: string): string {
  try {
    const blocks = JSON.parse(content);

    const filterBlocks = (blocks: any[]): any[] => {
      return blocks
        .filter((block) => block.type !== "image")
        .map((block) => {
          if (block.children && Array.isArray(block.children)) {
            return {
              ...block,
              children: filterBlocks(block.children),
            };
          }
          return block;
        });
    };

    if (Array.isArray(blocks)) {
      const filteredBlocks = filterBlocks(blocks);
      return JSON.stringify(filteredBlocks);
    }

    return content;
  } catch (error) {
    console.error("❌ [Google Drive] Failed to filter image blocks:", error);
    return content;
  }
}

/**
 * Generate a sanitized filename for a note
 * Uses note name for readability in Google Drive, with ID suffix for uniqueness
 */
function generateNoteFileName(note: Note): string {
  // Sanitize note name for filesystem (remove invalid chars, limit length)
  const safeName = note.name
    .replace(/[^a-z0-9-_\s]/gi, "_")
    .replace(/\s+/g, "_")
    .substring(0, 50);

  // Format: {sanitized-name}--{note-id}.json
  // Using double dash (--) to clearly separate name from ID
  return `${safeName}--${note.id}.json`;
}

/**
 * Extract note ID from filename
 */
function extractNoteIdFromFilename(filename: string): string | null {
  // Pattern: {name}--{noteId}.json
  // Look for the last occurrence of -- to handle names with dashes
  const match = filename.match(/--([^-]+(?:-[^-]+)*)\.json$/);
  if (match) {
    return match[1];
  }

  // Fallback: Try old format for backward compatibility
  // Old pattern: {name}-{noteId}.json or tabula-note-{noteId}.json
  const oldMatch = filename.match(/^(?:.*?-)?(.+?)\.json$/);
  return oldMatch ? oldMatch[1] : null;
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
  const token = window.gapi?.client?.getToken?.() || window._gapiToken;
  if (!token) {
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
 * Debug function to test basic Google Drive API connectivity
 */
export async function debugBasicAPI(): Promise<void> {
  console.log("🧪 [Google Drive Debug] Testing basic API connectivity...");

  try {
    // Check authentication
    const token = window.gapi?.client?.getToken?.() || window._gapiToken;
    if (!token) {
      console.error("❌ [Google Drive Debug] Not signed in");
      return;
    }
    console.log("✅ [Google Drive Debug] Authentication OK");

    // Check gapi client
    if (!window.gapi || !window.gapi.client) {
      console.error("❌ [Google Drive Debug] GAPI client not available");
      return;
    }
    console.log("✅ [Google Drive Debug] GAPI client available");

    // Test basic API call - list files in root
    console.log("🔄 [Google Drive Debug] Testing basic API call...");
    const response = await gapi.client.drive.files.list({
      q: "trashed=false",
      fields: "files(id, name, mimeType)",
      pageSize: 5,
    });

    console.log("✅ [Google Drive Debug] Basic API call successful:", {
      status: response.status,
      filesFound: response.result.files?.length || 0,
    });
  } catch (error) {
    console.error("❌ [Google Drive Debug] Basic API test failed:", error);
  }
}

/**
 * Debug function to test the complete upload flow
 */
export async function debugUploadFlow(): Promise<void> {
  console.log("🧪 [Google Drive Debug] Starting upload flow test...");

  try {
    // Check authentication
    const token = window.gapi?.client?.getToken?.() || window._gapiToken;
    if (!token) {
      console.error("❌ [Google Drive Debug] Not signed in");
      return;
    }
    console.log("✅ [Google Drive Debug] Authentication OK");

    // Check folder
    const folderId = await getAppFolderId();
    if (!folderId) {
      console.log("📁 [Google Drive Debug] No folder found, creating one...");
      const newFolderId = await createAppFolder();
      if (!newFolderId) {
        console.error("❌ [Google Drive Debug] Failed to create folder");
        return;
      }
      console.log("✅ [Google Drive Debug] Folder created:", newFolderId);
    } else {
      console.log("✅ [Google Drive Debug] Folder found:", folderId);
    }

    // Get local notes
    const localNotes = await IndexedDB.getAllNotes();
    console.log("📚 [Google Drive Debug] Local notes:", {
      count: localNotes.length,
      notes: localNotes.map((n) => ({ id: n.id, name: n.name })),
    });

    if (localNotes.length === 0) {
      console.log("⚠️ [Google Drive Debug] No local notes to upload");
      return;
    }

    // Test upload
    console.log("📤 [Google Drive Debug] Testing upload...");
    await uploadNotesToDrive(localNotes.slice(0, 1)); // Upload just the first note
    console.log("✅ [Google Drive Debug] Upload test completed");
  } catch (error) {
    console.error("❌ [Google Drive Debug] Upload flow test failed:", error);
  }
}

/**
 * Debug function to list all files in the app folder
 */
export async function debugListDriveFiles(): Promise<void> {
  const token = window.gapi?.client?.getToken?.() || window._gapiToken;
  if (!token) {
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
      files: files.map((file: any) => {
        const noteId = extractNoteIdFromFilename(file.name);
        return {
          id: file.id,
          name: file.name,
          extractedNoteId: noteId,
          mimeType: file.mimeType,
          size: file.size,
          createdTime: file.createdTime,
          modifiedTime: file.modifiedTime,
        };
      }),
    });

    // Get note file mapping
    const noteFilesMap = await getAllNoteFiles(folderId);
    console.log("📋 [Google Drive Debug] Note file mapping:", {
      count: noteFilesMap.size,
      mapping: Array.from(noteFilesMap.entries()).map(([noteId, fileId]) => ({
        noteId,
        fileId,
      })),
    });
  } catch (error) {
    console.error("❌ [Google Drive Debug] Error listing files:", error);
  }
}

// Sync lock to prevent concurrent sync operations
let syncInProgress = false;
let loadInProgress = false;
let uploadInProgress = false;
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 1000; // Minimum 1 second between syncs

// Helper function to make Google Drive API calls in Chrome extension
async function makeDriveAPICall(
  method: string,
  url: string,
  params?: any,
  uploadType?: string,
  body?: string | any
): Promise<any> {
  const tokenResponse = window._gapiToken;
  if (!tokenResponse) {
    throw new Error("No authentication token available");
  }

  // Extract access token from token response object
  const accessToken =
    typeof tokenResponse === "string"
      ? tokenResponse
      : tokenResponse.access_token;

  if (!accessToken) {
    throw new Error("No valid access token available");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  let requestUrl = url;

  // Handle query parameters (including uploadType)
  const queryParams = new URLSearchParams();
  if (uploadType) {
    queryParams.append("uploadType", uploadType);
  }
  if (params && method === "GET") {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
  }
  if (queryParams.toString()) {
    requestUrl += "?" + queryParams.toString();
  }

  const requestOptions: RequestInit = {
    method,
    headers,
  };

  // Handle request body
  if (method !== "GET") {
    if (uploadType === "media" && body) {
      // For media uploads, send body as-is with appropriate content type
      requestOptions.body =
        typeof body === "string" ? body : JSON.stringify(body);
      headers["Content-Type"] = "application/json"; // JSON files
    } else if (uploadType === "multipart") {
      // Handle file upload with multipart
      const formData = new FormData();
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value as any);
        }
      });
      requestOptions.body = formData;
      // Let browser set multipart boundary
    } else if (params) {
      // For regular JSON requests
      requestOptions.body = JSON.stringify(params);
      headers["Content-Type"] = "application/json";
    } else if (body) {
      requestOptions.body =
        typeof body === "string" ? body : JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
  }

  try {
    console.log(
      `🔄 [Google Drive API] Making ${method} request to: ${requestUrl}`,
      {
        hasToken: !!accessToken,
        tokenLength: accessToken.length,
        params: params ? Object.keys(params) : "none",
      }
    );

    const response = await fetch(requestUrl, requestOptions);

    console.log(
      `📡 [Google Drive API] Response: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Google Drive API] Error response:`, errorText);
      throw new Error(
        `Google Drive API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Handle different response types
    if (response.status === 204) {
      // DELETE operations return 204 No Content
      console.log(`✅ [Google Drive API] Success: ${method} ${url} completed`);
      return { status: 204, result: null };
    } else if (
      response.headers.get("content-type")?.includes("application/json")
    ) {
      const data = await response.json();
      console.log(`✅ [Google Drive API] Success:`, data);
      return { status: response.status, result: data };
    } else {
      // Handle non-JSON responses (like media upload responses)
      const text = await response.text();
      // Try to parse as JSON in case it's JSON but content-type wasn't set correctly
      try {
        const jsonData = JSON.parse(text);
        console.log(`✅ [Google Drive API] Success (parsed JSON):`, jsonData);
        return { status: response.status, result: jsonData };
      } catch {
        console.log(
          `✅ [Google Drive API] Success (text):`,
          text.substring(0, 100)
        );
        return { status: response.status, result: text };
      }
    }
  } catch (error) {
    console.error(`❌ [Google Drive API] ${method} ${url} failed:`, error);
    throw error;
  }
}

function loadScript(src: string, onload: () => void) {
  console.log(`🔄 [Google Drive] Loading script: ${src}`);

  // For Chrome extensions, we can't load external scripts due to CSP restrictions
  // Instead, we'll use Chrome's identity API and direct REST calls
  // This is the proper way to handle Google APIs in Chrome extensions

  if (src.includes("apis.google.com/js/api.js")) {
    console.log(
      "📦 [Google Drive] Using Chrome extension approach for Google API..."
    );

    // For Chrome extensions, we need to initialize gapi client manually
    // since we can't load external scripts due to CSP restrictions
    if (!window.gapi) {
      window.gapi = {
        load: (api: string, callback: () => void) => {
          console.log(`🔄 [Google Drive] Loading API: ${api}`);
          if (api === "client") {
            // Initialize the client
            window.gapi.client = {
              init: (config: any) => {
                console.log(
                  "✅ [Google Drive] GAPI client initialized for Chrome extension"
                );
                return Promise.resolve();
              },
              getToken: () => {
                return window._gapiToken;
              },
              setToken: (token: any) => {
                console.log("🔐 [Google Drive] Setting token:", !!token);
                window._gapiToken = token;
              },
              request: (params: any) => {
                console.log("🔄 [Google Drive] Making request:", params);
                // Handle generic gapi.client.request calls
                const {
                  path,
                  method = "GET",
                  params: queryParams,
                  body,
                } = params;
                const url = `https://www.googleapis.com${path}`;
                // Extract uploadType from queryParams if present
                const uploadType = queryParams?.uploadType;
                // Remove uploadType from queryParams to avoid double inclusion
                const cleanQueryParams = queryParams ? { ...queryParams } : {};
                if (uploadType) {
                  delete cleanQueryParams.uploadType;
                }
                return makeDriveAPICall(
                  method,
                  url,
                  Object.keys(cleanQueryParams).length > 0
                    ? cleanQueryParams
                    : undefined,
                  uploadType,
                  body
                );
              },
              drive: {
                files: {
                  list: (params: any) => {
                    return makeDriveAPICall(
                      "GET",
                      "https://www.googleapis.com/drive/v3/files",
                      params
                    );
                  },
                  create: (params: any) => {
                    return makeDriveAPICall(
                      "POST",
                      "https://www.googleapis.com/drive/v3/files",
                      params.resource,
                      params.uploadType
                    );
                  },
                  get: (params: any) => {
                    return makeDriveAPICall(
                      "GET",
                      `https://www.googleapis.com/drive/v3/files/${params.fileId}`,
                      params
                    );
                  },
                  update: (params: any) => {
                    return makeDriveAPICall(
                      "PATCH",
                      `https://www.googleapis.com/drive/v3/files/${params.fileId}`,
                      params.resource
                    );
                  },
                  delete: (params: any) => {
                    return makeDriveAPICall(
                      "DELETE",
                      `https://www.googleapis.com/drive/v3/files/${params.fileId}`
                    );
                  },
                },
              },
            };
          }
          callback();
        },
        client: null,
      };
    }

    gapiLoaded = true;
    setTimeout(onload, 100);
    return;
  }

  if (src.includes("accounts.google.com/gsi/client")) {
    console.log(
      "📦 [Google Drive] Using Chrome extension approach for OAuth..."
    );

    // For Chrome extensions, we'll use Chrome's identity API instead of GSI
    // We'll implement a mock that works with our existing code
    if (!window.google) {
      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: (config: any) => {
              console.log(
                "✅ [Google Drive] Using Chrome identity API for OAuth"
              );
              return {
                requestAccessToken: (options?: any) => {
                  console.log(
                    "🔄 [Google Drive] Requesting token via Chrome identity API"
                  );

                  // Use Chrome's identity API for OAuth
                  if (typeof chrome !== "undefined" && chrome.identity) {
                    console.log(
                      "🔄 [Google Drive] Using Chrome identity API for OAuth..."
                    );
                    console.log("🔍 [Google Drive] Chrome extension context:", {
                      hasChrome: typeof chrome !== "undefined",
                      hasIdentity: !!chrome.identity,
                      hasGetAuthToken:
                        typeof chrome.identity.getAuthToken === "function",
                      extensionId: (chrome.runtime as any)?.id,
                    });
                    chrome.identity.getAuthToken(
                      { interactive: true },
                      (token) => {
                        if (chrome.runtime.lastError) {
                          console.error(
                            "❌ [Google Drive] Chrome identity error:",
                            chrome.runtime.lastError
                          );

                          // Check if it's a client ID error
                          if (
                            chrome.runtime.lastError.message?.includes(
                              "bad client id"
                            ) ||
                            chrome.runtime.lastError.message?.includes(
                              "Invalid OAuth2 Client ID"
                            )
                          ) {
                            console.error(
                              "❌ [Google Drive] OAuth Client ID not configured properly"
                            );
                            console.log(
                              "💡 [Google Drive] Please set up your OAuth client ID:"
                            );
                            console.log(
                              "1. Go to https://console.cloud.google.com/"
                            );
                            console.log(
                              "2. Create OAuth 2.0 Client ID for Chrome extension"
                            );
                            console.log(
                              "3. Use your extension ID from chrome://extensions/"
                            );
                            console.log(
                              "4. Update the client_id in public/manifest.json"
                            );
                            console.log(
                              "5. Or run: node setup-oauth.js YOUR_CLIENT_ID"
                            );
                          }

                          // Call callback with error state
                          if (config.callback) {
                            config.callback({
                              access_token: null,
                              expires_in: 0,
                              scope: config.scope,
                              token_type: "Bearer",
                              error: chrome.runtime.lastError.message,
                            });
                          }
                          return;
                        }

                        if (token && config.callback) {
                          console.log(
                            "✅ [Google Drive] Token received via Chrome identity API"
                          );
                          const tokenResponse = {
                            access_token: token,
                            expires_in: 3600,
                            scope: config.scope,
                            token_type: "Bearer",
                          };
                          console.log("🔐 [Google Drive] Token response:", {
                            hasAccessToken: !!tokenResponse.access_token,
                            accessTokenLength:
                              tokenResponse.access_token?.length,
                            tokenType: tokenResponse.token_type,
                            scope: tokenResponse.scope,
                          });
                          config.callback(tokenResponse);
                        } else if (config.callback) {
                          console.warn(
                            "⚠️ [Google Drive] No token received from Chrome identity API"
                          );
                          config.callback({
                            access_token: null,
                            expires_in: 0,
                            scope: config.scope,
                            token_type: "Bearer",
                            error: "No token received from Chrome identity API",
                          });
                        }
                      }
                    );
                  } else {
                    console.error(
                      "❌ [Google Drive] Chrome identity API not available"
                    );
                    // Fallback: show error or redirect to manual auth
                    if (config.callback) {
                      config.callback({
                        access_token: null,
                        expires_in: 0,
                        scope: config.scope,
                        token_type: "Bearer",
                        error: "Chrome identity API not available",
                      });
                    }
                  }
                },
              };
            },
          },
        },
      };
    }

    gisLoaded = true;
    setTimeout(onload, 100);
    return;
  }

  // For other scripts, just call onload immediately
  console.log(`⚠️ [Google Drive] Unknown script: ${src}, skipping...`);
  onload();
}

function ensureGoogleScriptsLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gapiLoaded && gisLoaded) {
      console.log("✅ [Google Drive] Scripts already loaded");
      resolve();
      return;
    }

    let timeoutId: NodeJS.Timeout;
    const timeout = setTimeout(() => {
      reject(new Error("Timeout loading Google scripts"));
    }, 30000); // 30 second timeout

    const checkScripts = () => {
      if (gapiLoaded && gisLoaded) {
        clearTimeout(timeout);
        console.log("✅ [Google Drive] All Google scripts loaded successfully");
        resolve();
      }
    };

    if (!gapiLoaded) {
      console.log("🔄 [Google Drive] Loading Google API script...");
      loadScript("https://apis.google.com/js/api.js", () => {
        console.log("✅ [Google Drive] Google API script loaded");
        gapiLoaded = true;

        // Check if gapi is available before trying to use it
        if (typeof window.gapi !== "undefined" && window.gapi.load) {
          window.gapi.load("client", () => {
            console.log("✅ [Google Drive] GAPI client loaded");
            checkScripts();
          });
        } else {
          console.warn("⚠️ [Google Drive] GAPI not available, using fallback");
          // Create a fallback gapi object for Chrome extensions
          if (!window.gapi) {
            window.gapi = {
              load: (module: string, callback: () => void) => {
                console.log(`🔄 [Google Drive] Fallback gapi.load(${module})`);
                setTimeout(callback, 100);
              },
              client: {
                init: (config: any) => {
                  console.log("✅ [Google Drive] Fallback gapi.client.init");
                  return Promise.resolve();
                },
                setToken: (token: any) => {
                  console.log(
                    "✅ [Google Drive] Fallback gapi.client.setToken"
                  );
                  // Store token for REST API calls
                  window._gapiToken = token;
                },
                getToken: () => {
                  return window._gapiToken || null;
                },
                request: async (options: any) => {
                  console.log("🔄 [Google Drive] Fallback gapi.client.request");
                  // Extract body and params separately for proper handling
                  const {
                    path,
                    method = "GET",
                    params: queryParams,
                    body,
                  } = options;
                  return await makeRestApiCall({
                    path,
                    method,
                    params: queryParams,
                    body: body,
                  });
                },
                drive: {
                  files: {
                    list: async (params: any) => {
                      console.log(
                        "🔄 [Google Drive] Fallback gapi.client.drive.files.list"
                      );
                      const response = await makeRestApiCall({
                        path: "/drive/v3/files",
                        method: "GET",
                        params: params,
                      });
                      return { result: response };
                    },
                    create: async (params: any) => {
                      console.log(
                        "🔄 [Google Drive] Fallback gapi.client.drive.files.create"
                      );
                      const response = await makeRestApiCall({
                        path: "/drive/v3/files",
                        method: "POST",
                        body: params.resource,
                        params: params.fields ? { fields: params.fields } : {},
                      });
                      return { result: response };
                    },
                    update: async (params: any) => {
                      console.log(
                        "🔄 [Google Drive] Fallback gapi.client.drive.files.update"
                      );
                      const response = await makeRestApiCall({
                        path: `/drive/v3/files/${params.fileId}`,
                        method: "PATCH",
                        body: params.resource,
                        params: params.fields ? { fields: params.fields } : {},
                      });
                      return { result: response };
                    },
                    delete: async (params: any) => {
                      console.log(
                        "🔄 [Google Drive] Fallback gapi.client.drive.files.delete"
                      );
                      await makeRestApiCall({
                        path: `/drive/v3/files/${params.fileId}`,
                        method: "DELETE",
                      });
                      return { result: {} };
                    },
                    get: async (params: any) => {
                      console.log(
                        "🔄 [Google Drive] Fallback gapi.client.drive.files.get"
                      );
                      const response = await makeRestApiCall({
                        path: `/drive/v3/files/${params.fileId}`,
                        method: "GET",
                        params: params.alt ? { alt: params.alt } : {},
                      });
                      return { result: response };
                    },
                  },
                },
              },
            };
          }
          checkScripts();
        }
      });
    }

    if (!gisLoaded) {
      console.log(
        "🔄 [Google Drive] Loading Google Identity Services script..."
      );
      loadScript("https://accounts.google.com/gsi/client", () => {
        console.log("✅ [Google Drive] Google Identity Services script loaded");
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
        console.log("✅ [Google Drive] Token received successfully");
        callback(tokenResponse);
      } else if (tokenResponse.error) {
        console.error("❌ [Google Drive] OAuth error:", tokenResponse.error);

        // Provide specific guidance for common errors
        if (
          tokenResponse.error.includes("bad client id") ||
          tokenResponse.error.includes("Invalid OAuth2 Client ID")
        ) {
          console.error(
            "❌ [Google Drive] OAuth Client ID not configured properly"
          );
          console.log("💡 [Google Drive] Please set up your OAuth client ID:");
          console.log("1. Go to https://console.cloud.google.com/");
          console.log("2. Create OAuth 2.0 Client ID for Chrome extension");
          console.log("3. Use your extension ID from chrome://extensions/");
          console.log("4. Update the client_id in public/manifest.json");
          console.log("5. Or run: node setup-oauth.js YOUR_CLIENT_ID");
        }

        // Still call the callback to handle the error
        callback(tokenResponse);
      } else {
        console.warn("⚠️ [Google Drive] No access token in response");
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
  let token = null;

  if (window.gapi && window.gapi.client) {
    token = window.gapi.client.getToken();
  } else {
    token = window._gapiToken;
  }

  if (token !== null) {
    if (
      window.google &&
      window.google.accounts &&
      window.google.accounts.oauth2 &&
      typeof window.google.accounts.oauth2.revoke === "function"
    ) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {});
    } else {
      console.log(
        "⚠️ [Google Drive] OAuth revoke not available, using Chrome identity API"
      );
      // For Chrome extensions, we can use chrome.identity.removeCachedAuthToken
      if (
        typeof chrome !== "undefined" &&
        chrome.identity &&
        (chrome.identity as any).removeCachedAuthToken
      ) {
        (chrome.identity as any).removeCachedAuthToken(
          { token: token.access_token },
          () => {
            console.log(
              "✅ [Google Drive] Token revoked via Chrome identity API"
            );
          }
        );
      }
    }

    if (window.gapi && window.gapi.client) {
      window.gapi.client.setToken(null);
    } else {
      window._gapiToken = null;
    }

    await SecureAuthManager.clearToken();
  }
}

/**
 * Set the token for gapi client
 */
export function setToken(token: google.accounts.oauth2.TokenResponse | null) {
  console.log("🔐 [Google Drive] setToken called with:", {
    hasToken: !!token,
    tokenType: typeof token,
    isString: typeof token === "string",
    hasAccessToken:
      token && typeof token === "object" && "access_token" in token,
    accessTokenLength:
      token && typeof token === "object" && "access_token" in token
        ? token.access_token?.length
        : 0,
  });

  // Ensure gapi client is initialized
  if (!window.gapi) {
    window.gapi = {
      load: () => {},
      client: null,
    };
  }

  if (!window.gapi.client) {
    // Initialize the client if it doesn't exist
    window.gapi.client = {
      init: () => Promise.resolve(),
      getToken: () => window._gapiToken,
      setToken: (t: any) => {
        window._gapiToken = t;
      },
      request: () => Promise.resolve({ result: {} }),
      drive: {
        files: {
          list: () => Promise.resolve({ result: { files: [] } }),
          create: () => Promise.resolve({ result: { id: "" } }),
          get: () => Promise.resolve({ result: {} }),
          update: () => Promise.resolve({ result: {} }),
          delete: () => Promise.resolve({ result: {} }),
        },
      },
    };
  }

  if (window.gapi.client.setToken) {
    window.gapi.client.setToken(token);
  } else {
    // Fallback for when gapi is not available
    window._gapiToken = token;
  }
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
 * Check if Chrome identity API has a valid cached token
 * Returns token response if available, null otherwise
 */
export async function checkChromeIdentityToken(): Promise<google.accounts.oauth2.TokenResponse | null> {
  if (typeof chrome === "undefined" || !chrome.identity) {
    console.log("🔍 [Chrome Identity] Chrome identity API not available");
    return null;
  }

  return new Promise((resolve) => {
    // Try to get token non-interactively first
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        console.log(
          "🔍 [Chrome Identity] No valid Chrome identity token found:",
          chrome.runtime.lastError.message
        );
        resolve(null);
        return;
      }

      if (!token) {
        console.log(
          "🔍 [Chrome Identity] No token returned from Chrome identity API"
        );
        resolve(null);
        return;
      }

      console.log("✅ [Chrome Identity] Valid Chrome identity token found");
      const tokenResponse: google.accounts.oauth2.TokenResponse = {
        access_token: token,
        expires_in: 3600, // Chrome tokens typically last 1 hour
        scope: SCOPES,
        token_type: "Bearer",
      };
      resolve(tokenResponse);
    });
  });
}

/**
 * Check if user is signed in with valid token
 * First checks stored token, then falls back to Chrome identity API
 */
export async function isUserSignedIn(): Promise<boolean> {
  // First check stored token
  const isSignedInStored = await SecureAuthManager.isSignedIn();

  if (isSignedInStored) {
    return true;
  }

  // Stored token expired or missing, check Chrome identity API
  console.log(
    "🔍 [Auth Check] Stored token expired/missing, checking Chrome identity API..."
  );
  const chromeToken = await checkChromeIdentityToken();

  if (chromeToken) {
    // Chrome has a valid token - refresh our stored token
    console.log(
      "✅ [Auth Check] Chrome has valid token, refreshing stored token..."
    );
    await saveTokenToStorage(chromeToken);
    setToken(chromeToken);
    return true;
  }

  // No token available
  return false;
}

/**
 * Load the GAPI client.
 * For Chrome extensions, we'll use direct REST calls instead of gapi.
 */
export async function loadGapi(): Promise<void> {
  await ensureGoogleScriptsLoaded();

  // For Chrome extensions, we don't need to initialize gapi.client
  // We'll use direct REST calls to Google Drive API
  console.log("✅ [Google Drive] Using direct REST calls for Chrome extension");

  // Ensure gapi client is properly initialized for Chrome extension
  if (!window.gapi) {
    window.gapi = {
      load: (api: string, callback: () => void) => {
        console.log(`🔄 [Google Drive] Loading API: ${api}`);
        if (api === "client") {
          // Initialize the client
          window.gapi.client = {
            init: (config: any) => {
              console.log(
                "✅ [Google Drive] GAPI client initialized for Chrome extension"
              );
              return Promise.resolve();
            },
            getToken: () => {
              return window._gapiToken;
            },
            setToken: (token: any) => {
              console.log("🔐 [Google Drive] Setting token:", !!token);
              window._gapiToken = token;
            },
            request: (params: any) => {
              console.log("🔄 [Google Drive] Making request:", params);
              // Handle generic gapi.client.request calls
              const {
                path,
                method = "GET",
                params: queryParams,
                body,
              } = params;
              const url = `https://www.googleapis.com${path}`;
              return makeDriveAPICall(method, url, queryParams || body);
            },
            drive: {
              files: {
                list: (params: any) => {
                  return makeDriveAPICall(
                    "GET",
                    "https://www.googleapis.com/drive/v3/files",
                    params
                  );
                },
                create: (params: any) => {
                  return makeDriveAPICall(
                    "POST",
                    "https://www.googleapis.com/drive/v3/files",
                    params.resource,
                    params.uploadType
                  );
                },
                get: (params: any) => {
                  return makeDriveAPICall(
                    "GET",
                    `https://www.googleapis.com/drive/v3/files/${params.fileId}`,
                    params
                  );
                },
                update: (params: any) => {
                  return makeDriveAPICall(
                    "PATCH",
                    `https://www.googleapis.com/drive/v3/files/${params.fileId}`,
                    params.resource
                  );
                },
                delete: (params: any) => {
                  return makeDriveAPICall(
                    "DELETE",
                    `https://www.googleapis.com/drive/v3/files/${params.fileId}`
                  );
                },
              },
            },
          };
        }
        callback();
      },
      client: null,
    };
  }

  // Initialize the client
  if (window.gapi.load) {
    await new Promise<void>((resolve) => {
      window.gapi.load("client", resolve);
    });
  }

  console.log("✅ [Google Drive] GAPI client loaded and ready");
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
    // Set the new folder ID and initialize empty note files cache
    cachedAppFolderId = folderId;
    cachedNoteFiles = new Map<string, string>(); // Initialize empty map for new folder
    cacheTimestamp = Date.now();
    console.log("✅ [Google Drive] New folder created and cache initialized:", {
      folderId,
      noteFilesCount: 0,
    });
    return folderId;
  } catch (err) {
    console.error("Error creating app folder:", err);
    return null;
  }
}

/**
 * Get all note files in the app folder
 * Returns a map of noteId -> fileId
 */
async function getAllNoteFiles(folderId: string): Promise<Map<string, string>> {
  // Check cache first
  const now = Date.now();
  if (cachedNoteFiles && now - cacheTimestamp < CACHE_DURATION) {
    console.log(
      "💾 [Google Drive] Using cached note files:",
      cachedNoteFiles.size,
      "files"
    );
    return cachedNoteFiles;
  }

  // If we have a cached folder ID but it's different from the requested folderId,
  // this means we're working with a new folder, so clear cache and fetch fresh
  if (cachedAppFolderId && cachedAppFolderId !== folderId) {
    console.log(
      "🔄 [Google Drive] Folder ID changed, clearing cache and fetching fresh data"
    );
    clearCache();
  }

  console.log(
    "🔍 [Google Drive] Searching for all note files in folder:",
    folderId
  );

  try {
    const noteFilesMap = new Map<string, string>();

    // Search for all JSON files in the folder
    const response = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
      fields: "files(id, name)",
      pageSize: 1000, // Get all files
    });

    console.log("📡 [Google Drive] Note files search response:", {
      status: response.status,
      filesFound: response.result.files?.length || 0,
    });

    const files = response.result.files || [];

    for (const file of files) {
      const noteId = extractNoteIdFromFilename(file.name!);
      if (noteId) {
        noteFilesMap.set(noteId, file.id!);
      } else {
        console.log(
          "⚠️ [Google Drive] Could not extract note ID from filename:",
          file.name
        );
      }
    }

    cachedNoteFiles = noteFilesMap;
    cacheTimestamp = now;

    console.log("✅ [Google Drive] Note files found and cached:", {
      totalFiles: files.length,
      mappedNotes: noteFilesMap.size,
    });

    return noteFilesMap;
  } catch (err) {
    console.error("❌ [Google Drive] Error searching for note files:", err);
    return new Map<string, string>();
  }
}

/**
 * Delete a note file from Google Drive
 */
async function deleteNoteFile(fileId: string, noteId: string): Promise<void> {
  console.log("🗑️ [Google Drive] Deleting note file:", {
    noteId,
    fileId,
  });

  try {
    const response = await gapi.client.drive.files.delete({
      fileId: fileId,
    });

    console.log("📡 [Google Drive] Delete response:", {
      status: response.status,
      noteId,
      fileId,
      success: response.status >= 200 && response.status < 300,
    });

    console.log("✅ [Google Drive] Note file deleted successfully:", noteId);

    // Remove from cache if cached
    if (cachedNoteFiles) {
      cachedNoteFiles.delete(noteId);
    }
  } catch (err) {
    console.error("❌ [Google Drive] Error deleting note file:", err);
    throw err;
  }
}

/**
 * Delete a single note from Google Drive by note ID
 * This is a public function to be used when deleting a note without syncing
 */
export async function deleteNoteFromDrive(noteId: string): Promise<void> {
  console.log("🗑️ [Google Drive] Starting delete operation for note:", noteId);

  const token = window.gapi?.client?.getToken?.() || window._gapiToken;
  if (!token) {
    console.error("❌ [Google Drive] Not signed in - cannot delete");
    throw new Error("Not signed in");
  }

  try {
    const folderId = await getAppFolderId();
    if (!folderId) {
      console.log("📁 [Google Drive] No app folder found - nothing to delete");
      return;
    }

    const existingFiles = await getAllNoteFiles(folderId);
    const fileId = existingFiles.get(noteId);

    if (fileId) {
      await deleteNoteFile(fileId, noteId);
      console.log(
        "✅ [Google Drive] Note deleted successfully from Drive:",
        noteId
      );
    } else {
      console.log("⚠️ [Google Drive] No file found for note:", noteId);
    }
  } catch (err) {
    console.error("❌ [Google Drive] Error deleting note from drive:", err);
    throw err;
  }
}

export async function saveNotesToDrive(
  notes: Note[],
  deletedNoteIds: string[] = []
): Promise<void> {
  console.log("🔄 [Google Drive] Starting save operation...", {
    notesCount: notes.length,
    deletedCount: deletedNoteIds.length,
    timestamp: new Date().toISOString(),
  });

  const token = window.gapi?.client?.getToken?.() || window._gapiToken;
  if (!token) {
    console.error("❌ [Google Drive] Not signed in - cannot save");
    throw new Error("Not signed in");
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

  try {
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
      console.log(
        "✅ [Google Drive] App folder created successfully:",
        folderId
      );
    }

    // Get existing note files
    const existingFiles = await getAllNoteFiles(folderId);
    console.log("📋 [Google Drive] Existing files in Drive:", {
      count: existingFiles.size,
      noteIds: Array.from(existingFiles.keys()),
    });

    // Save/update each note
    for (const note of notes) {
      await saveIndividualNote(note, folderId, existingFiles.get(note.id));
    }

    // Delete removed notes
    for (const deletedNoteId of deletedNoteIds) {
      const fileId = existingFiles.get(deletedNoteId);
      if (fileId) {
        await deleteNoteFile(fileId, deletedNoteId);
      } else {
        console.log(
          "⚠️ [Google Drive] No file found for deleted note:",
          deletedNoteId
        );
      }
    }

    console.log("✅ [Google Drive] Save operation completed!", {
      savedNotes: notes.length,
      deletedNotes: deletedNoteIds.length,
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
 * Upload-only sync function - uploads notes to Drive without fetching/merging
 * Used for auto-sync to prevent content loss during typing
 */
export async function uploadNotesToDrive(
  notes: Note[],
  onProgress?: (
    noteId: string,
    noteName: string,
    status: "syncing" | "complete" | "error"
  ) => void
): Promise<void> {
  console.log("📤 [Google Drive] Starting upload-only operation...", {
    notesCount: notes.length,
    timestamp: new Date().toISOString(),
    notes: notes.map((n) => ({
      id: n.id,
      name: n.name,
      contentLength: n.content.length,
    })),
  });

  const token = window.gapi?.client?.getToken?.() || window._gapiToken;
  if (!token) {
    console.error("❌ [Google Drive] Not signed in - cannot upload");
    throw new Error("Not signed in");
  }

  // Prevent concurrent upload operations
  if (uploadInProgress) {
    console.log("⏸️ [Google Drive] Upload already in progress, skipping...");
    return;
  }

  // Prevent rapid successive syncs
  const now = Date.now();
  if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
    console.log("⏱️ [Google Drive] Upload too soon, skipping...", {
      timeSinceLastSync: now - lastSyncTime,
      minInterval: MIN_SYNC_INTERVAL,
    });
    return;
  }

  uploadInProgress = true;
  lastSyncTime = now;
  console.log("🔒 [Google Drive] Upload lock acquired");

  try {
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
      console.log(
        "✅ [Google Drive] App folder created successfully:",
        folderId
      );
    }

    // Get existing note files for reference (but don't fetch content)
    const existingFiles = await getAllNoteFiles(folderId);
    console.log("📋 [Google Drive] Existing files in Drive:", {
      count: existingFiles.size,
      noteIds: Array.from(existingFiles.keys()),
    });

    // Upload each note (create or update)
    console.log("📤 [Google Drive] Starting to upload notes:", {
      totalNotes: notes.length,
      noteIds: notes.map((n) => n.id),
      noteNames: notes.map((n) => n.name),
    });

    for (const note of notes) {
      try {
        console.log("🔄 [Google Drive] Processing note:", {
          noteId: note.id,
          noteName: note.name,
          isExisting: existingFiles.has(note.id),
          existingFileId: existingFiles.get(note.id),
        });

        onProgress?.(note.id, note.name, "syncing");
        await saveIndividualNote(note, folderId, existingFiles.get(note.id));
        onProgress?.(note.id, note.name, "complete");

        console.log("✅ [Google Drive] Note processed successfully:", {
          noteId: note.id,
          noteName: note.name,
        });
      } catch (error) {
        console.error(
          `❌ [Google Drive] Error uploading note ${note.id}:`,
          error
        );
        onProgress?.(note.id, note.name, "error");
        throw error; // Re-throw to maintain existing error handling
      }
    }

    console.log("✅ [Google Drive] Upload-only operation completed!", {
      uploadedNotes: notes.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ [Google Drive] Error uploading notes to drive:", err);
    const error = err as { result?: { error?: { message: string } } };
    const errorMessage =
      error.result?.error?.message ||
      "An unknown error occurred while uploading to Drive.";
    console.error("❌ [Google Drive] Error details:", {
      errorMessage,
      errorType: typeof err,
      errorStack: err instanceof Error ? err.stack : undefined,
    });
    throw new Error(errorMessage);
  } finally {
    // Always release the upload lock
    uploadInProgress = false;
    console.log("🔓 [Google Drive] Upload lock released");
  }
}

/**
 * Upload a single note to Google Drive (optimized for rename operations)
 * This function only syncs the specified note, not all notes
 */
export async function uploadSingleNoteToDrive(note: Note): Promise<void> {
  console.log("📤 [Google Drive] Starting single note upload...", {
    noteId: note.id,
    noteName: note.name,
    timestamp: new Date().toISOString(),
  });

  const token = window.gapi?.client?.getToken?.() || window._gapiToken;
  if (!token) {
    console.error("❌ [Google Drive] Not signed in - cannot upload");
    throw new Error("Not signed in");
  }

  try {
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
      console.log(
        "✅ [Google Drive] App folder created successfully:",
        folderId
      );
    }

    // Get existing note files to find the file ID for this note
    const existingFiles = await getAllNoteFiles(folderId);
    const existingFileId = existingFiles.get(note.id);

    console.log("🔄 [Google Drive] Processing single note:", {
      noteId: note.id,
      noteName: note.name,
      isExisting: !!existingFileId,
      existingFileId: existingFileId,
    });

    // Save only this note
    await saveIndividualNote(note, folderId, existingFileId);

    console.log("✅ [Google Drive] Single note upload completed!", {
      noteId: note.id,
      noteName: note.name,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      "❌ [Google Drive] Error uploading single note to drive:",
      err
    );
    const error = err as { result?: { error?: { message: string } } };
    const errorMessage =
      error.result?.error?.message ||
      "An unknown error occurred while uploading to Drive.";
    console.error("❌ [Google Drive] Error details:", {
      errorMessage,
      errorType: typeof err,
      errorStack: err instanceof Error ? err.stack : undefined,
    });
    throw new Error(errorMessage);
  }
}

/**
 * Save or update an individual note file
 */
async function saveIndividualNote(
  note: Note,
  folderId: string,
  existingFileId?: string
): Promise<void> {
  const fileName = generateNoteFileName(note);
  const isNewFile = !existingFileId;

  console.log("💾 [Google Drive] Saving individual note:", {
    noteId: note.id,
    noteName: note.name,
    fileName: fileName,
    isNewFile: isNewFile,
    existingFileId: existingFileId,
    folderId: folderId,
  });

  // Verify we have a valid folder ID
  if (!folderId) {
    console.error("❌ [Google Drive] No folder ID provided for saving note");
    throw new Error("No folder ID provided for saving note");
  }

  // Filter out image blocks from content before uploading to Drive
  const filteredContent = filterOutImageBlocks(note.content);

  // Create a filtered note for Drive upload (keeping original note intact locally)
  const filteredNote = {
    ...note,
    content: filteredContent,
  };

  // Prepare note data with metadata
  const noteData = {
    note: filteredNote,
    syncMetadata: {
      lastSync: Date.now(),
      version: "1.0",
      appVersion: "tabula-notes-v1",
    },
  };

  const content = JSON.stringify(noteData, null, 2);

  // Verify gapi client is available
  if (!window.gapi || !window.gapi.client) {
    console.error(
      "❌ [Google Drive] GAPI client not available for saving note"
    );
    throw new Error("GAPI client not available");
  }

  console.log("🔍 [Google Drive] GAPI client status:", {
    hasGapi: !!window.gapi,
    hasClient: !!window.gapi.client,
    hasDrive: !!window.gapi.client.drive,
    hasFiles: !!window.gapi.client.drive?.files,
  });

  try {
    let targetFileId: string;

    if (isNewFile) {
      // Create new file
      console.log("🚀 [Google Drive] Creating new file:", {
        fileName,
        noteId: note.id,
        noteName: note.name,
        folderId,
      });

      const metadata = {
        name: fileName,
        mimeType: "application/json",
        parents: [folderId],
        description: `Tabula Note: ${note.name}`,
      };

      console.log("📋 [Google Drive] File metadata:", metadata);

      const createResponse = await gapi.client.drive.files.create({
        resource: metadata,
        fields: "id, name, parents",
      });

      console.log("📡 [Google Drive] File creation response:", {
        status: createResponse.status,
        fileId: createResponse.result.id,
        fileName: createResponse.result.name,
        parents: createResponse.result.parents,
        success: createResponse.status >= 200 && createResponse.status < 300,
      });

      if (!createResponse.result.id) {
        console.error(
          "❌ [Google Drive] File creation failed - no file ID returned"
        );
        throw new Error("Failed to create file - no file ID returned");
      }

      targetFileId = createResponse.result.id;
      console.log("✅ [Google Drive] File created successfully:", {
        fileId: targetFileId,
        fileName,
        noteId: note.id,
      });
    } else {
      // Update existing file (also update filename in case note name changed)
      console.log("🚀 [Google Drive] Updating existing file:", fileName);

      const updateResponse = await gapi.client.drive.files.update({
        fileId: existingFileId,
        resource: {
          name: fileName,
          description: `Tabula Note: ${note.name}`,
        },
        fields: "id, name",
      });

      console.log("📡 [Google Drive] File metadata update response:", {
        status: updateResponse.status,
        fileId: updateResponse.result.id,
        fileName: updateResponse.result.name,
      });

      targetFileId = existingFileId;
    }

    // Upload the content using media upload
    console.log("📤 [Google Drive] Uploading content to file:", {
      fileId: targetFileId,
      noteId: note.id,
      contentLength: content.length,
      contentPreview: content.substring(0, 100) + "...",
    });

    const response = await gapi.client.request({
      path: `/upload/drive/v3/files/${targetFileId}`,
      method: "PATCH",
      params: { uploadType: "media" },
      body: content,
    });

    // Response is wrapped as { result: ... } from makeDriveAPICall
    const responseData = response.result || response;
    const responseStatus = response.status || 200; // Default to 200 if status not available

    console.log("📡 [Google Drive] Content upload response:", {
      status: responseStatus,
      noteId: note.id,
      success: responseStatus >= 200 && responseStatus < 300,
      hasResult: !!response.result,
      responseData:
        typeof responseData === "string"
          ? responseData.substring(0, 200) + "..."
          : JSON.stringify(responseData).substring(0, 200) + "...",
    });

    if (responseStatus < 200 || responseStatus >= 300) {
      console.error("❌ [Google Drive] Content upload failed:", {
        status: responseStatus,
        result: responseData,
        noteId: note.id,
        fileId: targetFileId,
      });
      throw new Error(
        `Failed to upload file content: ${JSON.stringify(responseData)}`
      );
    }

    // Update cache
    if (cachedNoteFiles) {
      cachedNoteFiles.set(note.id, targetFileId);
    }

    console.log("✅ [Google Drive] Note saved successfully:", {
      noteId: note.id,
      fileName: fileName,
      fileId: targetFileId,
    });
  } catch (err) {
    console.error("❌ [Google Drive] Error saving individual note:", err);
    throw err;
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

export async function loadNotesFromDrive(
  onProgress?: (
    noteId: string,
    noteName: string,
    status: "syncing" | "complete" | "error"
  ) => void
): Promise<Note[] | null> {
  console.log("📥 [Google Drive] Starting load operation...", {
    timestamp: new Date().toISOString(),
  });

  const token = window.gapi?.client?.getToken?.() || window._gapiToken;
  if (!token) {
    console.error("❌ [Google Drive] Not signed in - cannot load");
    throw new Error("Not signed in");
  }

  // Prevent concurrent load operations
  if (loadInProgress) {
    console.log("⏸️ [Google Drive] Load already in progress, skipping...");
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

  loadInProgress = true;
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

    const noteFilesMap = await getAllNoteFiles(folderId);
    console.log("📄 [Google Drive] Note files found:", {
      count: noteFilesMap.size,
      noteIds: Array.from(noteFilesMap.keys()),
    });

    if (noteFilesMap.size === 0) {
      console.log("📄 [Google Drive] No note files found - no notes to load");
      return []; // Return empty array instead of null
    }

    console.log("📡 [Google Drive] Fetching file contents from Drive...");

    // Load all note files in parallel
    const loadPromises = Array.from(noteFilesMap.entries()).map(
      async ([noteId, fileId]) => {
        try {
          // Report syncing status
          onProgress?.(noteId, `Note ${noteId}`, "syncing");

          const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: "media",
          });

          if (response.status !== 200) {
            console.error(
              "❌ [Google Drive] Failed to load file for note:",
              noteId
            );
            onProgress?.(noteId, `Note ${noteId}`, "error");
            return null;
          }

          const data = JSON.parse(response.body as any);

          // Handle both new format (with metadata) and direct note format
          let note: Note | null = null;
          if (data.note) {
            // New format with metadata
            console.log("📋 [Google Drive] Loaded note with metadata:", noteId);
            note = data.note as Note;
          } else if (data.id) {
            // Direct note format (fallback)
            console.log(
              "📋 [Google Drive] Loaded note (direct format):",
              noteId
            );
            note = data as Note;
          } else {
            console.warn(
              "⚠️ [Google Drive] Unexpected note format for:",
              noteId
            );
            onProgress?.(noteId, `Note ${noteId}`, "error");
            return null;
          }

          // Report complete status with actual note name
          if (note) {
            onProgress?.(noteId, note.name, "complete");
          }
          return note;
        } catch (err) {
          console.error(
            "❌ [Google Drive] Error loading individual note:",
            noteId,
            err
          );
          onProgress?.(noteId, `Note ${noteId}`, "error");
          return null;
        }
      }
    );

    const loadedNotes = await Promise.all(loadPromises);

    // Filter out null values (failed loads)
    const notes = loadedNotes.filter((note): note is Note => note !== null);

    console.log("✅ [Google Drive] Load successful!", {
      totalFiles: noteFilesMap.size,
      successfulLoads: notes.length,
      failedLoads: noteFilesMap.size - notes.length,
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
    // Always release the load lock
    loadInProgress = false;
    console.log("🔓 [Google Drive] Load lock released");
  }
}

/**
 * Simple sync function that creates folder if needed and uploads all local notes
 * This is a simplified version focused on the core functionality
 */
export async function simpleSync(
  onProgress?: (
    noteId: string,
    noteName: string,
    status: "syncing" | "complete" | "error"
  ) => void
): Promise<{
  notes: Note[];
}> {
  console.log("🔄 [Google Drive] Starting simple sync...");

  const token = window.gapi?.client?.getToken?.() || window._gapiToken;
  console.log("🔐 [Google Drive] Authentication check:", {
    hasGapi: !!window.gapi,
    hasClient: !!window.gapi?.client,
    hasGetToken: !!window.gapi?.client?.getToken,
    hasToken: !!token,
    tokenType: typeof token,
    tokenLength: token ? token.length : 0,
  });
  if (!token) {
    console.error("❌ [Google Drive] Not signed in - cannot sync");
    throw new Error("Not signed in");
  }

  // Prevent concurrent sync operations
  if (syncInProgress) {
    console.log("⏸️ [Google Drive] Sync already in progress, skipping...");
    throw new Error("Sync already in progress");
  }

  syncInProgress = true;
  console.log("🔒 [Google Drive] Simple sync lock acquired");

  try {
    // Step 1: Get or create folder
    console.log("📁 [Google Drive] Step 1: Getting or creating folder...");
    let folderId = await getAppFolderId();
    if (!folderId) {
      console.log("📁 [Google Drive] Creating new folder...");
      folderId = await createAppFolder();
      if (!folderId) {
        throw new Error("Failed to create app folder");
      }
      console.log("✅ [Google Drive] Folder created:", folderId);
    } else {
      console.log("✅ [Google Drive] Using existing folder:", folderId);
    }

    // Step 2: Get local notes
    console.log("📚 [Google Drive] Step 2: Getting local notes...");
    const localNotes = await IndexedDB.getAllNotes();
    console.log("📚 [Google Drive] Local notes found:", {
      count: localNotes.length,
      notes: localNotes.map((n) => ({ id: n.id, name: n.name })),
    });

    if (localNotes.length === 0) {
      console.log("⚠️ [Google Drive] No local notes to sync");
      return { notes: [] };
    }

    // Step 3: Upload all local notes
    console.log("📤 [Google Drive] Step 3: Uploading notes...");
    await uploadNotesToDrive(localNotes, onProgress);
    console.log("✅ [Google Drive] Upload completed");

    console.log("✅ [Google Drive] Simple sync completed!", {
      notesCount: localNotes.length,
      timestamp: new Date().toISOString(),
    });

    return { notes: localNotes };
  } catch (error) {
    console.error("❌ [Google Drive] Simple sync failed:", error);
    throw error;
  } finally {
    syncInProgress = false;
    console.log("🔓 [Google Drive] Simple sync lock released");
  }
}

/**
 * Full sync function that handles notes (images are stored locally only)
 * This is the main sync function that should be used by the app
 */
export async function fullSyncWithImages(
  onProgress?: (
    noteId: string,
    noteName: string,
    status: "syncing" | "complete" | "error"
  ) => void
): Promise<{
  notes: Note[];
}> {
  console.log("🔄 [Google Drive] Starting full sync with images...");

  const token = window.gapi?.client?.getToken?.() || window._gapiToken;
  console.log("🔐 [Google Drive] Authentication check:", {
    hasGapi: !!window.gapi,
    hasClient: !!window.gapi?.client,
    hasGetToken: !!window.gapi?.client?.getToken,
    hasToken: !!token,
    tokenType: typeof token,
    tokenLength: token ? token.length : 0,
  });
  if (!token) {
    console.error("❌ [Google Drive] Not signed in - cannot sync");
    throw new Error("Not signed in");
  }

  // Prevent concurrent sync operations
  if (syncInProgress) {
    console.log("⏸️ [Google Drive] Sync already in progress, skipping...");
    throw new Error("Sync already in progress");
  }

  syncInProgress = true;
  console.log("🔒 [Google Drive] Full sync lock acquired");

  try {
    // Step 1: Ensure app folder exists
    console.log("📁 [Google Drive] Step 1: Ensuring app folder exists...");
    let folderId = await getAppFolderId();
    console.log("📁 [Google Drive] Initial folder ID:", folderId);
    if (!folderId) {
      console.log("📁 [Google Drive] Creating new app folder...");
      folderId = await createAppFolder();
      console.log("📁 [Google Drive] Created folder ID:", folderId);
      if (!folderId) {
        throw new Error("Failed to create app folder");
      }
    } else {
      console.log("📁 [Google Drive] Using existing folder ID:", folderId);
    }

    // Step 2: Load notes from Google Drive
    console.log("📥 [Google Drive] Step 2: Loading notes from Drive...");
    const driveNotes = await loadNotesFromDrive(onProgress);

    if (!driveNotes) {
      console.log(
        "📥 [Google Drive] No notes found on Drive, will upload local notes"
      );
    }

    // Step 3: Get local notes
    console.log("📚 [Google Drive] Step 3: Getting local notes...");
    const localNotes = await IndexedDB.getAllNotes();

    // Step 4: Merge notes (simple strategy: Drive wins for conflicts)
    console.log("🔄 [Google Drive] Step 4: Merging notes...");
    const mergedNotes = new Map<string, Note>();

    // Add local notes first
    for (const note of localNotes) {
      mergedNotes.set(note.id, note);
      onProgress?.(note.id, note.name, "syncing");
    }

    // Override with Drive notes (Drive wins for conflicts)
    if (driveNotes) {
      for (const note of driveNotes) {
        mergedNotes.set(note.id, note);
        onProgress?.(note.id, note.name, "syncing");
      }
    }

    const finalNotes = Array.from(mergedNotes.values());

    // Step 5: Save merged notes to local storage
    console.log("💾 [Google Drive] Step 5: Saving merged notes locally...");
    for (const note of finalNotes) {
      await IndexedDB.saveNote(note);
    }

    // Step 6: Upload local notes to Drive
    console.log("📤 [Google Drive] Step 6: Uploading local notes to Drive...", {
      notesCount: finalNotes.length,
      noteIds: finalNotes.map((n) => n.id),
      noteNames: finalNotes.map((n) => n.name),
      folderId: folderId,
    });

    // Verify we have notes to upload
    if (finalNotes.length === 0) {
      console.log(
        "⚠️ [Google Drive] No notes to upload - skipping upload step"
      );
    } else {
      console.log("🔄 [Google Drive] Calling uploadNotesToDrive with notes:", {
        count: finalNotes.length,
        firstNote: finalNotes[0]
          ? {
              id: finalNotes[0].id,
              name: finalNotes[0].name,
              contentLength: finalNotes[0].content.length,
            }
          : null,
      });

      try {
        await uploadNotesToDrive(finalNotes, onProgress);
        console.log("✅ [Google Drive] Step 6: Upload completed successfully");
      } catch (uploadError) {
        console.error(
          "❌ [Google Drive] Step 6: Upload failed with error:",
          uploadError
        );
        throw uploadError; // Re-throw to maintain error handling
      }
    }

    console.log("✅ [Google Drive] Full sync completed!", {
      notesCount: finalNotes.length,
      timestamp: new Date().toISOString(),
    });

    return {
      notes: finalNotes,
    };
  } catch (error) {
    console.error("❌ [Google Drive] Full sync failed:", error);
    throw error;
  } finally {
    // Always release the sync lock
    syncInProgress = false;
    console.log("🔓 [Google Drive] Full sync lock released");
  }
}
