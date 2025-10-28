"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Pencil,
  Info,
  Copy,
  Download as DownloadIcon,
  Loader2,
  Cloud,
  User,
  Upload,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import * as GoogleDrive from "@/lib/google-drive";
import type { Note } from "@/lib/google-drive";
import { StorageTest } from "@/lib/storage-test";
import { IndexedDB, type Note as IndexedDBNote } from "@/lib/indexeddb";
import { ImageStorage } from "@/lib/image-storage";
import {
  ErrorHandler,
  handleErrorWithToast,
  QuotaManager,
} from "@/lib/error-handling";
import BlockNoteEditor, {
  type BlockNoteEditorRef,
} from "./BlockNoteEditor/blocknote";

// Sync progress types
type SyncStatus = "syncing" | "complete" | "error";

interface SyncProgressItem {
  noteId: string;
  noteName: string;
  status: SyncStatus;
}

const LazyImageDialog = dynamic(() => import("@/components/image-dialog"));
const LazyStatusIndicator = dynamic(() =>
  import("@/components/status-indicator").then((mod) => mod.StatusIndicator)
);
const LazyToolbar = dynamic(
  () => import("@/components/toolbar").then((mod) => mod.Toolbar),
  {
    ssr: false,
    loading: () => (
      <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 h-[52px]" />
    ), // Placeholder with same height
  }
);

// Utility function to extract text content from BlockNote blocks
const extractTextFromBlocks = (blocks: any[]): string => {
  if (!blocks || !Array.isArray(blocks)) return "";

  return blocks
    .map((block: any) => {
      // Handle blocks with content property (paragraph, heading, quote, list items, etc.)
      if (block.content && Array.isArray(block.content)) {
        return block.content
          .map((item: any) => {
            if (item.type === "text" && item.text) {
              return item.text;
            }
            // Handle link content
            if (item.type === "link" && item.content) {
              return item.content
                .map((linkItem: any) => linkItem.text || "")
                .join("");
            }
            return "";
          })
          .join("");
      }

      // Handle code blocks - they have content but it's structured differently
      if (block.type === "codeBlock" && block.content) {
        return block.content.map((item: any) => item.text || "").join("");
      }

      // Handle table blocks - extract text from all cells
      if (block.type === "table" && block.content) {
        return block.content
          .map((row: any) => {
            if (row.type === "tableRow" && row.content) {
              return row.content
                .map((cell: any) => {
                  if (cell.type === "tableCell" && cell.content) {
                    return cell.content
                      .map((cellItem: any) => {
                        if (cellItem.type === "text" && cellItem.text) {
                          return cellItem.text;
                        }
                        return "";
                      })
                      .join("");
                  }
                  return "";
                })
                .join(" ");
            }
            return "";
          })
          .join(" ");
      }

      // Handle blocks without content (like images, files, etc.)
      // For these, we might want to count them as having some text representation
      if (block.type === "image" && block.props?.caption) {
        return block.props.caption;
      }
      if (block.type === "file" && block.props?.name) {
        return block.props.name;
      }
      if (block.type === "audio" && block.props?.name) {
        return block.props.name;
      }
      if (block.type === "video" && block.props?.name) {
        return block.props.name;
      }

      return "";
    })
    .join(" ")
    .trim();
};

// This function runs on the client and tries to get the initial state
// synchronously from localStorage. This avoids a flicker or loading state.
const getInitialState = () => {
  if (typeof window === "undefined") {
    return {
      activeNoteId: null,
      notes: [],
      theme: "light",
      characterCount: 0,
    };
  }
  try {
    const theme = localStorage.getItem("tabula-theme") || "light";

    // For now, return empty state - we'll load from IndexedDB in useEffect
    // This prevents hydration mismatches
    return {
      activeNoteId: null,
      notes: [],
      theme,
      characterCount: 0,
    };
  } catch (e) {
    console.error("Error loading initial state:", e);
    return {
      activeNoteId: null,
      notes: [],
      theme: "light",
      characterCount: 0,
    };
  }
};

const GOOGLE_CLIENT_ID =
  "284239172338-8h05pivsirhrc2joc1d21vqgurvpeg63.apps.googleusercontent.com";

export default function Home() {
  const [isClient, setIsClient] = React.useState(false);

  // Use a ref to store initial state to avoid re-running getInitialState
  const initialStateRef = React.useRef(getInitialState());

  const [notes, setNotes] = React.useState<Note[]>(
    initialStateRef.current.notes
  );
  const [activeNoteId, setActiveNoteId] = React.useState<string | null>(
    initialStateRef.current.activeNoteId
  );
  const [theme, setTheme] = React.useState(initialStateRef.current.theme);
  const [characterCount, setCharacterCount] = React.useState(
    initialStateRef.current.characterCount
  );

  const [isImageDialogOpen, setIsImageDialogOpen] = React.useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = React.useState<string | null>(
    null
  );

  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState("");

  const renameInputRef = React.useRef<HTMLInputElement>(null);
  const editorRef = React.useRef<BlockNoteEditorRef>(null);
  const { toast } = useToast();

  const [isGapiLoaded, setIsGapiLoaded] = React.useState(false);
  const [isDriveReady, setIsDriveReady] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [isGoogleSDKInitialized, setIsGoogleSDKInitialized] =
    React.useState(false);

  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const prevActiveNoteIdRef = React.useRef<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isFullSyncing, setIsFullSyncing] = React.useState(false); // For UI lock during full sync
  const [lastSyncTime, setLastSyncTime] = React.useState<number | null>(null);
  const [lastFullSyncTime, setLastFullSyncTime] = React.useState<number | null>(
    null
  ); // Track last full sync separately
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [isOnline, setIsOnline] = React.useState(true);
  const [pendingSyncs, setPendingSyncs] = React.useState<number>(0);
  const [retryCount, setRetryCount] = React.useState(0);
  const [syncProgress, setSyncProgress] = React.useState<SyncProgressItem[]>(
    []
  );

  // IndexedDB initialization state
  const [isIndexedDBReady, setIsIndexedDBReady] = React.useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = React.useState(true);
  const maxRetries = 3;

  // Separate handler for sign-in to maintain user gesture chain
  const handleSignIn = React.useCallback(async () => {
    console.log("🔐 [Sign In] User initiated sign in");

    if (!isGapiLoaded) {
      console.log("❌ [Sign In] Google API not loaded yet");
      toast({
        title: "Google API not loaded yet.",
        description: "Please wait a moment and try again.",
        variant: "destructive",
      });
      return;
    }

    if (isLoggedIn) {
      console.log("ℹ️ [Sign In] Already logged in");
      toast({
        title: "Already signed in",
        description: "You're already connected to Google Drive.",
      });
      return;
    }

    try {
      console.log(
        "🚀 [Sign In] Reinitializing GIS client and calling requestToken"
      );

      // Reinitialize the GIS client to ensure tokenClient is properly set up
      await GoogleDrive.initGis(GOOGLE_CLIENT_ID, (tokenResponse) => {
        console.log("✅ [Auth] OAuth callback received, token acquired");
        GoogleDrive.setToken(tokenResponse);
        GoogleDrive.saveTokenToStorage(tokenResponse);
        setIsLoggedIn(true);
        setIsDriveReady(true);
        toast({
          title: "Signed in to Google Drive",
          description: "Click 'Sync' button to fetch your notes from Drive.",
          duration: 5000,
        });
      });

      // Call requestToken synchronously from user interaction to avoid popup blocker
      GoogleDrive.requestToken();
    } catch (error) {
      console.error("❌ [Sign In] Failed to open sign-in popup:", error);
      toast({
        title: "Sign-in failed",
        description:
          "Could not open sign-in window. Please check your popup blocker.",
        variant: "destructive",
      });
    }
  }, [isGapiLoaded, isLoggedIn, toast]);

  const handleCloudSync = React.useCallback(
    async (showToast = true, isAutoSync = false, uploadOnly = false) => {
      console.log("🔄 [Sync] Starting cloud sync...", {
        showToast,
        isAutoSync,
        uploadOnly,
        isGapiLoaded,
        isLoggedIn,
        isOnline,
        isSyncing,
        timestamp: new Date().toISOString(),
      });

      // Debug: Check authentication status
      const token = window.gapi?.client?.getToken?.() || window._gapiToken;
      console.log("🔍 [Sync] Authentication debug:", {
        hasGapi: !!window.gapi,
        hasClient: !!window.gapi?.client,
        hasToken: !!token,
        tokenType: typeof token,
        isGapiLoaded,
        isLoggedIn,
      });

      if (!isGapiLoaded) {
        console.log("❌ [Sync] Google API not loaded yet");
        if (showToast) {
          toast({
            title: "Google API not loaded yet.",
            variant: "destructive",
          });
        }
        return;
      }

      if (!isLoggedIn) {
        console.log("❌ [Sync] Not logged in");
        if (showToast) {
          toast({
            title: "Please sign in first",
            description: "Sign in to Google Drive to sync your notes.",
            variant: "destructive",
          });
        }
        return;
      }

      // Check if offline
      if (!isOnline) {
        console.log("❌ [Sync] Offline, queuing sync");
        if (showToast) {
          toast({
            title: "Offline",
            description: "Changes will sync when connection is restored.",
            variant: "destructive",
          });
        }
        setPendingSyncs((prev) => prev + 1);
        return;
      }

      // Prevent multiple simultaneous syncs
      if (isSyncing) {
        console.log("⏸️ [Sync] Already syncing, skipping");
        return;
      }

      console.log("🔒 [Sync] Acquiring sync lock");
      setIsSyncing(true);
      setSyncError(null);

      // CRITICAL: Save current editor content before any sync operation
      console.log("💾 [Sync] Saving current editor content before sync...");
      const notesWithCurrentContent = saveCurrentEditorContent();

      // Set full sync state for UI lock (only for full sync, not upload-only)
      if (!uploadOnly) {
        setIsFullSyncing(true);
        console.log("🔒 [Sync] UI locked for full sync operation");

        // Initialize progress tracking for full sync
        const initialProgress = notesWithCurrentContent.map((note) => ({
          noteId: note.id,
          noteName: note.name,
          status: "syncing" as SyncStatus,
        }));
        setSyncProgress(initialProgress);
      }

      try {
        if (showToast && !isAutoSync) {
          toast({
            title: uploadOnly
              ? "Uploading changes..."
              : "Syncing notes with Google Drive...",
          });
        }

        if (uploadOnly) {
          // Upload-only sync: Just upload current content, no fetch/merge
          console.log(
            "📤 [Sync] Upload-only mode: uploading current content..."
          );
          await GoogleDrive.uploadNotesToDrive(notesWithCurrentContent);
          console.log("✅ [Sync] Upload-only sync completed successfully!");

          if (showToast && !isAutoSync) {
            toast({
              title: "Upload successful!",
              description: "Your changes have been saved to Google Drive.",
            });
          }
        } else {
          // Full sync: Use simple sync for now
          console.log("🔄 [Sync] Starting simple sync...");

          try {
            // Create progress callback for sync
            const onProgress = (
              noteId: string,
              noteName: string,
              status: "syncing" | "complete" | "error"
            ) => {
              setSyncProgress((prev) => {
                const existingIndex = prev.findIndex(
                  (item) => item.noteId === noteId
                );
                if (existingIndex >= 0) {
                  // Update existing note
                  return prev.map((item, index) =>
                    index === existingIndex
                      ? { ...item, noteName, status: status as SyncStatus }
                      : item
                  );
                } else {
                  // Add new note (from Google Drive)
                  return [
                    ...prev,
                    { noteId, noteName, status: status as SyncStatus },
                  ];
                }
              });
            };

            const syncResult = await GoogleDrive.simpleSync(onProgress);

            console.log("✅ [Sync] Full sync completed:", {
              notesCount: syncResult.notes.length,
            });

            // Update local state with synced notes
            setNotes(syncResult.notes);

            // Set active note (try to restore from localStorage first)
            const lastActiveNoteId = localStorage.getItem(
              "tabula-last-active-note"
            );
            const activeNote =
              syncResult.notes.find((n) => n.id === lastActiveNoteId) ||
              syncResult.notes[0];
            if (activeNote) {
              setActiveNoteId(activeNote.id);
              localStorage.setItem("tabula-last-active-note", activeNote.id);
            }

            // Update last full sync time
            const fullSyncTime = Date.now();
            setLastFullSyncTime(fullSyncTime);
            localStorage.setItem(
              "tabula-last-full-sync",
              fullSyncTime.toString()
            );

            // Auto-close modal after 2 seconds and show success toast
            setTimeout(() => {
              setIsFullSyncing(false);
              setSyncProgress([]);
              if (showToast && !isAutoSync) {
                toast({
                  title: "Sync successful!",
                  description: `Synced ${syncResult.notes.length} notes with Google Drive.`,
                });
              }
            }, 2000);
          } catch (error) {
            const errorInfo = handleErrorWithToast(error, "full sync", toast);
            throw error; // Re-throw to be caught by outer try-catch
          }
        }

        // Update sync status
        setLastSyncTime(Date.now());
        setSyncError(null);
        setPendingSyncs(0); // Clear pending syncs on successful sync
        setRetryCount(0); // Reset retry count on successful sync

        console.log("✅ [Sync] Sync completed successfully!", {
          uploadOnly,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error("❌ [Sync] Sync error occurred:", e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        setSyncError(errorMessage);

        // Retry logic for transient errors
        if (retryCount < maxRetries && isAutoSync) {
          const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.log(
            `🔄 [Sync] Retrying sync in ${retryDelay}ms (attempt ${
              retryCount + 1
            }/${maxRetries})`
          );

          setTimeout(() => {
            setRetryCount((prev) => prev + 1);
            handleCloudSync(false, true, uploadOnly); // Retry silently with same uploadOnly setting
          }, retryDelay);
        } else {
          // Max retries reached or manual sync
          setRetryCount(0);
          console.log("❌ [Sync] Sync failed permanently:", {
            errorMessage,
            retryCount,
            maxRetries,
            isAutoSync,
            uploadOnly,
          });
          if (showToast) {
            toast({
              title: "Sync Failed",
              description:
                retryCount >= maxRetries
                  ? "Sync failed after multiple attempts. Please try again later."
                  : errorMessage,
              variant: "destructive",
            });
          }
        }
      } finally {
        setIsSyncing(false);
        setIsFullSyncing(false); // Always release UI lock
        setSyncProgress([]); // Clear progress on completion or error
        console.log("🔓 [Sync] Sync lock released");
      }
    },
    [
      isGapiLoaded,
      isLoggedIn,
      isSyncing,
      isOnline,
      retryCount,
      maxRetries,
      toast,
      notes,
    ]
  );

  // Track if initial sync has been performed
  const initialSyncDoneRef = React.useRef(false);

  React.useEffect(() => {
    // This effect runs once on mount to set the initial client state
    setIsClient(true);
    const state = initialStateRef.current;
    document.documentElement.classList.toggle("dark", state.theme === "dark");

    // Load last full sync time from localStorage
    const storedLastFullSync = localStorage.getItem("tabula-last-full-sync");
    if (storedLastFullSync) {
      setLastFullSyncTime(parseInt(storedLastFullSync, 10));
    }

    // Expose debug functions to window for console access
    (window as any).debugGoogleDrive = {
      testAPI: GoogleDrive.debugTestDriveAPI,
      basicAPI: GoogleDrive.debugBasicAPI,
      listFiles: GoogleDrive.debugListDriveFiles,
      clearCache: GoogleDrive.clearDriveCache,
      createTestNote: GoogleDrive.createTestNote,
      createSimpleTestNote: GoogleDrive.createSimpleTestNote,
      createTestNoteWithContent: GoogleDrive.createTestNoteWithContent,
      uploadFlow: GoogleDrive.debugUploadFlow,
      simpleSync: GoogleDrive.simpleSync,
    };

    // Initialize Google Drive API
    const initDrive = async () => {
      try {
        await GoogleDrive.loadGapi();

        // Check for existing token before setting isGapiLoaded
        const storedToken = await GoogleDrive.getTokenFromStorage();

        // Set isGapiLoaded first, then update other states
        setIsGapiLoaded(true);

        if (storedToken) {
          GoogleDrive.setToken(storedToken);
          setIsLoggedIn(true);
          setIsDriveReady(true);
        }

        await GoogleDrive.initGis(GOOGLE_CLIENT_ID, (tokenResponse) => {
          console.log("✅ [Auth] OAuth callback received, token acquired");
          GoogleDrive.setToken(tokenResponse);
          GoogleDrive.saveTokenToStorage(tokenResponse);
          setIsLoggedIn(true);
          setIsDriveReady(true);
          toast({
            title: "Signed in to Google Drive",
            description: "Click 'Sync' button to fetch your notes from Drive.",
            duration: 5000,
          });

          // Removed: Automatic sync after sign-in
          // User will manually click sync button when ready
        });

        // Mark Google SDK as fully initialized
        setIsGoogleSDKInitialized(true);
      } catch (error) {
        console.error("Failed to initialize Google Drive", error);
        toast({
          title: "Could not connect to Google Drive",
          variant: "destructive",
        });
        // Still mark as initialized even if there's an error
        setIsGoogleSDKInitialized(true);
      }
    };
    initDrive();
  }, [toast]);

  // Initialize IndexedDB and load notes
  React.useEffect(() => {
    if (!isClient) return;

    const initIndexedDB = async () => {
      try {
        console.log("🗄️ [IndexedDB] Initializing database...");
        await IndexedDB.initDB();
        setIsIndexedDBReady(true);
        console.log("✅ [IndexedDB] Database initialized");

        // Load notes from IndexedDB
        const loadedNotes = await IndexedDB.getAllNotes();
        console.log("📚 [IndexedDB] Loaded notes:", loadedNotes.length);

        if (loadedNotes.length === 0) {
          // Create welcome note if no notes exist
          const welcomeNote: IndexedDBNote = {
            id: `note-${Date.now()}`,
            name: "My First Note",
            content: JSON.stringify([
              {
                id: "1",
                type: "paragraph",
                props: {},
                content: [
                  { type: "text", text: "🎉 Welcome to ", styles: {} },
                  { type: "text", text: "Tabula", styles: { bold: true } },
                  { type: "text", text: "! 🎉", styles: {} },
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
                    text: "Your personal note-taking companion with IndexedDB storage and image support! ✨",
                    styles: {},
                  },
                ],
                children: [],
              },
              {
                id: "3",
                type: "heading",
                props: { level: 2 },
                content: [
                  { type: "text", text: "🖼️ Image Support", styles: {} },
                ],
                children: [],
              },
              {
                id: "4",
                type: "paragraph",
                props: {},
                content: [
                  {
                    type: "text",
                    text: "You can now paste images directly into your notes! Images are stored locally in IndexedDB and synced to Google Drive when you sync.",
                    styles: {},
                  },
                ],
                children: [],
              },
              {
                id: "5",
                type: "paragraph",
                props: {},
                content: [
                  {
                    type: "text",
                    text: "Try pasting an image (Ctrl/Cmd + V) or dragging and dropping one into this note!",
                    styles: { italic: true },
                  },
                ],
                children: [],
              },
            ]),
            createdAt: Date.now(),
            lastUpdatedAt: Date.now(),
          };

          await IndexedDB.saveNote(welcomeNote);
          setNotes([welcomeNote]);
          setActiveNoteId(welcomeNote.id);
          console.log("✅ [IndexedDB] Created welcome note");
        } else {
          // Load existing notes
          setNotes(loadedNotes);

          // Set active note (try to restore from localStorage first)
          const lastActiveNoteId = localStorage.getItem(
            "tabula-last-active-note"
          );
          const activeNote =
            loadedNotes.find((n) => n.id === lastActiveNoteId) ||
            loadedNotes[0];
          setActiveNoteId(activeNote.id);

          console.log(
            "✅ [IndexedDB] Restored notes and active note:",
            activeNote.id
          );
        }

        setIsLoadingNotes(false);
      } catch (error) {
        console.error("❌ [IndexedDB] Failed to initialize:", error);
        setIsLoadingNotes(false);
        toast({
          title: "Storage Error",
          description:
            "Failed to initialize local storage. Some features may not work.",
          variant: "destructive",
        });
      }
    };

    initIndexedDB();
  }, [isClient, toast]);

  // Removed: Initial sync on page load
  // Users will manually sync when they want to fetch updates from Drive
  // This prevents overwriting content if user starts typing immediately after page load

  // Load note content when activeNoteId changes
  React.useEffect(() => {
    if (!isClient || !activeNoteId) return;

    const activeNote = notes.find((n) => n.id === activeNoteId);
    if (activeNote) {
      // Calculate character count from BlockNote content
      try {
        const blocks = JSON.parse(activeNote.content);
        const textContent = extractTextFromBlocks(blocks);
        setCharacterCount(textContent.length);
      } catch (error) {
        // Fallback to HTML parsing for legacy content
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = activeNote.content;
        setCharacterCount(tempDiv.innerText.length);
      }
    }

    // Update the previous active note ID
    prevActiveNoteIdRef.current = activeNoteId;
    localStorage.setItem("tabula-last-active-note", activeNoteId);
  }, [activeNoteId, isClient, notes]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("tabula-theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    toast({
      title: `Switched to ${
        newTheme.charAt(0).toUpperCase() + newTheme.slice(1)
      } Mode`,
    });
  };

  // Convert HTML content to BlockNote format
  const convertHtmlToBlockNote = (htmlContent: string): string => {
    if (!htmlContent || htmlContent.trim() === "") {
      return JSON.stringify([
        {
          id: "1",
          type: "paragraph",
          props: {},
          content: [],
          children: [],
        },
      ]);
    }

    try {
      // Try to parse as existing BlockNote content first
      JSON.parse(htmlContent);
      return htmlContent;
    } catch {
      // If not valid JSON, convert HTML to BlockNote format
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlContent;
      const textContent = tempDiv.innerText || tempDiv.textContent || "";

      return JSON.stringify([
        {
          id: "1",
          type: "paragraph",
          props: {},
          content: textContent
            ? [{ type: "text", text: textContent, styles: {} }]
            : [],
          children: [],
        },
      ]);
    }
  };

  const handleContentChange = (content: string) => {
    console.log("🔄 [Content Change] Received content change:", {
      contentLength: content.length,
      contentPreview: content.substring(0, 100) + "...",
      activeNoteId,
      timestamp: new Date().toISOString(),
    });

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // For BlockNote, content is JSON string of blocks
    // We need to calculate character count from the blocks
    try {
      const blocks = JSON.parse(content);
      const textContent = extractTextFromBlocks(blocks);
      setCharacterCount(textContent.length);
      console.log(
        "📊 [Content Change] Character count updated:",
        textContent.length
      );
    } catch (error) {
      // Fallback to 0 if parsing fails
      setCharacterCount(0);
      console.error("❌ [Content Change] Failed to parse content:", error);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!activeNoteId || !isIndexedDBReady) {
        console.log(
          "⚠️ [Content Change] No active note ID or IndexedDB not ready, skipping save"
        );
        return;
      }
      try {
        // Find the current note
        const currentNote = notes.find((n) => n.id === activeNoteId);
        if (!currentNote) {
          console.log(
            "⚠️ [Content Change] Current note not found, skipping save"
          );
          return;
        }

        // Update the note with new content
        const updatedNote: IndexedDBNote = {
          ...currentNote,
          content: content,
          lastUpdatedAt: Date.now(),
        };

        console.log("💾 [Content Change] Updating note in IndexedDB:", {
          activeNoteId,
          contentLength: content.length,
          contentPreview: content.substring(0, 200) + "...",
        });

        // Save to IndexedDB
        await IndexedDB.saveNote(updatedNote);

        // Update local state
        const updatedNotes = notes.map((n) =>
          n.id === activeNoteId ? updatedNote : n
        );
        setNotes(updatedNotes);

        // Save active note ID to localStorage for persistence
        localStorage.setItem("tabula-last-active-note", activeNoteId);

        console.log("✅ [Content Change] Note saved to IndexedDB successfully");

        // Note: Auto-sync on content change has been removed
        // Users should manually sync or wait for daily sync reminder
      } catch (error) {
        console.error(
          "❌ [Content Change] Failed to save note to IndexedDB:",
          error
        );
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: "Could not save your note to local storage.",
        });
      }
    }, 500); // Debounce time in ms (0.5 seconds)
  };

  // BlockNote handles formatting internally, so we don't need these functions

  const handleExport = React.useCallback(() => {
    const activeNote = notes.find((n) => n.id === activeNoteId);
    if (!activeNote) return;

    try {
      let textContent = "";

      // Try to parse as BlockNote content first
      try {
        const blocks = JSON.parse(activeNote.content);
        textContent = extractTextFromBlocks(blocks).replace(/\s+/g, "\n");
      } catch {
        // Fallback to HTML parsing for legacy content
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = activeNote.content;
        textContent = tempDiv.innerText;
      }

      const blob = new Blob([textContent], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const activeNoteName = activeNote.name || "note";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `${activeNoteName.replace(/\s/g, "_")}-${timestamp}.txt`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "Note Exported",
        description: "Your note has been saved as a .txt file.",
      });
    } catch (error) {
      console.error("Failed to export note", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "There was an error exporting your note.",
      });
    }
  }, [toast, activeNoteId, notes]);

  const handleCreateNewNote = async () => {
    if (!isIndexedDBReady) {
      console.log(
        "⚠️ [Create Note] IndexedDB not ready, skipping note creation"
      );
      return;
    }

    try {
      const newNote: IndexedDBNote = {
        id: `note-${Date.now()}`,
        name: "Untitled Note",
        content: JSON.stringify([
          {
            id: "1",
            type: "paragraph",
            props: {},
            content: [
              { type: "text", text: "🎉 Welcome to ", styles: {} },
              { type: "text", text: "Tabula", styles: { bold: true } },
              { type: "text", text: "! 🎉", styles: {} },
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
                text: "Your personal note-taking companion with IndexedDB storage and image support! ✨",
                styles: {},
              },
            ],
            children: [],
          },
          {
            id: "3",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🖼️ Image Support", styles: {} }],
            children: [],
          },
          {
            id: "4",
            type: "paragraph",
            props: {},
            content: [
              {
                type: "text",
                text: "You can now paste images directly into your notes! Images are stored locally in IndexedDB and synced to Google Drive when you sync.",
                styles: {},
              },
            ],
            children: [],
          },
          {
            id: "5",
            type: "paragraph",
            props: {},
            content: [
              {
                type: "text",
                text: "Try pasting an image (Ctrl/Cmd + V) or dragging and dropping one into this note!",
                styles: { italic: true },
              },
            ],
            children: [],
          },
        ]),
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      console.log("📝 [Create Note] Creating new note:", newNote.id);

      // Save to IndexedDB
      await IndexedDB.saveNote(newNote);

      // Update local state
      const updatedNotes = [newNote, ...notes];
      setNotes(updatedNotes);
      setActiveNoteId(newNote.id);

      // Save active note ID to localStorage for persistence
      localStorage.setItem("tabula-last-active-note", newNote.id);

      console.log("✅ [Create Note] New note created successfully");

      // Note: Auto-sync on note creation has been removed
      // Users should manually sync or wait for daily sync reminder

      toast({
        title: "New Note Created",
        description: "Ready for your thoughts!",
      });
    } catch (error) {
      console.error("❌ [Create Note] Failed to create note:", error);
      toast({
        variant: "destructive",
        title: "Create Failed",
        description: "Could not create a new note.",
      });
    }
  };

  const handleDeleteNote = async (noteIdToDelete: string) => {
    if (!isIndexedDBReady) {
      console.log("⚠️ [Delete] IndexedDB not ready, skipping note deletion");
      return;
    }

    console.log("🗑️ [Delete] Starting note deletion:", noteIdToDelete);

    // Check if this is the last note
    const isLastNote = notes.length === 1;

    try {
      // Delete from IndexedDB
      await IndexedDB.deleteNote(noteIdToDelete);

      // Update local state
      const updatedNotes = notes.filter((n) => n.id !== noteIdToDelete);
      setNotes(updatedNotes);

      // Handle active note switching
      if (activeNoteId === noteIdToDelete) {
        if (updatedNotes.length > 0) {
          const sortedNotes = [...updatedNotes].sort(
            (a, b) => b.lastUpdatedAt - a.lastUpdatedAt
          );
          setActiveNoteId(sortedNotes[0].id);
          localStorage.setItem("tabula-last-active-note", sortedNotes[0].id);
        } else {
          // Always create a new note when deleting the last note
          // This ensures there's always at least one note available
          console.log("🔄 [Delete] Last note deleted, creating new note...");

          // Create new note directly instead of using handleCreateNewNote
          const newNote: IndexedDBNote = {
            id: `note-${Date.now()}`,
            name: "Untitled Note",
            content: JSON.stringify([
              {
                id: "1",
                type: "paragraph",
                props: {},
                content: [
                  { type: "text", text: "🎉 Welcome to ", styles: {} },
                  { type: "text", text: "Tabula", styles: { bold: true } },
                  { type: "text", text: "! 🎉", styles: {} },
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
                    text: "Your personal note-taking companion with IndexedDB storage and image support! ✨",
                    styles: {},
                  },
                ],
                children: [],
              },
            ]),
            createdAt: Date.now(),
            lastUpdatedAt: Date.now(),
          };

          // Save to IndexedDB
          await IndexedDB.saveNote(newNote);

          // Update local state with the new note (replacing the empty array)
          setNotes([newNote]);
          setActiveNoteId(newNote.id);
          localStorage.setItem("tabula-last-active-note", newNote.id);

          console.log("✅ [Delete] New note created successfully:", newNote.id);

          // If user is logged in, upload the new note to Google Drive immediately
          if (isLoggedIn) {
            try {
              console.log("📤 [Delete] Uploading new note to Google Drive...");
              await GoogleDrive.uploadNotesToDrive([newNote]);
              console.log(
                "✅ [Delete] New note uploaded to Google Drive successfully"
              );
            } catch (error) {
              console.error(
                "❌ [Delete] Failed to upload new note to Google Drive:",
                error
              );
              // Don't show error toast here as the note was created successfully locally
            }
          }
        }
      }

      // Clean up orphaned images asynchronously
      ImageStorage.cleanupOrphanedImages().then((cleanedCount) => {
        if (cleanedCount > 0) {
          console.log(`🧹 [Delete] Cleaned up ${cleanedCount} orphaned images`);
        }
      });

      // Delete from Google Drive immediately without triggering sync
      if (isLoggedIn) {
        try {
          console.log(
            "🗑️ [Delete] Deleting note from Google Drive:",
            noteIdToDelete
          );
          await GoogleDrive.deleteNoteFromDrive(noteIdToDelete);
          console.log(
            "✅ [Delete] Note deleted from Google Drive successfully"
          );

          if (isLastNote) {
            toast({
              title: "Note Deleted & New Note Created",
              description:
                "Last note removed from Google Drive. A new note has been created and synced.",
            });
          } else {
            toast({
              title: "Note Deleted",
              description: "Note removed from local storage and Google Drive.",
            });
          }
        } catch (error) {
          console.error(
            "❌ [Delete] Failed to delete from Google Drive:",
            error
          );
          toast({
            title: "Note Deleted Locally",
            description:
              "Note removed locally, but failed to delete from Google Drive.",
            variant: "destructive",
          });
        }
      } else {
        if (isLastNote) {
          toast({
            title: "Note Deleted & New Note Created",
            description:
              "Last note removed locally. A new note has been created.",
          });
        } else {
          toast({
            title: "Note Deleted",
            description: "Note removed from local storage.",
          });
        }
      }

      console.log("✅ [Delete] Note deleted successfully from IndexedDB");
    } catch (error) {
      console.error("❌ [Delete] Failed to delete note from IndexedDB:", error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Could not delete the note from local storage.",
      });
    }
  };

  const handleRenameNote = async (noteId: string, newName: string) => {
    if (!isIndexedDBReady) {
      console.log("⚠️ [Rename] IndexedDB not ready, skipping note rename");
      return;
    }

    const now = Date.now();

    console.log("📝 [Rename] Note rename requested:", {
      noteId,
      oldName: notes.find((n) => n.id === noteId)?.name,
      newName,
      lastUpdatedAt: now,
      timestamp: new Date(now).toISOString(),
    });

    try {
      // Find the current note
      const currentNote = notes.find((n) => n.id === noteId);
      if (!currentNote) {
        console.log("⚠️ [Rename] Note not found, skipping rename");
        return;
      }

      // Update the note with new name
      const updatedNote: IndexedDBNote = {
        ...currentNote,
        name: newName,
        lastUpdatedAt: now,
      };

      console.log("📝 [Rename] Updating note in IndexedDB:", {
        noteId,
        newName,
        lastUpdatedAt: now,
      });

      // Save to IndexedDB
      await IndexedDB.saveNote(updatedNote);

      // Update local state
      const updatedNotes = notes.map((n) =>
        n.id === noteId ? updatedNote : n
      );
      setNotes(updatedNotes);

      console.log("✅ [Rename] Note renamed successfully in IndexedDB");

      // Immediately sync rename to Google Drive without debounce
      if (isLoggedIn && !isSyncing) {
        console.log(
          "🔄 [Rename] Immediately syncing renamed note to Google Drive..."
        );
        try {
          await GoogleDrive.uploadNotesToDrive(updatedNotes);
          console.log(
            "✅ [Rename] Note renamed and synced to Google Drive successfully"
          );
          toast({
            title: "Note Renamed & Synced",
            description:
              "Your note has been renamed and synced to Google Drive.",
          });
        } catch (error) {
          console.error(
            "❌ [Rename] Failed to sync renamed note to Google Drive:",
            error
          );
          toast({
            title: "Note Renamed Locally",
            description: "Rename successful, but sync to Google Drive failed.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Note Renamed Successfully",
          description: "Note renamed in local storage.",
        });
      }
    } catch (error) {
      console.error("❌ [Rename] Failed to rename note in IndexedDB:", error);
      toast({
        variant: "destructive",
        title: "Rename Failed",
        description: "Could not rename the note in local storage.",
      });
    }
  };

  const handleStartRename = () => {
    if (activeNote) {
      setIsRenaming(true);
      setRenameValue(activeNote.name);
      setTimeout(() => renameInputRef.current?.select(), 0);
    }
  };

  const handleRenameSubmit = () => {
    if (activeNoteId && renameValue.trim()) {
      handleRenameNote(activeNoteId, renameValue.trim());
    }
    setIsRenaming(false);
  };

  // BlockNote handles all keyboard and click interactions internally

  const handleSignOut = () => {
    GoogleDrive.signOut();
    setIsLoggedIn(false);
    setIsDriveReady(false);
    setLastSyncTime(null); // Clear sync status
    setSyncError(null); // Clear any sync errors
    setPendingSyncs(0); // Clear pending syncs
    initialSyncDoneRef.current = false; // Reset initial sync flag
    toast({ title: "Signed out from Google Drive." });
  };

  // Function to test Google Drive sync with test data
  const handleTestSync = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Please sign in first",
        description: "You need to be signed in to test Google Drive sync.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({ title: "Testing Google Drive sync with test data..." });

      // Create a test note
      const testNote = GoogleDrive.createTestNote();

      // Save the test note to Google Drive
      await GoogleDrive.saveNotesToDrive([testNote]);

      toast({
        title: "Test sync successful!",
        description: "Test data has been saved to Google Drive.",
      });
    } catch (error) {
      console.error("Test sync failed:", error);
      toast({
        title: "Test sync failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Function to test Google Drive sync with simple test data
  const handleSimpleTestSync = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Please sign in first",
        description: "You need to be signed in to test Google Drive sync.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("🧪 [Simple Test] Starting simple test sync...");
      toast({ title: "Testing with simple data..." });

      // Create a simple test note
      const simpleTestNote = GoogleDrive.createSimpleTestNote();

      console.log("🧪 [Simple Test] Simple test note created:", simpleTestNote);

      // Save the simple test note to Google Drive
      await GoogleDrive.saveNotesToDrive([simpleTestNote]);

      console.log("🧪 [Simple Test] Simple test sync completed successfully");

      toast({
        title: "Simple test successful!",
        description: "Simple test data has been saved to Google Drive.",
      });
    } catch (error) {
      console.error("🧪 [Simple Test] Simple test sync failed:", error);
      toast({
        title: "Simple test failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Function to save current editor content immediately
  const saveCurrentEditorContent = (): Note[] => {
    console.log("🔍 [Save Content] Starting save current editor content:", {
      activeNoteId,
      hasEditorRef: !!editorRef.current,
      timestamp: new Date().toISOString(),
    });

    if (!activeNoteId || !editorRef.current) {
      console.log("⚠️ [Save Content] No active note or editor ref");
      return notes; // Return current notes if no active note
    }

    try {
      const editor = editorRef.current.getEditor();
      if (!editor) {
        console.log("⚠️ [Save Content] No editor instance");
        return notes; // Return current notes if no editor
      }

      // Get current content from editor
      const currentContent = JSON.stringify(editor.document);
      console.log("💾 [Save Content] Saving current editor content:", {
        activeNoteId,
        contentLength: currentContent.length,
        contentPreview: currentContent.substring(0, 100) + "...",
        editorDocument: editor.document,
        documentLength: editor.document.length,
      });

      // Update notes array immediately
      const updatedNotes = notes.map((n) =>
        n.id === activeNoteId
          ? { ...n, content: currentContent, lastUpdatedAt: Date.now() }
          : n
      );

      setNotes(updatedNotes);
      localStorage.setItem("tabula-notes", JSON.stringify(updatedNotes));

      console.log(
        "✅ [Save Content] Current editor content saved successfully:",
        {
          updatedNotesCount: updatedNotes.length,
          updatedNote: updatedNotes.find((n) => n.id === activeNoteId),
        }
      );
      return updatedNotes;
    } catch (error) {
      console.error(
        "❌ [Save Content] Failed to save current editor content:",
        error
      );
      return notes; // Return current notes on error
    }
  };

  // Function to force sync current notes to Google Drive
  const handleForceSync = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Please sign in first",
        description: "You need to be signed in to sync to Google Drive.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("🔄 [Force Sync] Starting force sync with current notes:", {
        notesCount: notes.length,
        notes: notes.map((n) => ({
          id: n.id,
          name: n.name,
          contentLength: n.content.length,
        })),
      });

      toast({ title: "Force syncing current notes to Google Drive..." });

      // CRITICAL: Save current editor content before uploading
      console.log(
        "💾 [Force Sync] Saving current editor content before upload..."
      );
      const notesWithCurrentContent = saveCurrentEditorContent();

      console.log("🔄 [Force Sync] Uploading notes with current content:", {
        notesCount: notesWithCurrentContent.length,
        notes: notesWithCurrentContent.map((n) => ({
          id: n.id,
          name: n.name,
          contentLength: n.content.length,
          hasContent: n.content && n.content.length > 0,
        })),
      });

      // Save notes with current content to Google Drive
      await GoogleDrive.uploadNotesToDrive(notesWithCurrentContent);

      toast({
        title: "Force sync successful!",
        description: `Synced ${notesWithCurrentContent.length} notes to Google Drive.`,
      });
    } catch (error) {
      console.error("Force sync failed:", error);
      toast({
        title: "Force sync failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Function to test storage system
  const handleStorageTest = async () => {
    try {
      console.log("🧪 [Storage Test] Starting storage system test...");
      toast({ title: "Testing storage system..." });

      await StorageTest.runAllTests();

      toast({
        title: "Storage test completed!",
        description: "Check the console for detailed results.",
      });
    } catch (error) {
      console.error("Storage test failed:", error);
      toast({
        title: "Storage test failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Function to debug Google Drive files
  const handleDebugDriveFiles = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Please sign in first",
        description: "You need to be signed in to debug Google Drive files.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("🔍 [Debug] Starting Google Drive file debug...");
      await GoogleDrive.debugListDriveFiles();

      toast({
        title: "Drive debug completed!",
        description: "Check the console for file listing results.",
      });
    } catch (error) {
      console.error("❌ [Debug] Drive debug failed:", error);
      toast({
        title: "Drive debug failed",
        description: "Check the console for error details.",
        variant: "destructive",
      });
    }
  };

  // Function to clear Google Drive cache
  const handleClearDriveCache = () => {
    try {
      console.log("🗑️ [Debug] Clearing Google Drive cache...");
      GoogleDrive.clearDriveCache();

      toast({
        title: "Drive cache cleared!",
        description: "Next sync will be fresh.",
      });
    } catch (error) {
      console.error("❌ [Debug] Cache clear failed:", error);
      toast({
        title: "Cache clear failed",
        description: "Check the console for error details.",
        variant: "destructive",
      });
    }
  };

  // Function to test Google Drive API
  const handleTestDriveAPI = async () => {
    try {
      console.log("🧪 [Test API] Testing Google Drive API...");
      toast({ title: "Testing Google Drive API..." });

      await GoogleDrive.debugTestDriveAPI();

      toast({
        title: "API test completed!",
        description: "Check the console for detailed results.",
      });
    } catch (error) {
      console.error("API test failed:", error);
      toast({
        title: "API test failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Function to debug current notes state
  const handleDebugNotesState = () => {
    console.log("🔍 [Debug Notes] Current notes state:", {
      notesCount: notes.length,
      activeNoteId: activeNoteId,
      notes: notes.map((note, index) => ({
        index,
        id: note.id,
        name: note.name,
        contentLength: note.content.length,
        hasContent: note.content && note.content.length > 0,
        contentPreview: note.content
          ? note.content.substring(0, 100) + "..."
          : "NO CONTENT",
        createdAt: note.createdAt,
        lastUpdatedAt: note.lastUpdatedAt,
      })),
    });

    toast({
      title: "Notes state logged!",
      description: `Found ${notes.length} notes. Check console for details.`,
    });
  };

  // const handleBodyClick = () => {
  //   if (editorRef.current) {
  //     try {
  //       editorRef.current.focus();
  //     } catch (error) {
  //       console.error("Failed to focus editor:", error);
  //     }
  //   }
  // };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // BlockNote handles most shortcuts internally
      // We can add custom shortcuts here if needed
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleExport]);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Offline detection and auto-sync when connection is restored
  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (pendingSyncs > 0 && isLoggedIn && !isSyncing) {
        toast({
          title: "Connection restored",
          description: "You can now sync your changes manually.",
        });
        // Note: Auto-sync on connection restore has been removed
        // Users should manually sync when ready
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Set initial online status
    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [pendingSyncs, isLoggedIn, isSyncing, handleCloudSync, toast]);

  // Removed: Automatic sync on page visibility change
  // Users will manually sync when they want to fetch updates from Drive
  // This prevents overwriting content if user starts typing immediately after returning to tab

  // 24-hour sync reminder system
  React.useEffect(() => {
    if (!isLoggedIn || !lastFullSyncTime) return;

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const CHECK_INTERVAL = 60 * 1000; // Check every minute

    const checkSyncReminder = () => {
      const timeSinceLastSync = Date.now() - lastFullSyncTime;

      if (timeSinceLastSync > TWENTY_FOUR_HOURS) {
        // Show reminder notification
        const lastReminderShown = localStorage.getItem(
          "tabula-last-reminder-shown"
        );
        const lastReminderTime = lastReminderShown
          ? parseInt(lastReminderShown, 10)
          : 0;
        const timeSinceLastReminder = Date.now() - lastReminderTime;

        // Only show reminder once every 6 hours to avoid spam
        if (timeSinceLastReminder > 6 * 60 * 60 * 1000) {
          console.log("⏰ [Sync Reminder] Showing 24-hour sync reminder");
          toast({
            title: "Sync Recommended",
            description:
              "It's been over 24 hours since your last sync. Click the sync button to get updates from Drive.",
            duration: 10000,
          });
          localStorage.setItem(
            "tabula-last-reminder-shown",
            Date.now().toString()
          );
        }
      }
    };

    // Check immediately
    checkSyncReminder();

    // Then check every minute
    const intervalId = setInterval(checkSyncReminder, CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isLoggedIn, lastFullSyncTime, toast]);

  // Daily auto-sync system - syncs once per day after midnight when app loads
  React.useEffect(() => {
    if (!isLoggedIn || !isGapiLoaded) return;

    const performDailyAutoSync = async () => {
      const now = new Date();
      const today = now.toDateString(); // e.g., "Mon Jan 01 2024"
      const lastSyncDate = localStorage.getItem("tabula-last-daily-sync");

      // Check if it's after midnight (00:00) and we haven't synced today
      const isAfterMidnight = now.getHours() >= 0;
      const hasSyncedToday = lastSyncDate === today;

      if (isAfterMidnight && !hasSyncedToday) {
        console.log("🔄 [Daily Auto-Sync] Starting automatic daily sync...", {
          currentTime: now.toISOString(),
          today,
          lastSyncDate,
          isAfterMidnight,
          hasSyncedToday,
        });

        try {
          // Trigger full sync using existing sync flow (shows modal, disables UI)
          await handleCloudSync(false, true, false); // showToast=false, isAutoSync=true, uploadOnly=false

          // Mark today as synced
          localStorage.setItem("tabula-last-daily-sync", today);

          console.log("✅ [Daily Auto-Sync] Daily sync completed successfully");
        } catch (error) {
          console.error("❌ [Daily Auto-Sync] Daily sync failed:", error);
          // Error handling is already managed by handleCloudSync
        }
      } else {
        console.log("⏭️ [Daily Auto-Sync] Skipping daily sync", {
          isAfterMidnight,
          hasSyncedToday,
          today,
          lastSyncDate,
        });
      }
    };

    // Run once when component mounts and dependencies are ready
    performDailyAutoSync();
  }, [isLoggedIn, isGapiLoaded, handleCloudSync]);

  const activeNote = notes.find((n) => n.id === activeNoteId);
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${
      months[date.getMonth()]
    } ${date.getDate()}, ${date.getFullYear()}`;
  };

  const getNextSyncTime = () => {
    const now = new Date();
    const today = now.toDateString();
    const lastSyncDate = localStorage.getItem("tabula-last-daily-sync");

    // If we haven't synced today and it's after midnight, next sync is "Today at 12:00 AM"
    if (lastSyncDate !== today && now.getHours() >= 0) {
      return "Today at 12:00 AM";
    }

    // If we've already synced today, next sync is tomorrow at midnight
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `Tomorrow at 12:00 AM (${
      months[tomorrow.getMonth()]
    } ${tomorrow.getDate()})`;
  };

  if (!isClient || isLoadingNotes) {
    return (
      <main className="relative min-h-screen bg-background text-foreground font-body transition-colors duration-300">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">
              {!isClient ? "Loading..." : "Initializing storage..."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <main className="relative min-h-screen bg-background text-foreground font-body transition-colors duration-300">
        {/* Full Sync Loading Overlay */}
        {isFullSyncing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 shadow-lg border max-w-lg w-full mx-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="text-center w-full">
                <h3 className="text-lg font-semibold mb-2">
                  Syncing with Google Drive
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Please wait while we fetch and merge your notes...
                </p>

                {/* Progress List */}
                {syncProgress.length > 0 && (
                  <div className="max-h-64 overflow-y-auto border rounded-lg p-4 bg-muted/30">
                    <div className="space-y-2">
                      {syncProgress.map((item) => (
                        <div
                          key={item.noteId}
                          className="flex items-center gap-3 py-2"
                        >
                          <div className="flex-shrink-0">
                            {item.status === "complete" ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : item.status === "error" ? (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            ) : (
                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.noteName}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {item.status === "syncing" && "Syncing..."}
                              {item.status === "complete" && "Complete"}
                              {item.status === "error" && "Error"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    ℹ️ Note: Images will not sync
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Visit{" "}
                    <a
                      href="https://tabulanotes.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                    >
                      tabulanotes.com
                    </a>{" "}
                    for feature requests and feedback
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Do not close this window
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="fixed top-0 left-0 right-0 h-12 flex justify-between items-center z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <div className="flex-1"></div>
          <div className="flex-1 flex justify-center items-center group">
            {isClient && activeNote && (
              <>
                {isRenaming ? (
                  <Input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
                    className="w-auto h-8 text-lg font-semibold text-center bg-transparent border-primary"
                    style={{
                      minWidth: "100px",
                      maxWidth: "50vw",
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <h1
                      onClick={handleStartRename}
                      className="text-lg font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {activeNote.name}
                    </h1>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleStartRename}
                      className="h-6 w-6 opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex-1 flex justify-end items-center gap-2">
            {/* Status Indicator */}
            <LazyStatusIndicator
              isLoggedIn={isLoggedIn}
              isSyncing={isSyncing}
              isFullSyncing={isFullSyncing}
              syncError={syncError}
              isOnline={isOnline}
              pendingSyncs={pendingSyncs}
              lastSyncTime={lastSyncTime}
              lastFullSyncTime={lastFullSyncTime}
              isGoogleSDKInitialized={isGoogleSDKInitialized}
              onSyncClick={handleCloudSync}
              onSignInClick={handleSignIn}
              onSignOutClick={handleSignOut}
              tooltipContent={
                <div className="text-sm space-y-1">
                  {!isLoggedIn ? (
                    "Connect to Google Drive to sync your notes"
                  ) : isFullSyncing ? (
                    "Syncing your notes with Google Drive..."
                  ) : isSyncing ? (
                    "Uploading changes to Google Drive..."
                  ) : syncError ? (
                    "There was an error syncing. Click to retry."
                  ) : (
                    <>
                      <div>Your notes are synced with Google Drive</div>
                      {lastFullSyncTime && (
                        <div className="text-xs text-muted-foreground">
                          Last sync: {formatDate(lastFullSyncTime)}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Next auto-sync: {getNextSyncTime()}
                      </div>
                    </>
                  )}
                </div>
              }
            />

            {isClient && activeNote && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="end"
                  className="max-w-sm p-3"
                >
                  <div className="text-xs space-y-3">
                    <div>
                      <div className="font-semibold text-sm mb-2">
                        Note Information
                      </div>
                      <div className="text-muted-foreground flex flex-col gap-1">
                        <span>Characters: {characterCount}</span>
                        <span>Created: {formatDate(activeNote.createdAt)}</span>
                        <span>
                          Updated: {formatDate(activeNote.lastUpdatedAt)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-sm mb-2">
                        Quick Shortcuts
                      </div>
                      <div className="space-y-1 text-muted-foreground">
                        <div>
                          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                            Ctrl/Cmd + B
                          </kbd>{" "}
                          Bold
                        </div>
                        <div>
                          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                            Ctrl/Cmd + I
                          </kbd>{" "}
                          Italic
                        </div>
                        <div>
                          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                            Ctrl/Cmd + Shift + 1/2/3
                          </kbd>{" "}
                          Headings
                        </div>
                        <div>
                          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                            Ctrl/Cmd + Shift + 8/7
                          </kbd>{" "}
                          Lists
                        </div>
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div
          className="w-full h-full min-h-screen pt-4 pb-4"
          // onClick={handleBodyClick}
        >
          {isClient && activeNote && (
            <div className="w-full h-full  p-10 outline-none text-lg leading-relaxed">
              <BlockNoteEditor
                ref={editorRef}
                initialContent={(() => {
                  const content = convertHtmlToBlockNote(activeNote.content);
                  console.log("📝 [Page] Passing content to editor:", {
                    noteId: activeNote.id,
                    contentLength: content.length,
                    hasImages: content.includes('"type":"image"'),
                    contentPreview: content.substring(0, 200) + "...",
                  });
                  return content;
                })()}
                onChange={handleContentChange}
                autoFocus={!isFullSyncing} // Don't auto-focus during full sync
                theme={theme as "light" | "dark"}
              />
            </div>
          )}
        </div>

        {isClient && (
          <LazyToolbar
            {...{
              notes,
              activeNoteId,
              theme,
              isLoggedIn,
              isSyncing,
              isFullSyncing,
              lastSyncTime,
              lastFullSyncTime,
              syncError,
              isOnline,
              pendingSyncs,
              editorRef,
              setActiveNoteId,
              handleCreateNewNote,
              handleDeleteNote,
              handleExport,
              toggleTheme,
              handleSignIn,
              handleCloudSync: () => handleCloudSync(true, false, false), // Manual sync button always does full sync
              handleSignOut,
            }}
          />
        )}

        {isClient && (
          <LazyImageDialog
            isOpen={isImageDialogOpen}
            onOpenChange={setIsImageDialogOpen}
            src={selectedImageSrc}
            toast={toast}
          />
        )}

        <Toaster />
      </main>
    </TooltipProvider>
  );
}
