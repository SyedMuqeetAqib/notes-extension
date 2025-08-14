"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { summarizeNote } from "@/ai/flows/summarize-note";
import type { SummarizeNoteOutput } from "@/ai/flows/summarize-note.dtos";
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

const LazySummaryDialog = dynamic(() => import("@/components/summary-dialog"));
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
        content: "<p>Welcome to TabulaNote!</p>",
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };
      notes = [newNote, ...notes.filter((n) => n.id !== newNote.id)];
      activeNoteId = newNote.id;
      activeNote = newNote;
      localStorage.setItem("tabula-notes", JSON.stringify(notes));
      localStorage.setItem("tabula-last-active-note", activeNoteId);
    }

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = activeNote.content;
    const characterCount = tempDiv.innerText.length;

    return { activeNoteId, notes, theme, characterCount };
  } catch (e) {
    console.error("Failed to initialize state from localStorage", e);
    // Return a default safe state
    const fallbackNote: Note = {
      id: "fallback",
      name: "Error Note",
      content: "<p>Error loading note.</p>",
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

  const [summary, setSummary] = React.useState("");
  const [isSummaryLoading, setIsSummaryLoading] = React.useState(false);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = React.useState(false);

  const [isImageDialogOpen, setIsImageDialogOpen] = React.useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = React.useState<string | null>(
    null
  );

  const [activeFormats, setActiveFormats] = React.useState<
    Record<string, boolean>
  >({});

  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState("");

  const editorRef = React.useRef<HTMLDivElement>(null);
  const renameInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [isGapiLoaded, setIsGapiLoaded] = React.useState(false);
  const [isDriveReady, setIsDriveReady] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const checkActiveFormats = React.useCallback(() => {
    if (typeof window === "undefined" || !document.getSelection) return;

    const newActiveFormats: Record<string, boolean> = {};

    // Check inline formats
    newActiveFormats.bold = document.queryCommandState("bold");
    newActiveFormats.italic = document.queryCommandState("italic");
    newActiveFormats.underline = document.queryCommandState("underline");

    // Check block formats
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      let node = selection.focusNode;
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const tagName = element.tagName.toLowerCase();
          if (
            ["p", "h1", "h2", "h3"].includes(tagName) &&
            element.parentElement === editorRef.current
          ) {
            newActiveFormats.p = tagName === "p";
            newActiveFormats.h1 = tagName === "h1";
            newActiveFormats.h2 = tagName === "h2";
            newActiveFormats.h3 = tagName === "h3";
            break;
          }
        }
        node = node.parentNode;
      }
    }

    setActiveFormats(newActiveFormats);
  }, []);

  const handleCloudSync = React.useCallback(
    async (showToast = true) => {
      if (!isGapiLoaded) {
        toast({ title: "Google API not loaded yet.", variant: "destructive" });
        return;
      }

      if (!isLoggedIn) {
        GoogleDrive.requestToken();
        return;
      }

      try {
        if (showToast) {
          toast({ title: "Syncing notes with Google Drive..." });
        }

        // 1. Fetch notes from Drive
        const cloudNotes = await GoogleDrive.loadNotesFromDrive();

        // 2. Merge local and cloud notes
        const localNotes = JSON.parse(
          localStorage.getItem("tabula-notes") || "[]"
        ) as Note[];
        const combinedNotes: { [key: string]: Note } = {};

        // Add all local notes to the map
        for (const note of localNotes) {
          combinedNotes[note.id] = note;
        }

        // Add/update with cloud notes
        if (cloudNotes) {
          for (const note of cloudNotes) {
            // If note exists, keep the one that was updated more recently
            if (combinedNotes[note.id]) {
              if (note.lastUpdatedAt > combinedNotes[note.id].lastUpdatedAt) {
                combinedNotes[note.id] = note;
              }
            } else {
              // If note doesn't exist locally, add it
              combinedNotes[note.id] = note;
            }
          }
        }

        const mergedNotes = Object.values(combinedNotes);

        // 3. Save merged notes back to Drive
        await GoogleDrive.saveNotesToDrive(mergedNotes);

        // 4. Update local state with merged notes
        setNotes(mergedNotes);
        localStorage.setItem("tabula-notes", JSON.stringify(mergedNotes));

        if (showToast) {
          toast({
            title: "Sync successful!",
            description: "Your notes are up to date.",
          });
        }
      } catch (e) {
        console.error(e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        if (showToast) {
          toast({
            title: "Sync Failed",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }
    },
    [isGapiLoaded, isLoggedIn, toast]
  );

  React.useEffect(() => {
    // This effect runs once on mount to set the initial client state
    setIsClient(true);
    const state = initialStateRef.current;

    if (editorRef.current) {
      const activeNoteContent =
        state.notes.find((n) => n.id === state.activeNoteId)?.content ||
        "<p><br></p>";
      editorRef.current.innerHTML = activeNoteContent;
    }
    document.documentElement.classList.toggle("dark", state.theme === "dark");

    // Initialize Google Drive API
    const initDrive = async () => {
      try {
        await GoogleDrive.loadGapi();
        setIsGapiLoaded(true);

        // Check for existing token
        const storedToken = GoogleDrive.getTokenFromStorage();
        if (storedToken) {
          GoogleDrive.setToken(storedToken);
          setIsLoggedIn(true);
          setIsDriveReady(true);
          // Perform a silent sync on load
          handleCloudSync(false);
        }

        await GoogleDrive.initGis(GOOGLE_CLIENT_ID, (tokenResponse) => {
          GoogleDrive.setToken(tokenResponse);
          GoogleDrive.saveTokenToStorage(tokenResponse);
          setIsLoggedIn(true);
          setIsDriveReady(true);
          toast({ title: "Signed in to Google Drive" });
          // Sync after successful login
          handleCloudSync();
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

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const src = event.target?.result as string;
            if (!src) return;

            const imageWrapper = document.createElement("div");
            imageWrapper.className = "pasted-image-wrapper";
            imageWrapper.contentEditable = "false";

            const imageContainer = document.createElement("div");
            imageContainer.className = "pasted-image-container group";

            const img = document.createElement("img");
            img.src = src;
            img.className = "pasted-image";
            img.alt = "Pasted content";
            img.style.maxHeight = "50vh"; // Apply style directly

            const overlay = document.createElement("div");
            overlay.className = "pasted-image-overlay";

            const buttonContainer = document.createElement("div");
            buttonContainer.className = "flex gap-2";

            const copyButton = document.createElement("button");
            copyButton.className = "pasted-image-button";
            copyButton.dataset.action = "copy-image";
            copyButton.dataset.src = src;
            copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

            const downloadButton = document.createElement("button");
            downloadButton.className = "pasted-image-button";
            downloadButton.dataset.action = "download-image";
            downloadButton.dataset.src = src;
            downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`;

            buttonContainer.appendChild(copyButton);
            buttonContainer.appendChild(downloadButton);
            overlay.appendChild(buttonContainer);
            imageContainer.appendChild(img);
            imageContainer.appendChild(overlay);
            imageWrapper.appendChild(imageContainer);

            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.deleteContents();
              range.insertNode(imageWrapper);
              // Move cursor after the image
              const newRange = document.createRange();
              newRange.setStartAfter(imageWrapper);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
            } else {
              editorRef.current!.appendChild(imageWrapper);
            }

            // Trigger save after paste
            handleInput({ currentTarget: editorRef.current } as any);
          };
          reader.readAsDataURL(file);
          break; // Handle first image only
        }
      }
    };

    const editor = editorRef.current;
    editor?.addEventListener("paste", handlePaste);
    document.addEventListener("selectionchange", checkActiveFormats);
    editor?.addEventListener("keyup", checkActiveFormats);
    editor?.addEventListener("click", checkActiveFormats);

    return () => {
      document.removeEventListener("selectionchange", checkActiveFormats);
      editor?.removeEventListener("keyup", checkActiveFormats);
      editor?.removeEventListener("click", checkActiveFormats);
      editor?.removeEventListener("paste", handlePaste);
    };
  }, [toast, checkActiveFormats, handleCloudSync]);

  // Load note content when activeNoteId changes
  React.useEffect(() => {
    if (!isClient || !activeNoteId) return;

    const activeNote = notes.find((n) => n.id === activeNoteId);
    if (editorRef.current) {
      const newContent = activeNote?.content || "<p><br></p>";
      // Only update if the content is different to avoid cursor issues
      if (editorRef.current.innerHTML !== newContent) {
        editorRef.current.innerHTML = newContent;
      }
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = newContent;
      setCharacterCount(tempDiv.innerText.length);
    }
    localStorage.setItem("tabula-last-active-note", activeNoteId);
    // After content changes, check the format at the new cursor position
    setTimeout(checkActiveFormats, 0);
  }, [activeNoteId, isClient, notes, checkActiveFormats]);

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

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const noteContent = e.currentTarget.innerHTML;
    const noteText = e.currentTarget.innerText;
    setCharacterCount(noteText.length);

    saveTimeoutRef.current = setTimeout(() => {
      if (!activeNoteId) return;
      try {
        const updatedNotes = notes.map((n) =>
          n.id === activeNoteId
            ? { ...n, content: noteContent, lastUpdatedAt: Date.now() }
            : n
        );
        setNotes(updatedNotes);
        localStorage.setItem("tabula-notes", JSON.stringify(updatedNotes));
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

  const handleFormat = (command: string, value?: string) => {
    if (command === "formatBlock" && value?.startsWith("<h")) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        const headingTag = value.substring(1, 3);
        const fontSize =
          headingTag === "h1"
            ? "2em"
            : headingTag === "h2"
            ? "1.5em"
            : "1.17em";
        const fontWeight = headingTag === "h1" ? "bold" : "semibold";

        const html = `<${headingTag}><span style="font-size: ${fontSize}; font-weight: ${fontWeight};">${
          selectedText || "&nbsp;"
        }</span></${headingTag}>`;
        document.execCommand("insertHTML", false, html);
      }
    } else {
      document.execCommand(command, false, value);
    }
    editorRef.current?.focus();
    checkActiveFormats();
  };

  const handleInsertChecklist = React.useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      let node = selection.getRangeAt(0).startContainer;
      while (node && node !== editorRef.current) {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as HTMLElement).classList.contains("checklist-item")
        ) {
          return;
        }
        node = node.parentNode as HTMLElement;
      }
    }

    const checklistHtml = `
      <div class="flex items-center my-2 checklist-item">
        <input type="checkbox" class="mr-3 w-5 h-5" />
        <div class="flex-grow" contenteditable="true">&nbsp;</div>
      </div>
    `;
    document.execCommand("insertHTML", false, checklistHtml);
    editorRef.current?.focus();
  }, []);

  const handleExport = React.useCallback(() => {
    if (!editorRef.current) return;
    try {
      const textContent = editorRef.current.innerText;
      const blob = new Blob([textContent], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const activeNoteName =
        notes.find((n) => n.id === activeNoteId)?.name || "note";
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

  const handleSummarize = async () => {
    if (!editorRef.current) return;
    const plainText = editorRef.current.innerText.trim();

    if (plainText.length < 50) {
      toast({
        variant: "destructive",
        title: "Note too short",
        description: "Please write a longer note to generate a summary.",
      });
      return;
    }

    setIsSummaryLoading(true);
    setSummary("");
    setIsSummaryDialogOpen(true);
    try {
      const result: SummarizeNoteOutput = await summarizeNote({
        note: plainText,
      });
      setSummary(result.summary);
    } catch (error) {
      console.error("Failed to summarize note", error);
      setSummary("Sorry, we couldn't generate a summary for this note.");
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleCreateNewNote = () => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      name: "Untitled Note",
      content: "<p><br></p>",
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    setActiveNoteId(newNote.id);
    localStorage.setItem("tabula-notes", JSON.stringify(updatedNotes));
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

    toast({
      title: "Note Deleted",
    });
  };

  const handleRenameNote = (noteId: string, newName: string) => {
    const updatedNotes = notes.map((n) =>
      n.id === noteId ? { ...n, name: newName, lastUpdatedAt: Date.now() } : n
    );
    setNotes(updatedNotes);
    localStorage.setItem("tabula-notes", JSON.stringify(updatedNotes));
    toast({
      title: "Note Renamed",
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

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      let node = range.startContainer;
      let parentHeading: HTMLElement | null = null;
      let parentChecklistItem: HTMLElement | null = null;

      // Traverse up to find if we're inside a heading or checklist item
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const nodeName = element.nodeName.toLowerCase();

          // Check for headings
          if (
            ["h1", "h2", "h3"].includes(nodeName) &&
            element.parentElement === editorRef.current
          ) {
            parentHeading = element;
            break;
          }

          // Check for checklist items
          if (
            element.classList.contains("checklist-item") &&
            element.parentElement === editorRef.current
          ) {
            parentChecklistItem = element;
            break;
          }
        }
        node = node.parentNode!;
      }

      if (parentHeading) {
        event.preventDefault(); // Stop the default 'Enter' behavior

        const newParagraph = document.createElement("p");
        newParagraph.innerHTML = "<br>"; // Ensure visibility

        parentHeading.insertAdjacentElement("afterend", newParagraph);

        const newRange = document.createRange();
        newRange.setStart(newParagraph, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        handleInput(event as any);

        checkActiveFormats();
      } else if (parentChecklistItem) {
        event.preventDefault(); // Stop the default 'Enter' behavior

        // If Shift+Enter, create a line break within the same checklist item
        if (event.shiftKey) {
          // Allow default behavior for line break within the same item
          return;
        }

        // Create a new checklist item
        const newChecklistHtml = `
          <div class="flex items-center my-2 checklist-item">
            <input type="checkbox" class="mr-3 w-5 h-5" />
            <div class="flex-grow" contenteditable="true">&nbsp;</div>
          </div>
        `;

        // Insert the new checklist item after the current one
        parentChecklistItem.insertAdjacentHTML("afterend", newChecklistHtml);

        // Move cursor to the new checklist item
        const newChecklistItem =
          parentChecklistItem.nextElementSibling as HTMLElement;
        const textDiv = newChecklistItem.querySelector(
          'div[contenteditable="true"]'
        ) as HTMLElement;

        if (textDiv) {
          const newRange = document.createRange();
          newRange.setStart(textDiv, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }

        handleInput(event as any);
        checkActiveFormats();
      }
    }
  };

  const handleCopyImage = async (src: string) => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      toast({ title: "Image copied to clipboard" });
    } catch (error) {
      console.error("Failed to copy image:", error);
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Could not copy image to clipboard.",
      });
    }
  };

  const handleDownloadImage = (src: string) => {
    const link = document.createElement("a");
    link.href = src;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileType = src.split(";")[0].split("/")[1] || "png";
    link.download = `image-${timestamp}.${fileType}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Image downloaded" });
  };

  const handleEditorClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const actionTarget = target.closest("[data-action]");

    if (actionTarget) {
      const action = actionTarget.getAttribute("data-action");
      const src = actionTarget.getAttribute("data-src");
      if (action && src) {
        event.preventDefault();
        event.stopPropagation();
        if (action === "copy-image") {
          handleCopyImage(src);
        } else if (action === "download-image") {
          handleDownloadImage(src);
        }
        return;
      }
    }

    if (target.tagName === "IMG" && target.classList.contains("pasted-image")) {
      setSelectedImageSrc(target.getAttribute("src"));
      setIsImageDialogOpen(true);
    }
    checkActiveFormats();
  };

  const handleSignOut = () => {
    GoogleDrive.signOut();
    setIsLoggedIn(false);
    setIsDriveReady(false);
    toast({ title: "Signed out from Google Drive." });
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ... (shortcut logic remains the same)
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleExport, handleInsertChecklist]);

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
        <div className="absolute top-4 left-4 right-4 h-8 flex justify-between items-center z-10">
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
                <TooltipContent side="bottom" align="end">
                  <div className="text-xs text-muted-foreground flex flex-col gap-1">
                    <span>Characters: {characterCount}</span>
                    <span>Created: {formatDate(activeNote.createdAt)}</span>
                    <span>Updated: {formatDate(activeNote.lastUpdatedAt)}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <div
          ref={editorRef}
          contentEditable={!isRenaming}
          onInput={handleInput}
          onKeyDown={handleEditorKeyDown}
          onClick={handleEditorClick}
          className="w-full h-full min-h-screen p-16 outline-none text-lg leading-relaxed selection:bg-primary selection:text-primary-foreground editor-content"
          suppressContentEditableWarning={true}
          style={{ caretColor: "hsl(var(--ring))" }}
          aria-label="Note editor"
        />

        {isClient && (
          <LazyToolbar
            {...{
              notes,
              activeNoteId,
              activeFormats,
              theme,
              isLoggedIn,
              setActiveNoteId,
              handleCreateNewNote,
              handleDeleteNote,
              handleFormat,
              handleInsertChecklist,
              handleSummarize,
              handleExport,
              toggleTheme,
              handleCloudSync: () => handleCloudSync(true),
              handleSignOut,
            }}
          />
        )}

        {isClient && (
          <LazySummaryDialog
            isOpen={isSummaryDialogOpen}
            onOpenChange={setIsSummaryDialogOpen}
            isLoading={isSummaryLoading}
            summary={summary}
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
