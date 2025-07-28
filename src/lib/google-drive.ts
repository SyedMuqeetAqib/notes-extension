
'use client';

// A lot of this code is from the Google Drive API documentation
// https://developers.google.com/drive/api/guides/file

export type Note = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  lastUpdatedAt: number;
};

let tokenClient: google.accounts.oauth2.TokenClient | null = null;

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const APP_FOLDER = 'TabulaNote App';
const NOTES_FILE_NAME = 'tabula-notes.json';
const TOKEN_STORAGE_KEY = 'tabula-google-token';

let gapiLoaded = false;
let gisLoaded = false;

function loadScript(src: string, onload: () => void) {
    const script = document.createElement('script');
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
            loadScript('https://apis.google.com/js/api.js', () => {
                gapiLoaded = true;
                gapi.load('client', checkScripts);
            });
        }

        if (!gisLoaded) {
            loadScript('https://accounts.google.com/gsi/client', () => {
                gisLoaded = true;
                checkScripts();
            });
        }
    });
}


/**
 * Callback after the GIS client is loaded.
 */
export async function initGis(clientId: string, callback: (tokenResponse: google.accounts.oauth2.TokenResponse) => void) {
    await ensureGoogleScriptsLoaded();
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
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
    tokenClient.requestAccessToken({ prompt: 'consent' });
}


/**
 *  Sign out the user upon button click.
 */
export function signOut() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {});
    gapi.client.setToken(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

/**
 * Set the token for gapi client
 */
export function setToken(token: google.accounts.oauth2.TokenResponse | null) {
    gapi.client.setToken(token);
}

/**
 * Save token to localStorage
 */
export function saveTokenToStorage(token: google.accounts.oauth2.TokenResponse) {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
}

/**
 * Get token from localStorage
 */
export function getTokenFromStorage(): google.accounts.oauth2.TokenResponse | null {
    const tokenStr = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (tokenStr) {
        try {
            const token = JSON.parse(tokenStr);
            // Optional: Check for expiry here if needed, though GAPI handles it.
            return token;
        } catch (e) {
            console.error("Failed to parse token from storage", e);
            return null;
        }
    }
    return null;
}

/**
 * Load the GAPI client.
 */
export async function loadGapi(): Promise<void> {
    await ensureGoogleScriptsLoaded();
    await new Promise<void>((resolve, reject) => {
        gapi.load('client', () => {
            gapi.client.init({
                apiKey: GOOGLE_API_KEY,
                discoveryDocs: [DISCOVERY_DOC],
            })
            .then(() => resolve())
            .catch((e) => reject(e));
        });
    });
}


async function getAppFolderId(): Promise<string | null> {
    try {
        const response = await gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER}' and trashed=false`,
            fields: 'files(id)',
        });
        const files = response.result.files;
        if (files && files.length > 0) {
            return files[0].id!;
        } else {
            return null;
        }
    } catch (err) {
        console.error('Error searching for app folder:', err);
        return null;
    }
}

async function createAppFolder(): Promise<string | null> {
    try {
        const response = await gapi.client.drive.files.create({
            resource: {
                name: APP_FOLDER,
                mimeType: 'application/vnd.google-apps.folder',
            },
            fields: 'id',
        });
        return response.result.id!;
    } catch (err) {
        console.error('Error creating app folder:', err);
        return null;
    }
}


async function getNotesFileId(folderId: string): Promise<string | null> {
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and name='${NOTES_FILE_NAME}' and trashed=false`,
            fields: 'files(id)',
        });
        const files = response.result.files;
        return (files && files.length > 0) ? files[0].id! : null;
    } catch (err) {
        console.error('Error searching for notes file:', err);
        return null;
    }
}


export async function saveNotesToDrive(notes: Note[]): Promise<void> {
    if (!gapi.client.getToken()) {
        throw new Error("Not signed in");
    }

    let folderId = await getAppFolderId();
    if (!folderId) {
        folderId = await createAppFolder();
        if (!folderId) {
            throw new Error("Could not create app folder in Google Drive.");
        }
    }

    let fileId = await getNotesFileId(folderId);
    
    const content = JSON.stringify(notes, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    
    const metadata = {
        name: NOTES_FILE_NAME,
        mimeType: 'application/json',
        parents: fileId ? undefined : [folderId] // Only add parent on creation
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const path = `/upload/drive/v3/files${fileId ? `/${fileId}` : ''}`;
    const method = fileId ? 'PATCH' : 'POST';

    try {
        const response = await gapi.client.request({
            path: path,
            method: method,
            params: { uploadType: 'multipart' },
            body: form
        });

        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Failed to save file: ${response.body}`);
        }
    } catch (err) {
        console.error('Error saving notes to drive', err);
        const error = err as { result?: { error?: { message: string } } };
        throw new Error(error.result?.error?.message || 'An unknown error occurred while saving to Drive.');
    }
}

export async function loadNotesFromDrive(): Promise<Note[] | null> {
    if (!gapi.client.getToken()) {
        throw new Error("Not signed in");
    }

    const folderId = await getAppFolderId();
    if (!folderId) {
        return null; // No app folder, so no notes to load
    }

    const fileId = await getNotesFileId(folderId);
    if (!fileId) {
        return null; // No notes file, so no notes to load
    }

    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        if (response.status !== 200) {
            throw new Error(`Failed to load file: ${response.body}`);
        }

        // The body is a string, so we need to parse it as JSON.
        // GAPI types are a bit tricky here, so we cast to 'any' first.
        const notes = JSON.parse(response.body as any) as Note[];
        return notes;

    } catch (err) {
        console.error('Error loading notes from drive', err);
        const error = err as { result?: { error?: { message: string } } };
        throw new Error(error.result?.error?.message || 'An unknown error occurred while loading from Drive.');
    }
}
