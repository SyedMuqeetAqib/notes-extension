
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
  name: string;
  createdAt: number;
  lastUpdatedAt: number;
};

// This function runs on the client and tries to get the initial state
// synchronously from localStorage. This avoids a flicker or loading state.
const getInitialState = () => {
  if (typeof window === "undefined") {
    return {
      activeNoteId: null,
      initialContent: "<p><br></p>",
      notes: [],
      theme: "light",
      characterCount: 0,
    };
  }
  try {
    const theme = localStorage.getItem("tabula-theme") || "light";
    let notes: Note[] = [];
    const savedIndex = localStorage.getItem("tabula-notes-index");
    if (savedIndex) {
      notes = JSON.parse(savedIndex).map((note: any) =>
        note.lastUpdatedAt ? note : { ...note, lastUpdatedAt: note.createdAt }
      );
    }

    let activeNoteId = localStorage.getItem("tabula-last-active-note");
    let initialContent = "<p><br></p>";
    let characterCount = 0;

    if (activeNoteId) {
      const savedNote = localStorage.getItem(`tabula-note-${activeNoteId}`);
      if (savedNote) {
        initialContent = savedNote;
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = savedNote;
        characterCount = tempDiv.innerText.length;
      } else {
        // The active note content is missing, reset
        activeNoteId = null;
      }
    }

    // If no active note, or if index is empty, create a new one
    if (!activeNoteId || notes.length === 0) {
      const newNote: Note = {
        id: `note-${Date.now()}`,
        name: "My First Note",
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };
      initialContent = "<p>Welcome to TabulaNote!</p>";
      notes = [newNote];
      activeNoteId = newNote.id;
      localStorage.setItem("tabula-notes-index", JSON.stringify(notes));
      localStorage.setItem(`tabula-note-${activeNoteId}`, initialContent);
      localStorage.setItem("tabula-last-active-note", activeNoteId);
      characterCount = "Welcome to TabulaNote!".length;
    }

    return { activeNoteId, initialContent, notes, theme, characterCount };
  } catch (e) {
    console.error("Failed to initialize state from localStorage", e);
    // Return a default safe state
    const fallbackNote: Note = {
        id: "fallback",
        name: "Error Note",
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
    };
    return {
      activeNoteId: "fallback",
      initialContent: "<p>Error loading note.</p>",
      notes: [fallbackNote],
      theme: "light",
      characterCount: "Error loading note.".length,
    };
  }
};

export default function Home() {
  const [isClient, setIsClient] = React.useState(false);
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

  React.useEffect(() => {
    // This effect runs once on mount to set the initial client state
    // and ensure the editor has content.
    setIsClient(true);
    const state = getInitialState();
    setNotes(state.notes);
    setActiveNoteId(state.activeNoteId);
    setTheme(state.theme);
    setCharacterCount(state.characterCount);
    
    if (editorRef.current) {
        editorRef.current.innerHTML = state.initialContent;
    }
    document.documentElement.classList.toggle(
        "dark",
        state.theme === "dark"
    );

  }, []);

  // Load note content when activeNoteId changes (e.g., switching notes)
  React.useEffect(() => {
    // This effect should only run when activeNoteId changes, not on initial mount.
    if (!isClient || !activeNoteId) return;

    try {
      const savedNote = localStorage.getItem(`tabula-note-${activeNoteId}`);
      if (editorRef.current) {
        const newContent = savedNote || "<p><br></p>";
        editorRef.current.innerHTML = newContent;
        // Create a temporary div to accurately get innerText
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = newContent;
        setCharacterCount(tempDiv.innerText.length);
      }
      localStorage.setItem("tabula-last-active-note", activeNoteId);
    } catch (error) {
      console.error("Failed to load note:", error);
    }
  }, [activeNoteId, isClient]);
  

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
      localStorage.setItem(`tabula-note-${activeNoteId}`, noteContent);

      // Update lastUpdatedAt timestamp
      const updatedNotes = notes.map((n) =>
        n.id === activeNoteId ? { ...n, lastUpdatedAt: Date.now() } : n
      );
      setNotes(updatedNotes);
      localStorage.setItem("tabula-notes-index", JSON.stringify(updatedNotes));
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
          // Already in a checklist item, do nothing
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
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
    setActiveNoteId(newNote.id);
    localStorage.setItem("tabula-notes-index", JSON.stringify(updatedNotes));
    localStorage.setItem(`tabula-note-${newNote.id}`, "<p><br></p>");
    toast({
      title: "New Note Created",
      description: "Ready for your thoughts!",
    });
  };

  const handleDeleteNote = (noteIdToDelete: string) => {
    const updatedNotes = notes.filter((n) => n.id !== noteIdToDelete);
    setNotes(updatedNotes);
    localStorage.removeItem(`tabula-note-${noteIdToDelete}`);
    localStorage.setItem("tabula-notes-index", JSON.stringify(updatedNotes));

    if (activeNoteId === noteIdToDelete) {
      if (updatedNotes.length > 0) {
        // Switch to the most recently updated note
        const sortedNotes = [...updatedNotes].sort(
          (a, b) => b.lastUpdatedAt - a.lastUpdatedAt
        );
        setActiveNoteId(sortedNotes[0].id);
      } else {
        // This will create a new note and set it as active
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
    localStorage.setItem("tabula-notes-index", JSON.stringify(updatedNotes));
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
        const contentDiv = parentElement.querySelector(".flex-grow");
        if (event.key === "Enter") {
          event.preventDefault();
          if (
            contentDiv &&
            (contentDiv.textContent === "" ||
              contentDiv.textContent === "\u00A0" ||
              contentDiv.innerHTML === "&nbsp;")
          ) {
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            parentElement.replaceWith(p);

            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } else {
            const newChecklistItem = parentElement.cloneNode(
              true
            ) as HTMLElement;
            const checkbox = newChecklistItem.querySelector(
              'input[type="checkbox"]'
            ) as HTMLInputElement | null;
            if (checkbox) {
              checkbox.checked = false;
            }
            const newContentDiv = newChecklistItem.querySelector(
              ".flex-grow"
            ) as HTMLElement;
            if (newContentDiv) {
              newContentDiv.innerHTML = "&nbsp;";
            }

            parentElement.insertAdjacentElement("afterend", newChecklistItem);

            const newRange = document.createRange();
            const focusableDiv = newChecklistItem.querySelector(".flex-grow");
            if (focusableDiv) {
              newRange.setStart(focusableDiv, 0);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          }
          return;
        } else if (event.key === "Backspace") {
          if (
            contentDiv &&
            (contentDiv.textContent === "" ||
              contentDiv.textContent === "\u00A0" ||
              contentDiv.innerHTML === "&nbsp;") &&
            range.startOffset === 0
          ) {
            event.preventDefault();
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            parentElement.replaceWith(p);

            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }
        return;
      }
      parentElement = parentElement.parentElement;
    }
  };

  const handleCloudSync = () => {
    toast({
        title: "Coming Soon!",
        description: "Google Drive sync is not yet implemented.",
    });
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.altKey) {
          switch (event.key) {
            case "1":
              event.preventDefault();
              handleFormat("formatBlock", "<h1>");
              break;
            case "2":
              event.preventDefault();
              handleFormat("formatBlock", "<h2>");
              break;
            case "3":
              event.preventDefault();
              handleFormat("formatBlock", "<h3>");
              break;
            case "0":
              event.preventDefault();
              handleFormat("formatBlock", "<p>");
              break;
          }
        } else if (event.shiftKey) {
          switch (event.key) {
            case "C":
            case "c":
              event.preventDefault();
              handleInsertChecklist();
              break;
          }
        } else {
          switch (event.key) {
            case "b":
              event.preventDefault();
              handleFormat("bold");
              break;
            case "i":
              event.preventDefault();
              handleFormat("italic");
              break;
            case "u":
              event.preventDefault();
              handleFormat("underline");
              break;
            case "s":
              event.preventDefault();
              handleExport();
              break;
          }
        }
      }
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
            {activeNote && (
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
            {activeNote && (
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
            setActiveNoteId,
            handleCreateNewNote,
            handleDeleteNote,
            handleFormat,
            handleInsertChecklist,
            handleSummarize,
            handleExport,
            toggleTheme,
            handleCloudSync,
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
