
"use client";

import * as React from "react";
import dynamic from 'next/dynamic';
import { format } from "date-fns";
import { summarizeNote } from "@/ai/flows/summarize-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// --- SVG Icons ---
const Bold = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 12a4 4 0 0 0 0-8H6v8"/><path d="M15 20a4 4 0 0 0 0-8H6v8Z"/></svg>
);
const Italic = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
);
const Underline = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg>
);
const Download = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
);
const Sparkles = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
);
const FilePlus2 = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><path d="M14 2v6h6"/><path d="M3 15h6"/><path d="M6 12v6"/></svg>
);
const Loader2 = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
const ListTodo = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="6" height="6" rx="1" /><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>
);
const Heading1 = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/></svg>
);
const Heading2 = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>
);
const Heading3 = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5-1 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1 4 .5 4-1.5a2 2 0 0 0-2-2"/></svg>
);
const Minus = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
);
const Palette = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.47-1.125-.29-.289-.68-.47-1.128-.47H10.5c-.83 0-1.5-.67-1.5-1.5v-1c0-.83.67-1.5 1.5-1.5H16c.83 0 1.5-.67 1.5-1.5v-1c0-.83.67-1.5 1.5-1.5H21c.83 0 1.5-.67 1.5-1.5a2 2 0 0 0-2-2h-1.5c-.83 0-1.5.67-1.5 1.5v1c0 .83-.67 1.5-1.5 1.5h-2.5a1.5 1.5 0 0 1-1.5-1.5V6.25C13.55 3.97 12.87 2 12 2z"/></svg>
);
const Pilcrow = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></svg>
);
const MoreVertical = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
);
const Moon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
);
const Sun = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
);
const Trash2 = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
);
const Folder = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L8.6 3.3a2 2 0 0 0-1.7-.9H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
);
const Pencil = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
);
const Info = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
);

const LazyToolbar = dynamic(() => import('@/components/toolbar').then(mod => mod.Toolbar), {
  ssr: false,
  loading: () => <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 h-[52px]" />, // Placeholder with same height
});

type Note = {
  id: string;
  name: string;
  createdAt: number;
  lastUpdatedAt: number;
};

export default function Home() {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [summary, setSummary] = React.useState("");
  const [isSummaryLoading, setIsSummaryLoading] = React.useState(false);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = React.useState(false);
  const [activeFormats, setActiveFormats] = React.useState<Record<string, boolean>>({});
  const [theme, setTheme] = React.useState('light');
  
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = React.useState<string | null>(null);

  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState("");
  const [isInfoTooltipOpen, setIsInfoTooltipOpen] = React.useState(false);

  const editorRef = React.useRef<HTMLDivElement>(null);
  const renameInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Primary data load: Get the active note on screen ASAP
  React.useEffect(() => {
    try {
        const lastActiveId = localStorage.getItem('tabula-last-active-note');
        if (lastActiveId) {
            const savedNote = localStorage.getItem(`tabula-note-${lastActiveId}`);
            if (editorRef.current) {
                editorRef.current.innerHTML = savedNote || "<p><br></p>";
            }
            setActiveNoteId(lastActiveId);
        } else {
             // This is the first launch, create a default note
            const newNote: Note = {
                id: `note-${Date.now()}`,
                name: "My First Note",
                createdAt: Date.now(),
                lastUpdatedAt: Date.now(),
            };
            setNotes([newNote]);
            setActiveNoteId(newNote.id);
            if (editorRef.current) {
               editorRef.current.innerHTML = "<p>Welcome to TabulaNote!</p>";
            }
            localStorage.setItem("tabula-notes-index", JSON.stringify([newNote]));
            localStorage.setItem(`tabula-note-${newNote.id}`, "<p>Welcome to TabulaNote!</p>");
            localStorage.setItem("tabula-last-active-note", newNote.id);
        }
    } catch(e) {
        console.error("Failed to load active note", e);
    }
    // We can show the editor now, even if notes index is not ready
    setIsLoaded(true);
  }, []);

  // Secondary data load: Load the notes index for the dropdown menu
  React.useEffect(() => {
    try {
      const savedIndex = localStorage.getItem("tabula-notes-index");
      let savedNotes: Note[] = savedIndex ? JSON.parse(savedIndex) : [];
      
      // Backwards compatibility for notes without lastUpdatedAt
      savedNotes = savedNotes.map(note => note.lastUpdatedAt ? note : { ...note, lastUpdatedAt: note.createdAt });
      
      setNotes(savedNotes);

      // If there's an active note ID but no notes, something is wrong.
      // Let's create a new note to recover.
      if (activeNoteId && savedNotes.length === 0) {
        const newNote: Note = {
          id: `note-${Date.now()}`,
          name: "My First Note",
          createdAt: Date.now(),
          lastUpdatedAt: Date.now(),
        };
        setNotes([newNote]);
        setActiveNoteId(newNote.id);
        localStorage.setItem("tabula-notes-index", JSON.stringify([newNote]));
        localStorage.setItem(`tabula-note-${newNote.id}`, "<p>Welcome to TabulaNote!</p>");
        localStorage.setItem("tabula-last-active-note", newNote.id);
      }

    } catch (error) {
      console.error("Failed to load notes index", error);
    }
  }, [activeNoteId]);
  
  // Load active note content when activeNoteId changes (e.g., switching notes)
  React.useEffect(() => {
    if (!activeNoteId) return;
    try {
      const savedNote = localStorage.getItem(`tabula-note-${activeNoteId}`);
      if (editorRef.current) {
        editorRef.current.innerHTML = savedNote || "<p><br></p>";
      }
      localStorage.setItem("tabula-last-active-note", activeNoteId);
    } catch (error) {
      console.error("Failed to load note:", error);
    }
  }, [activeNoteId]);
  
  // Theme management
  React.useEffect(() => {
    const storedTheme = localStorage.getItem("tabula-theme") || 'light';
    setTheme(storedTheme);
    document.documentElement.classList.toggle("dark", storedTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("tabula-theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
     toast({
      title: `Switched to ${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} Mode`,
    });
  };

  const checkActiveFormats = React.useCallback(() => {
    if (typeof window === 'undefined' || !window.document || !editorRef.current) return;

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
        if (nodeName === 'p') {
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
    if (editor && isLoaded) {
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
  }, [isLoaded, checkActiveFormats]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (!activeNoteId) return;
    const noteContent = e.currentTarget.innerHTML;
     try {
        localStorage.setItem(`tabula-note-${activeNoteId}`, noteContent);
        
        // Update lastUpdatedAt timestamp
        const updatedNotes = notes.map(n => 
            n.id === activeNoteId ? {...n, lastUpdatedAt: Date.now()} : n
        );
        setNotes(updatedNotes);
        localStorage.setItem('tabula-notes-index', JSON.stringify(updatedNotes));

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
            if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains('checklist-item')) {
                // Already in a checklist item, do nothing
                return;
            }
            node = node.parentNode;
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
      const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const activeNoteName = notes.find(n => n.id === activeNoteId)?.name || 'note';
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `${activeNoteName.replace(/\s/g, '_')}-${timestamp}.txt`;
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
    // Prevent dropdown from closing
    const updatedNotes = notes.filter(n => n.id !== noteIdToDelete);
    setNotes(updatedNotes);
    localStorage.removeItem(`tabula-note-${noteIdToDelete}`);
    localStorage.setItem('tabula-notes-index', JSON.stringify(updatedNotes));
    
    if (activeNoteId === noteIdToDelete) {
        if (updatedNotes.length > 0) {
            setActiveNoteId(updatedNotes[0].id);
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
    const updatedNotes = notes.map(n => n.id === noteId ? {...n, name: newName, lastUpdatedAt: Date.now()} : n);
    setNotes(updatedNotes);
    localStorage.setItem('tabula-notes-index', JSON.stringify(updatedNotes));
    toast({
      title: "Note Renamed",
    })
  }

  const handleStartRename = () => {
    if(activeNote) {
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
    let parentElement = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement;

    while(parentElement && parentElement !== editorRef.current) {
      if (parentElement.classList.contains('checklist-item')) {
        const contentDiv = parentElement.querySelector('.flex-grow');
        if (event.key === 'Enter') {
          event.preventDefault();
          if (contentDiv && (contentDiv.textContent === '' || contentDiv.textContent === '\u00A0' || contentDiv.innerHTML === '&nbsp;')) {
             const p = document.createElement('p');
             p.innerHTML = '<br>';
             parentElement.replaceWith(p);
             
             const newRange = document.createRange();
             newRange.setStart(p, 0);
             newRange.collapse(true);
             selection.removeAllRanges();
             selection.addRange(newRange);
          } else {
            const newChecklistItem = parentElement.cloneNode(true) as HTMLElement;
            const checkbox = newChecklistItem.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
            if (checkbox) {
              checkbox.checked = false;
            }
            const newContentDiv = newChecklistItem.querySelector('.flex-grow') as HTMLElement;
            if(newContentDiv) {
              newContentDiv.innerHTML = '&nbsp;';
            }

            parentElement.insertAdjacentElement('afterend', newChecklistItem);
            
            const newRange = document.createRange();
            const focusableDiv = newChecklistItem.querySelector('.flex-grow');
            if(focusableDiv) {
              newRange.setStart(focusableDiv, 0);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          }
          return;
        } else if (event.key === 'Backspace') {
          if (contentDiv && (contentDiv.textContent === '' || contentDiv.textContent === '\u00A0' || contentDiv.innerHTML === '&nbsp;') && range.startOffset === 0) {
            event.preventDefault();
            const p = document.createElement('p');
            p.innerHTML = '<br>';
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
  
  const activeNote = notes.find(n => n.id === activeNoteId);
  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a");
  };

  return (
    <TooltipProvider>
      <main className="relative min-h-screen bg-background text-foreground font-body transition-colors duration-300">
         <div className="absolute inset-0 transition-opacity duration-500" style={{ opacity: isLoaded ? 1 : 0 }}>
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
                           onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
                           className="w-auto h-8 text-lg font-semibold text-center bg-transparent border-primary"
                           style={{ width: `${(renameValue.length * 10) + 40}px`, minWidth: '100px' }}
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
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <Info className="w-4 h-4" />
                       </Button>
                     </TooltipTrigger>
                     <TooltipContent side="bottom" align="end">
                       <div className="text-xs text-muted-foreground flex flex-col gap-1">
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
                className="w-full h-full min-h-screen pt-16 p-8 md:p-16 lg:p-24 outline-none text-lg leading-relaxed selection:bg-primary selection:text-primary-foreground"
                suppressContentEditableWarning={true}
                style={{ caretColor: "hsl(var(--ring))" }}
                aria-label="Note editor"
              />
        </div>
        
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {isLoaded && <LazyToolbar {...{
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
        }} />}

        <Dialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                AI Summary
              </DialogTitle>
              <DialogDescription>
                Here's a summary of your note, generated by AI.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 min-h-[10rem] flex items-center justify-center">
              {isSummaryLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Generating summary...</span>
                </div>
              ) : (
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{summary}</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setIsSummaryDialogOpen(false)} variant="secondary">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Toaster />
      </main>
    </TooltipProvider>
  );
}
