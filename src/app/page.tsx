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
import { Pencil, Info, Copy, Download as DownloadIcon } from "lucide-react";
import * as GoogleDrive from "@/lib/google-drive";
import type { Note } from "@/lib/google-drive";
import { StorageTest } from "@/lib/storage-test";
import BlockNoteEditor, {
  type BlockNoteEditorRef,
} from "./BlockNoteEditor/blocknote";

const LazyImageDialog = dynamic(() => import("@/components/image-dialog"));
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
    const savedNotes = localStorage.getItem("tabula-notes");
    let notes: Note[] = savedNotes ? JSON.parse(savedNotes) : [];

    let activeNoteId = localStorage.getItem("tabula-last-active-note");
    let activeNote = notes.find((n) => n.id === activeNoteId);

    // If no active note, or if index is empty, create a new one
    if (!activeNoteId || notes.length === 0 || !activeNote) {
      const newNote: Note = {
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
                text: "Your personal note-taking companion that makes writing a joy. Let's get you started with some helpful tips! ✨",
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
              { type: "text", text: "⌨️ Quick Keyboard Shortcuts", styles: {} },
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
                text: "Master these shortcuts to write faster and more efficiently:",
                styles: { italic: true },
              },
            ],
            children: [],
          },
          {
            id: "5",
            type: "bulletListItem",
            props: {},
            content: [
              { type: "text", text: "💪 ", styles: {} },
              { type: "text", text: "Bold", styles: { bold: true } },
              { type: "text", text: " text: ", styles: {} },
              { type: "text", text: "Ctrl/Cmd + B", styles: { code: true } },
            ],
            children: [],
          },
          {
            id: "6",
            type: "bulletListItem",
            props: {},
            content: [
              { type: "text", text: "✨ ", styles: {} },
              { type: "text", text: "Italic", styles: { italic: true } },
              { type: "text", text: " text: ", styles: {} },
              { type: "text", text: "Ctrl/Cmd + I", styles: { code: true } },
            ],
            children: [],
          },
          {
            id: "7",
            type: "bulletListItem",
            props: {},
            content: [
              { type: "text", text: "❌ ", styles: {} },
              { type: "text", text: "Strikethrough", styles: { strike: true } },
              { type: "text", text: " text: ", styles: {} },
              {
                type: "text",
                text: "Ctrl/Cmd + Shift + S",
                styles: { code: true },
              },
            ],
            children: [],
          },
          {
            id: "8",
            type: "bulletListItem",
            props: {},
            content: [
              { type: "text", text: "📝 ", styles: {} },
              { type: "text", text: "Headings", styles: {} },
              { type: "text", text: " (H1, H2, H3): ", styles: {} },
              {
                type: "text",
                text: "Ctrl/Cmd + Shift + 1/2/3",
                styles: { code: true },
              },
            ],
            children: [],
          },
          {
            id: "9",
            type: "bulletListItem",
            props: {},
            content: [
              { type: "text", text: "📋 ", styles: {} },
              { type: "text", text: "Lists", styles: {} },
              {
                type: "text",
                text: " (bullet • or numbered 1.): ",
                styles: {},
              },
              {
                type: "text",
                text: "Ctrl/Cmd + Shift + 8/7",
                styles: { code: true },
              },
            ],
            children: [],
          },
          {
            id: "10",
            type: "heading",
            props: { level: 2 },
            content: [
              { type: "text", text: "🎨 See It In Action", styles: {} },
            ],
            children: [],
          },
          {
            id: "11",
            type: "paragraph",
            props: {},
            content: [
              {
                type: "text",
                text: "Here are some examples of what you can create:",
                styles: { italic: true },
              },
            ],
            children: [],
          },
          {
            id: "12",
            type: "heading",
            props: { level: 1 },
            content: [
              { type: "text", text: "📚 Main Topic (Heading 1)", styles: {} },
            ],
            children: [],
          },
          {
            id: "13",
            type: "heading",
            props: { level: 2 },
            content: [
              { type: "text", text: "📖 Subsection (Heading 2)", styles: {} },
            ],
            children: [],
          },
          {
            id: "14",
            type: "heading",
            props: { level: 3 },
            content: [
              { type: "text", text: "📝 Details (Heading 3)", styles: {} },
            ],
            children: [],
          },
          {
            id: "15",
            type: "bulletListItem",
            props: {},
            content: [
              { type: "text", text: "✨ ", styles: {} },
              { type: "text", text: "Mix and match formatting", styles: {} },
            ],
            children: [],
          },
          {
            id: "16",
            type: "bulletListItem",
            props: {},
            content: [
              { type: "text", text: "💪 ", styles: {} },
              { type: "text", text: "Bold", styles: { bold: true } },
              { type: "text", text: " and ", styles: {} },
              { type: "text", text: "italic", styles: { italic: true } },
              { type: "text", text: " text together", styles: {} },
            ],
            children: [],
          },
          {
            id: "17",
            type: "bulletListItem",
            props: {},
            content: [
              { type: "text", text: "❌ ", styles: {} },
              { type: "text", text: "Strikethrough", styles: { strike: true } },
              { type: "text", text: " for corrections", styles: {} },
            ],
            children: [],
          },
          {
            id: "18",
            type: "numberedListItem",
            props: {},
            content: [
              { type: "text", text: "1️⃣ ", styles: {} },
              { type: "text", text: "Organize your thoughts", styles: {} },
            ],
            children: [],
          },
          {
            id: "19",
            type: "numberedListItem",
            props: {},
            content: [
              { type: "text", text: "2️⃣ ", styles: {} },
              { type: "text", text: "Create structured lists", styles: {} },
            ],
            children: [],
          },
          {
            id: "20",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🚀 Ready to Start?", styles: {} }],
            children: [],
          },
          {
            id: "21",
            type: "paragraph",
            props: {},
            content: [
              {
                type: "text",
                text: "You're all set! Start typing anywhere to create your own notes. Here are some cool features to explore:",
                styles: {},
              },
            ],
            children: [],
          },
          {
            id: "22",
            type: "bulletListItem",
            props: {},
            content: [
              { type: "text", text: "🖼️ ", styles: {} },
              { type: "text", text: "Drag & drop images", styles: {} },
            ],
            children: [],
          },
          {
            id: "23",
            type: "bulletListItem",
            props: {},
            content: [
              { type: "text", text: "☁️ ", styles: {} },
              { type: "text", text: "Google Drive sync", styles: {} },
            ],
            children: [],
          },
          {
            id: "24",
            type: "bulletListItem",
            props: {},
            content: [
              { type: "text", text: "🌙 ", styles: {} },
              { type: "text", text: "Dark/Light theme toggle", styles: {} },
            ],
            children: [],
          },
          {
            id: "25",
            type: "paragraph",
            props: {},
            content: [
              {
                type: "text",
                text: "Happy note-taking! 🎉",
                styles: { bold: true, italic: true },
              },
            ],
            children: [],
          },
        ]),
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };
      notes = [newNote, ...notes.filter((n) => n.id !== newNote.id)];
      activeNoteId = newNote.id;
      activeNote = newNote;
      localStorage.setItem("tabula-notes", JSON.stringify(notes));
      localStorage.setItem("tabula-last-active-note", activeNoteId);
    }

    // Calculate character count from BlockNote content
    let characterCount = 0;
    try {
      const blocks = JSON.parse(activeNote.content);
      const textContent = extractTextFromBlocks(blocks);
      characterCount = textContent.length;
    } catch (error) {
      // Fallback to HTML parsing for legacy content
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = activeNote.content;
      characterCount = tempDiv.innerText.length;
    }

    return { activeNoteId, notes, theme, characterCount };
  } catch (e) {
    console.error("Failed to initialize state from localStorage", e);
    // Return a default safe state
    const fallbackNote: Note = {
      id: "fallback",
      name: "Error Note",
      content: JSON.stringify([
        {
          id: "1",
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "Error loading note.", styles: {} }],
          children: [],
        },
      ]),
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
    return {
      activeNoteId: "fallback",
      notes: [fallbackNote],
      theme: "light",
      characterCount: "Error loading note.".length,
    };
  }
};

const GOOGLE_CLIENT_ID =
  "284239172338-oiblqhmj5e48ippdo9bvet6e8ps2bm8r.apps.googleusercontent.com";

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

  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const prevActiveNoteIdRef = React.useRef<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [lastSyncTime, setLastSyncTime] = React.useState<number | null>(null);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [isOnline, setIsOnline] = React.useState(true);
  const [pendingSyncs, setPendingSyncs] = React.useState<number>(0);
  const [retryCount, setRetryCount] = React.useState(0);
  const maxRetries = 3;

  const handleCloudSync = React.useCallback(
    async (showToast = true, isAutoSync = false) => {
      console.log("🔄 [Sync] Starting cloud sync...", {
        showToast,
        isAutoSync,
        isGapiLoaded,
        isLoggedIn,
        isOnline,
        isSyncing,
        timestamp: new Date().toISOString(),
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
        console.log("❌ [Sync] Not logged in, requesting token");
        if (showToast) {
          GoogleDrive.requestToken();
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

      try {
        if (showToast && !isAutoSync) {
          toast({ title: "Syncing notes with Google Drive..." });
        }

        console.log("📥 [Sync] Step 1: Fetching notes from Drive...");
        // 1. Fetch notes from Drive
        const cloudNotes = await GoogleDrive.loadNotesFromDrive();
        console.log("📥 [Sync] Cloud notes fetched:", {
          cloudNotesCount: cloudNotes ? cloudNotes.length : 0,
          hasCloudNotes: !!cloudNotes,
          cloudNotes: cloudNotes
            ? cloudNotes.map((n) => ({
                id: n.id,
                name: n.name,
                lastUpdatedAt: new Date(n.lastUpdatedAt).toISOString(),
              }))
            : [],
        });

        console.log("🔄 [Sync] Step 2: Merging local and cloud notes...");
        // 2. Merge local and cloud notes with enhanced conflict resolution
        // CRITICAL: Save current editor content before syncing
        console.log("💾 [Sync] Saving current editor content before sync...");
        const notesWithCurrentContent = saveCurrentEditorContent();

        // Use notes with current content instead of localStorage to get the latest data
        const localNotes = notesWithCurrentContent;
        console.log(
          "📋 [Sync] Local notes loaded from state with current content:",
          {
            localNotesCount: localNotes.length,
            notesFromState: true,
            hasCurrentContent: true,
            localNotes: localNotes.map((n) => ({
              id: n.id,
              name: n.name,
              lastUpdatedAt: new Date(n.lastUpdatedAt).toISOString(),
            })),
          }
        );

        const combinedNotes: { [key: string]: Note } = {};

        // Add all local notes to the map
        for (const note of localNotes) {
          combinedNotes[note.id] = note;
        }
        console.log(
          "📋 [Sync] Local notes added to merge map:",
          Object.keys(combinedNotes).length
        );

        // Add/update with cloud notes using intelligent conflict resolution
        if (cloudNotes) {
          console.log("🔄 [Sync] Processing cloud notes for merge...");
          let conflictsResolved = 0;
          let newNotesAdded = 0;

          for (const cloudNote of cloudNotes) {
            const localNote = combinedNotes[cloudNote.id];

            if (localNote) {
              // Note exists in both - resolve conflict
              const timeDiff = Math.abs(
                cloudNote.lastUpdatedAt - localNote.lastUpdatedAt
              );

              console.log(
                `🔍 [Sync] Conflict resolution for note "${localNote.name}":`,
                {
                  localLastUpdated: new Date(
                    localNote.lastUpdatedAt
                  ).toISOString(),
                  cloudLastUpdated: new Date(
                    cloudNote.lastUpdatedAt
                  ).toISOString(),
                  timeDiff: timeDiff,
                  localName: localNote.name,
                  cloudName: cloudNote.name,
                  namesMatch: localNote.name === cloudNote.name,
                }
              );

              if (timeDiff < 5000) {
                // Less than 5 seconds difference - likely same edit
                // Keep the one with more recent timestamp
                if (cloudNote.lastUpdatedAt > localNote.lastUpdatedAt) {
                  combinedNotes[cloudNote.id] = cloudNote;
                  console.log(
                    `🔄 [Sync] Conflict resolved for "${cloudNote.name}" - using cloud version (time diff: ${timeDiff}ms)`
                  );
                } else {
                  console.log(
                    `🔄 [Sync] Conflict resolved for "${localNote.name}" - using local version (time diff: ${timeDiff}ms)`
                  );
                }
                conflictsResolved++;
              } else {
                // Significant time difference - prioritize local changes
                const localContent = localNote.content;
                const cloudContent = cloudNote.content;

                // Always prioritize local changes if they're more recent
                if (localNote.lastUpdatedAt > cloudNote.lastUpdatedAt) {
                  console.log(
                    `✅ [Sync] Local changes to "${localNote.name}" are newer - keeping local version (time diff: ${timeDiff}ms)`
                  );
                  // Keep local version (already in combinedNotes)
                } else {
                  // Cloud is newer, but check if it's a significant change
                  if (localContent === cloudContent) {
                    // Same content, use cloud version
                    combinedNotes[cloudNote.id] = cloudNote;
                    console.log(
                      `🔄 [Sync] Same content for "${cloudNote.name}" - using cloud version (time diff: ${timeDiff}ms)`
                    );
                  } else {
                    // Different content - use cloud version but warn user
                    combinedNotes[cloudNote.id] = cloudNote;
                    console.log(
                      `⚠️ [Sync] Note "${cloudNote.name}" was updated on another device (time diff: ${timeDiff}ms)`
                    );
                  }
                }
                conflictsResolved++;
              }
            } else {
              // Note doesn't exist locally, add it
              combinedNotes[cloudNote.id] = cloudNote;
              newNotesAdded++;
              console.log(
                `➕ [Sync] New note added from cloud: "${cloudNote.name}"`
              );
            }
          }

          console.log("🔄 [Sync] Merge summary:", {
            conflictsResolved,
            newNotesAdded,
            totalCloudNotes: cloudNotes.length,
          });
        }

        const mergedNotes = Object.values(combinedNotes);
        console.log("📊 [Sync] Final merged notes count:", mergedNotes.length);

        console.log("💾 [Sync] Step 3: Saving merged notes back to Drive...");
        // 3. Save merged notes back to Drive
        await GoogleDrive.saveNotesToDrive(mergedNotes);
        console.log("✅ [Sync] Notes saved to Drive successfully");

        console.log("🔄 [Sync] Step 4: Updating local state...");
        // 4. Update local state with merged notes
        setNotes(mergedNotes);
        localStorage.setItem("tabula-notes", JSON.stringify(mergedNotes));
        console.log("✅ [Sync] Local state updated");

        // Update sync status
        setLastSyncTime(Date.now());
        setSyncError(null);
        setPendingSyncs(0); // Clear pending syncs on successful sync
        setRetryCount(0); // Reset retry count on successful sync

        console.log("✅ [Sync] Sync completed successfully!", {
          finalNotesCount: mergedNotes.length,
          timestamp: new Date().toISOString(),
        });

        if (showToast && !isAutoSync) {
          toast({
            title: "Sync successful!",
            description: "Your notes are up to date.",
          });
        }
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
            handleCloudSync(false, true); // Retry silently
          }, retryDelay);
        } else {
          // Max retries reached or manual sync
          setRetryCount(0);
          console.log("❌ [Sync] Sync failed permanently:", {
            errorMessage,
            retryCount,
            maxRetries,
            isAutoSync,
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

  React.useEffect(() => {
    // This effect runs once on mount to set the initial client state
    setIsClient(true);
    const state = initialStateRef.current;
    document.documentElement.classList.toggle("dark", state.theme === "dark");

    // Initialize Google Drive API
    const initDrive = async () => {
      try {
        await GoogleDrive.loadGapi();
        setIsGapiLoaded(true);

        // Check for existing token
        const storedToken = await GoogleDrive.getTokenFromStorage();
        if (storedToken) {
          GoogleDrive.setToken(storedToken);
          setIsLoggedIn(true);
          setIsDriveReady(true);
          // Perform a silent sync on load - use setTimeout to avoid dependency issues
          setTimeout(() => {
            handleCloudSync(false);
          }, 1000);
        }

        await GoogleDrive.initGis(GOOGLE_CLIENT_ID, (tokenResponse) => {
          GoogleDrive.setToken(tokenResponse);
          GoogleDrive.saveTokenToStorage(tokenResponse);
          setIsLoggedIn(true);
          setIsDriveReady(true);
          toast({ title: "Signed in to Google Drive" });
          // Sync after successful login - use setTimeout to avoid dependency issues
          setTimeout(() => {
            handleCloudSync();
          }, 1000);
        });
      } catch (error) {
        console.error("Failed to initialize Google Drive", error);
        toast({
          title: "Could not connect to Google Drive",
          variant: "destructive",
        });
      }
    };
    initDrive();
  }, [toast]); // Removed handleCloudSync from dependencies

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

    saveTimeoutRef.current = setTimeout(() => {
      if (!activeNoteId) {
        console.log("⚠️ [Content Change] No active note ID, skipping save");
        return;
      }
      try {
        const updatedNotes = notes.map((n) =>
          n.id === activeNoteId
            ? { ...n, content: content, lastUpdatedAt: Date.now() }
            : n
        );

        console.log("💾 [Content Change] Updating notes:", {
          activeNoteId,
          contentLength: content.length,
          notesCount: updatedNotes.length,
          updatedNote: updatedNotes.find((n) => n.id === activeNoteId),
          contentPreview: content.substring(0, 200) + "...",
        });

        setNotes(updatedNotes);
        localStorage.setItem("tabula-notes", JSON.stringify(updatedNotes));
        console.log(
          "✅ [Content Change] Notes saved to localStorage successfully"
        );

        // Auto-sync to Google Drive if logged in and not already syncing
        if (isLoggedIn && !isSyncing) {
          console.log("🔄 [Content Change] Scheduling auto-sync...");
          // Clear existing timeout
          if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
          }

          // Set new timeout for auto-sync
          syncTimeoutRef.current = setTimeout(() => {
            console.log("🔄 [Content Change] Executing auto-sync...");
            handleCloudSync(false, true); // Silent auto-sync
          }, 2000); // Auto-sync after 2 seconds of inactivity
        }
      } catch (error) {
        console.error("Failed to save note to local storage", error);
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: "Could not save your note to local storage.",
        });
      }
    }, 500); // Debounce time in ms
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

  const handleCreateNewNote = () => {
    const newNote: Note = {
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
              text: "Your personal note-taking companion that makes writing a joy. Let's get you started with some helpful tips! ✨",
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
            { type: "text", text: "⌨️ Quick Keyboard Shortcuts", styles: {} },
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
              text: "Master these shortcuts to write faster and more efficiently:",
              styles: { italic: true },
            },
          ],
          children: [],
        },
        {
          id: "5",
          type: "bulletListItem",
          props: {},
          content: [
            { type: "text", text: "💪 ", styles: {} },
            { type: "text", text: "Bold", styles: { bold: true } },
            { type: "text", text: " text: ", styles: {} },
            { type: "text", text: "Ctrl/Cmd + B", styles: { code: true } },
          ],
          children: [],
        },
        {
          id: "6",
          type: "bulletListItem",
          props: {},
          content: [
            { type: "text", text: "✨ ", styles: {} },
            { type: "text", text: "Italic", styles: { italic: true } },
            { type: "text", text: " text: ", styles: {} },
            { type: "text", text: "Ctrl/Cmd + I", styles: { code: true } },
          ],
          children: [],
        },
        {
          id: "7",
          type: "bulletListItem",
          props: {},
          content: [
            { type: "text", text: "❌ ", styles: {} },
            { type: "text", text: "Strikethrough", styles: { strike: true } },
            { type: "text", text: " text: ", styles: {} },
            {
              type: "text",
              text: "Ctrl/Cmd + Shift + S",
              styles: { code: true },
            },
          ],
          children: [],
        },
        {
          id: "8",
          type: "bulletListItem",
          props: {},
          content: [
            { type: "text", text: "📝 ", styles: {} },
            { type: "text", text: "Headings", styles: {} },
            { type: "text", text: " (H1, H2, H3): ", styles: {} },
            {
              type: "text",
              text: "Ctrl/Cmd + Shift + 1/2/3",
              styles: { code: true },
            },
          ],
          children: [],
        },
        {
          id: "9",
          type: "bulletListItem",
          props: {},
          content: [
            { type: "text", text: "📋 ", styles: {} },
            { type: "text", text: "Lists", styles: {} },
            { type: "text", text: " (bullet • or numbered 1.): ", styles: {} },
            {
              type: "text",
              text: "Ctrl/Cmd + Shift + 8/7",
              styles: { code: true },
            },
          ],
          children: [],
        },
        {
          id: "10",
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "🎨 See It In Action", styles: {} }],
          children: [],
        },
        {
          id: "11",
          type: "paragraph",
          props: {},
          content: [
            {
              type: "text",
              text: "Here are some examples of what you can create:",
              styles: { italic: true },
            },
          ],
          children: [],
        },
        {
          id: "12",
          type: "heading",
          props: { level: 1 },
          content: [
            { type: "text", text: "📚 Main Topic (Heading 1)", styles: {} },
          ],
          children: [],
        },
        {
          id: "13",
          type: "heading",
          props: { level: 2 },
          content: [
            { type: "text", text: "📖 Subsection (Heading 2)", styles: {} },
          ],
          children: [],
        },
        {
          id: "14",
          type: "heading",
          props: { level: 3 },
          content: [
            { type: "text", text: "📝 Details (Heading 3)", styles: {} },
          ],
          children: [],
        },
        {
          id: "15",
          type: "bulletListItem",
          props: {},
          content: [
            { type: "text", text: "✨ ", styles: {} },
            { type: "text", text: "Mix and match formatting", styles: {} },
          ],
          children: [],
        },
        {
          id: "16",
          type: "bulletListItem",
          props: {},
          content: [
            { type: "text", text: "💪 ", styles: {} },
            { type: "text", text: "Bold", styles: { bold: true } },
            { type: "text", text: " and ", styles: {} },
            { type: "text", text: "italic", styles: { italic: true } },
            { type: "text", text: " text together", styles: {} },
          ],
          children: [],
        },
        {
          id: "17",
          type: "bulletListItem",
          props: {},
          content: [
            { type: "text", text: "❌ ", styles: {} },
            { type: "text", text: "Strikethrough", styles: { strike: true } },
            { type: "text", text: " for corrections", styles: {} },
          ],
          children: [],
        },
        {
          id: "18",
          type: "numberedListItem",
          props: {},
          content: [
            { type: "text", text: "1️⃣ ", styles: {} },
            { type: "text", text: "Organize your thoughts", styles: {} },
          ],
          children: [],
        },
        {
          id: "19",
          type: "numberedListItem",
          props: {},
          content: [
            { type: "text", text: "2️⃣ ", styles: {} },
            { type: "text", text: "Create structured lists", styles: {} },
          ],
          children: [],
        },
        {
          id: "20",
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "🚀 Ready to Start?", styles: {} }],
          children: [],
        },
        {
          id: "21",
          type: "paragraph",
          props: {},
          content: [
            {
              type: "text",
              text: "You're all set! Start typing anywhere to create your own notes. Here are some cool features to explore:",
              styles: {},
            },
          ],
          children: [],
        },
        {
          id: "22",
          type: "bulletListItem",
          props: {},
          content: [
            { type: "text", text: "🖼️ ", styles: {} },
            { type: "text", text: "Drag & drop images", styles: {} },
          ],
          children: [],
        },
        {
          id: "23",
          type: "bulletListItem",
          props: {},
          content: [
            { type: "text", text: "☁️ ", styles: {} },
            { type: "text", text: "Google Drive sync", styles: {} },
          ],
          children: [],
        },
        {
          id: "24",
          type: "bulletListItem",
          props: {},
          content: [
            { type: "text", text: "🌙 ", styles: {} },
            { type: "text", text: "Dark/Light theme toggle", styles: {} },
          ],
          children: [],
        },
        {
          id: "25",
          type: "paragraph",
          props: {},
          content: [
            {
              type: "text",
              text: "Happy note-taking! 🎉",
              styles: { bold: true, italic: true },
            },
          ],
          children: [],
        },
      ]),
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
    const updatedNotes = [newNote, ...notes];

    console.log("📝 [Create Note] New note created:", {
      noteId: newNote.id,
      noteName: newNote.name,
      contentLength: newNote.content.length,
      totalNotes: updatedNotes.length,
    });

    setNotes(updatedNotes);
    setActiveNoteId(newNote.id);
    localStorage.setItem("tabula-notes", JSON.stringify(updatedNotes));

    // Auto-sync new note to Google Drive
    if (isLoggedIn && !isSyncing) {
      console.log("🔄 [Create Note] Scheduling auto-sync for new note...");
      setTimeout(() => {
        console.log("🔄 [Create Note] Executing auto-sync for new note...");
        handleCloudSync(false, true); // Silent auto-sync
      }, 1000);
    }

    toast({
      title: "New Note Created",
      description: "Ready for your thoughts!",
    });
  };

  const handleDeleteNote = (noteIdToDelete: string) => {
    const updatedNotes = notes.filter((n) => n.id !== noteIdToDelete);
    setNotes(updatedNotes);
    localStorage.setItem("tabula-notes", JSON.stringify(updatedNotes));

    if (activeNoteId === noteIdToDelete) {
      if (updatedNotes.length > 0) {
        const sortedNotes = [...updatedNotes].sort(
          (a, b) => b.lastUpdatedAt - a.lastUpdatedAt
        );
        setActiveNoteId(sortedNotes[0].id);
      } else {
        handleCreateNewNote();
      }
    }

    // Auto-sync deletion to Google Drive
    if (isLoggedIn && !isSyncing) {
      setTimeout(() => {
        handleCloudSync(false, true); // Silent auto-sync
      }, 1000);
    }

    toast({
      title: "Note Deleted",
    });
  };

  const handleRenameNote = (noteId: string, newName: string) => {
    const now = Date.now();
    const updatedNotes = notes.map((n) =>
      n.id === noteId ? { ...n, name: newName, lastUpdatedAt: now } : n
    );

    console.log("📝 [Rename] Note renamed:", {
      noteId,
      oldName: notes.find((n) => n.id === noteId)?.name,
      newName,
      lastUpdatedAt: now,
      timestamp: new Date(now).toISOString(),
    });

    setNotes(updatedNotes);
    localStorage.setItem("tabula-notes", JSON.stringify(updatedNotes));

    // Auto-sync rename to Google Drive with longer delay to ensure local changes are saved
    if (isLoggedIn && !isSyncing) {
      console.log("🔄 [Rename] Scheduling auto-sync in 5 seconds...");
      setTimeout(() => {
        console.log("🔄 [Rename] Executing auto-sync for renamed note...");
        console.log("🔄 [Rename] Current notes state before sync:", {
          notesCount: notes.length,
          renamedNote: notes.find((n) => n.id === noteId),
        });
        handleCloudSync(false, true); // Silent auto-sync
      }, 5000); // Increased delay to 5 seconds
    }

    toast({
      title: "Note Renamed Successfully",
    });
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
      await GoogleDrive.saveNotesToDrive(notesWithCurrentContent);

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
          description: "Syncing your changes...",
        });
        handleCloudSync(false, true); // Silent auto-sync
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

  if (!isClient) {
    return (
      <main className="relative min-h-screen bg-background text-foreground font-body transition-colors duration-300"></main>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <main className="relative min-h-screen bg-background text-foreground font-body transition-colors duration-300">
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
          <div className="flex-1 flex justify-end">
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
                  className="max-w-md max-h-[80vh] p-4"
                >
                  <div className="text-xs space-y-4 overflow-y-auto max-h-[calc(80vh-2rem)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
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
                        Keyboard Shortcuts
                      </div>

                      <div>
                        <div className="font-medium mb-1">Text Formatting</div>
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
                              Ctrl/Cmd + U
                            </kbd>{" "}
                            Underline
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + S
                            </kbd>{" "}
                            Strikethrough
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="font-medium mb-1">Headings</div>
                        <div className="space-y-1 text-muted-foreground">
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + 1
                            </kbd>{" "}
                            Heading 1
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + 2
                            </kbd>{" "}
                            Heading 2
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + 3
                            </kbd>{" "}
                            Heading 3
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + 0
                            </kbd>{" "}
                            Paragraph
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="font-medium mb-1">Lists</div>
                        <div className="space-y-1 text-muted-foreground">
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + 8
                            </kbd>{" "}
                            Bullet List
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + 7
                            </kbd>{" "}
                            Numbered List
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + C
                            </kbd>{" "}
                            Checklist
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="font-medium mb-1">Text Colors</div>
                        <div className="space-y-1 text-muted-foreground">
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + R
                            </kbd>{" "}
                            Red
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + G
                            </kbd>{" "}
                            Green
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + B
                            </kbd>{" "}
                            Blue
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + Y
                            </kbd>{" "}
                            Yellow
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + P
                            </kbd>{" "}
                            Purple
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + O
                            </kbd>{" "}
                            Orange
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Shift + K
                            </kbd>{" "}
                            Black (default)
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="font-medium mb-1">General</div>
                        <div className="space-y-1 text-muted-foreground">
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + S
                            </kbd>{" "}
                            Save (auto-saves)
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Z
                            </kbd>{" "}
                            Undo
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + Y
                            </kbd>{" "}
                            Redo
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + A
                            </kbd>{" "}
                            Select All
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + C
                            </kbd>{" "}
                            Copy
                          </div>
                          <div>
                            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                              Ctrl/Cmd + V
                            </kbd>{" "}
                            Paste
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-sm mb-2">Features</div>
                      <div className="text-muted-foreground space-y-1">
                        <div>• Click note title to rename</div>
                        <div>• Drag & drop images to insert</div>
                        <div>• Auto-save every 500ms</div>
                        <div>• Google Drive sync available</div>
                        <div>• AI-powered summarization</div>
                        <div>• Export notes as .txt files</div>
                        <div>• Dark/Light theme toggle</div>
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
                initialContent={convertHtmlToBlockNote(activeNote.content)}
                onChange={handleContentChange}
                autoFocus={true}
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
              lastSyncTime,
              syncError,
              isOnline,
              pendingSyncs,
              editorRef,
              setActiveNoteId,
              handleCreateNewNote,
              handleDeleteNote,
              handleExport,
              toggleTheme,
              handleCloudSync: () => handleCloudSync(true),
              handleSignOut,
              handleTestSync,
              handleSimpleTestSync,
              handleForceSync,
              handleStorageTest,
              handleDebugDriveFiles,
              handleClearDriveCache,
              handleTestDriveAPI,
              handleDebugNotesState,
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
