
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { summarizeNote } from "@/ai/flows/summarize-note";
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
import { Pencil, Info } from "@/components/icons";
import * as GoogleDrive from "@/lib/google-drive";


const LazySummaryDialog = dynamic(() => import('@/components/summary-dialog'));
const LazyToolbar = dynamic(
  () => import("@/components/toolbar").then((mod) => mod.Toolbar),
  {
    ssr: false,
    loading: () => (
      <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 h-[52px]" />
    ), // Placeholder with same height
  }
);

type Note = {
  id: string;
  name:string;
  content: string;
  createdAt: number;
  lastUpdatedAt: number;
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
    let activeNote = notes.find(n => n.id === activeNoteId);

    // If no active note, or if index is empty, create a new one
    if (!activeNoteId || notes.length === 0 || !activeNote) {
      const newNote: Note = {
        id: `note-${Date.now()}`,
        name: "My First Note",
        content: "<p>Welcome to TabulaNote!</p>",
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };
      notes = [newNote, ...notes.filter(n => n.id !== newNote.id)];
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

const GOOGLE_CLIENT_ID = '284239172338-8h05pivsirhrc2joc1d21vqgurvpeg63.apps.googleusercontent.com';

export default function Home() {
  const [isClient, setIsClient] = React.useState(false);
  
  // Use a ref to store initial state to avoid re-running getInitialState
  const initialStateRef = React.useRef(getInitialState());

  const [notes, setNotes] = React.useState<Note[]>(initialStateRef.current.notes);
  const [activeNoteId, setActiveNoteId] = React.useState<string | null>(initialStateRef.current.activeNoteId);
  const [theme, setTheme] = React.useState(initialStateRef.current.theme);
  const [characterCount, setCharacterCount] = React.useState(initialStateRef.current.characterCount);

  const [summary, setSummary] = React.useState("");
  const [isSummaryLoading, setIsSummaryLoading] = React.useState(false);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = React.useState(false);
  const [activeFormats, setActiveFormats] = React.useState<Record<string, boolean>>({});

  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState("");

  const editorRef = React.useRef<HTMLDivElement>(null);
  const renameInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [isGapiLoaded, setIsGapiLoaded] = React.useState(false);
  const [isDriveReady, setIsDriveReady] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);


  React.useEffect(() => {
    // This effect runs once on mount to set the initial client state
    setIsClient(true);
    const state = initialStateRef.current;
    
    if (editorRef.current) {
      const activeNoteContent = state.notes.find(n => n.id === state.activeNoteId)?.content || "<p><br></p>";
      editorRef.current.innerHTML = activeNoteContent;
    }
    document.documentElement.classList.toggle("dark", state.theme === "dark");

    // Initialize Google Drive API
    const initDrive = async () => {
        await GoogleDrive.loadGapi();
        setIsGapiLoaded(true);
        await GoogleDrive.initGis(GOOGLE_CLIENT_ID, (tokenResponse) => {
            // This callback handles the token response after user signs in.
            GoogleDrive.setToken(tokenResponse);
            setIsLoggedIn(true);
            setIsDriveReady(true);
            toast({ title: "Signed in to Google Drive" });
        });
    };
    initDrive();


  }, []);

  // Load note content when activeNoteId changes
  React.useEffect(() => {
    if (!isClient || !activeNoteId) return;

    const activeNote = notes.find(n => n.id === activeNoteId);
    if (editorRef.current) {
        const newContent = activeNote?.content || "<p><br></p>";
        editorRef.current.innerHTML = newContent;
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = newContent;
        setCharacterCount(tempDiv.innerText.length);
    }
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

  const checkActiveFormats = React.useCallback(() => {
    if (typeof window === "undefined" || !window.document || !editorRef.current)
      return;

    const newActiveFormats: Record<string, boolean> = {};
    newActiveFormats.bold = document.queryCommandState("bold");
    newActiveFormats.italic = document.queryCommandState("italic");
    newActiveFormats.underline = document.queryCommandState("underline");

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      let node = selection.getRangeAt(0).startContainer;
      while (node && node !== editorRef.current) {
        const nodeName = node.nodeName.toLowerCase();
        if (nodeName.match(/^h[1-3]$/)) {
          newActiveFormats[nodeName] = true;
        }
        if (nodeName === "p") {
          newActiveFormats.p = true;
        }
        node = node.parentNode as HTMLElement;
      }
    }
    setActiveFormats(newActiveFormats);
  }, []);

  // Set up event listeners for format checking
  React.useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      const handler = () => {
        checkActiveFormats();
      };
      document.addEventListener("selectionchange", handler);
      editor.addEventListener("click", handler);
      editor.addEventListener("keyup", handler);

      return () => {
        document.removeEventListener("selectionchange", handler);
        editor.removeEventListener("click", handler);
        editor.removeEventListener("keyup", handler);
      };
    }
  }, [checkActiveFormats]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (!activeNoteId) return;
    const noteContent = e.currentTarget.innerHTML;
    setCharacterCount(e.currentTarget.innerText.length);
    try {
        const updatedNotes = notes.map((n) =>
            n.id === activeNoteId ? { ...n, content: noteContent, lastUpdatedAt: Date.now() } : n
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
  };

  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
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
      const result = await summarizeNote({ note: plainText });
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
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    let parentElement =
      container.nodeType === Node.ELEMENT_NODE
        ? (container as Element)
        : container.parentElement;

    while (parentElement && parentElement !== editorRef.current) {
      if (parentElement.classList.contains("checklist-item")) {
        // ... (checklist logic remains the same)
        return;
      }
      parentElement = parentElement.parentElement;
    }
  };

  const handleCloudSync = async () => {
    if (!isGapiLoaded) {
        toast({ title: "Google API not loaded yet.", variant: "destructive" });
        return;
    }
    if (!isLoggedIn) {
        GoogleDrive.requestToken(); // This will trigger the GIS popup
    } else {
        try {
            toast({ title: "Syncing notes to Google Drive..." });
            await GoogleDrive.saveNotesToDrive(notes);
            toast({ title: "Sync successful!", description: "Your notes are saved in your Google Drive." });
        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            toast({ title: "Sync Failed", description: errorMessage, variant: "destructive" });
        }
    }
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
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
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
          className="w-full h-full min-h-screen p-16 outline-none text-lg leading-relaxed selection:bg-primary selection:text-primary-foreground"
          suppressContentEditableWarning={true}
          style={{ caretColor: "hsl(var(--ring))" }}
          aria-label="Note editor"
        />

        {isClient && <LazyToolbar
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
            handleCloudSync,
            handleSignOut,
          }}
        />}

        {isClient && <LazySummaryDialog 
            isOpen={isSummaryDialogOpen}
            onOpenChange={setIsSummaryDialogOpen}
            isLoading={isSummaryLoading}
            summary={summary}
        />}

        <Toaster />
      </main>
    </TooltipProvider>
  );
}
