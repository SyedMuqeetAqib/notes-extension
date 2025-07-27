
"use client";

import * as React from "react";
import {
  Bold,
  Italic,
  Underline,
  Download,
  Sparkles,
  FilePlus2,
  Loader2,
  ListTodo,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Palette,
  Pilcrow,
  MoreVertical,
  Moon,
  Sun,
  Trash2,
  FileText,
} from "lucide-react";
import { summarizeNote } from "@/ai/flows/summarize-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
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
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  name: string;
  createdAt: number;
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

  const editorRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load notes index and set active note
  React.useEffect(() => {
    try {
      const savedIndex = localStorage.getItem("tabula-notes-index");
      const savedNotes: Note[] = savedIndex ? JSON.parse(savedIndex) : [];
      setNotes(savedNotes);

      if (savedNotes.length > 0) {
        const lastActiveId = localStorage.getItem('tabula-last-active-note');
        const noteToActivate = savedNotes.find(n => n.id === lastActiveId) || savedNotes[0];
        setActiveNoteId(noteToActivate.id);
      } else {
        // Create a default note if none exist
        const newNote: Note = {
          id: `note-${Date.now()}`,
          name: "My First Note",
          createdAt: Date.now()
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
  }, []);
  
  // Load active note content when activeNoteId changes
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
    setIsLoaded(true);
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
  }, [isLoaded, checkActiveFormats]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (!activeNoteId) return;
    const noteContent = e.currentTarget.innerHTML;
     try {
        localStorage.setItem(`tabula-note-${activeNoteId}`, noteContent);
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
    const checklistHtml = `
      <div class="flex items-center my-2 checklist-item">
        <input type="checkbox" class="mr-2 w-5 h-5" />
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
      createdAt: Date.now()
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

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = notes.filter(n => n.id !== noteId);
    setNotes(updatedNotes);
    localStorage.removeItem(`tabula-note-${noteId}`);
    localStorage.setItem('tabula-notes-index', JSON.stringify(updatedNotes));
    
    if (activeNoteId === noteId) {
        if (updatedNotes.length > 0) {
            setActiveNoteId(updatedNotes[0].id);
        } else {
            handleCreateNewNote(); // Create a new one if last one was deleted
        }
    }

    toast({
      title: "Note Deleted",
    });
  }
  
  const handleRenameNote = (noteId: string, newName: string) => {
    const updatedNotes = notes.map(n => n.id === noteId ? {...n, name: newName} : n);
    setNotes(updatedNotes);
    localStorage.setItem('tabula-notes-index', JSON.stringify(updatedNotes));
    toast({
      title: "Note Renamed",
    })
  }

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

  return (
    <SidebarProvider>
    <TooltipProvider>
      <Sidebar>
        <SidebarHeader>
            <div className="flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                <h2 className="text-lg font-semibold">My Notes</h2>
            </div>
        </SidebarHeader>
        <SidebarContent>
            <SidebarMenu>
            {notes.sort((a,b) => b.createdAt - a.createdAt).map(note => (
                <SidebarMenuItem key={note.id}>
                    <SidebarMenuButton 
                        onClick={() => setActiveNoteId(note.id)}
                        isActive={note.id === activeNoteId}
                    >
                        <span>{note.name}</span>
                    </SidebarMenuButton>
                    <AlertDialog>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                    <SidebarMenuAction>
                                        <Trash2 className="text-destructive/70 hover:text-destructive"/>
                                    </SidebarMenuAction>
                                </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="right">Delete Note</TooltipContent>
                        </Tooltip>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{note.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete this note.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteNote(note.id)} className="bg-destructive hover:bg-destructive/90">
                                Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </SidebarMenuItem>
            ))}
            </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
            <Button variant="outline" onClick={handleCreateNewNote}>
                <FilePlus2 className="w-4 h-4 mr-2"/>
                New Note
            </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
      <main className="relative min-h-screen bg-background text-foreground font-body transition-colors duration-300">
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-center">
            {activeNote && (
                 <Dialog>
                    <DialogTrigger asChild>
                        <h1 className="text-lg font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                            {activeNote.name}
                        </h1>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Rename Note</DialogTitle>
                            <DialogDescription>
                                Enter a new name for your note.
                            </DialogDescription>
                        </DialogHeader>
                        <form id="rename-form" onSubmit={(e) => {
                             e.preventDefault();
                             const newName = (e.target as HTMLFormElement).noteName.value;
                             if (newName.trim()) {
                                handleRenameNote(activeNote.id, newName.trim());
                                // Close dialog manually if needed. Some dialogs do this automatically on submit.
                                const closeButton = document.querySelector('[data-radix-dialog-close]');
                                if (closeButton instanceof HTMLElement) {
                                    closeButton.click();
                                }
                             }
                        }}>
                        <Input
                            name="noteName"
                            defaultValue={activeNote.name}
                            className="mt-2"
                            autoFocus
                        />
                        </form>
                         <DialogFooter>
                            <Button type="submit" form="rename-form">Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
        
        <div className="absolute inset-0 pt-16 transition-opacity duration-500" style={{ opacity: isLoaded ? 1 : 0 }}>
          <div
            ref={editorRef}
            contentEditable={true}
            onInput={handleInput}
            onKeyDown={handleEditorKeyDown}
            className="w-full h-full min-h-screen p-8 md:p-16 lg:p-24 outline-none text-lg leading-relaxed selection:bg-primary selection:text-primary-foreground"
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

        <div className="fixed top-4 left-4 z-10 md:hidden">
            <SidebarTrigger />
        </div>

        <Card className="fixed bottom-4 right-4 md:bottom-8 md:right-8 shadow-2xl rounded-xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardContent className="p-2 flex flex-wrap items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("bold")} aria-label="Bold" className={cn(activeFormats.bold && "bg-muted")}>
                  <Bold className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bold (Ctrl+B)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("italic")} aria-label="Italic" className={cn(activeFormats.italic && "bg-muted")}>
                  <Italic className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Italic (Ctrl+I)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("underline")} aria-label="Underline" className={cn(activeFormats.underline && "bg-muted")}>
                  <Underline className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Underline (Ctrl+U)</TooltipContent>
            </Tooltip>
             <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Text Color">
                      <Palette className="w-5 h-5" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Text Color</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-auto p-2">
                <input type="color" onChange={(e) => handleFormat("foreColor", e.target.value)} className="w-8 h-8" />
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="h-8 mx-1" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("formatBlock", "<p>")} aria-label="Normal Text" className={cn(activeFormats.p && "bg-muted")}>
                  <Pilcrow className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Normal Text (Ctrl+Alt+0)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("formatBlock", "<h1>")} aria-label="Heading 1" className={cn(activeFormats.h1 && "bg-muted")}>
                  <Heading1 className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Heading 1 (Ctrl+Alt+1)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("formatBlock", "<h2>")} aria-label="Heading 2" className={cn(activeFormats.h2 && "bg-muted")}>
                  <Heading2 className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Heading 2 (Ctrl+Alt+2)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("formatBlock", "<h3>")} aria-label="Heading 3" className={cn(activeFormats.h3 && "bg-muted")}>
                  <Heading3 className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Heading 3 (Ctrl+Alt+3)</TooltipContent>
            </Tooltip>
            
            <Separator orientation="vertical" className="h-8 mx-1" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleInsertChecklist} aria-label="Insert Checklist">
                  <ListTodo className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Checklist (Ctrl+Shift+C)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("insertHorizontalRule")} aria-label="Insert Horizontal Line">
                  <Minus className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Horizontal Line</TooltipContent>
            </Tooltip>
            
            <Separator orientation="vertical" className="h-8 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleSummarize} aria-label="Summarize note with AI">
                  <Sparkles className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI Summarize</TooltipContent>
            </Tooltip>
            
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="More options">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCreateNewNote}>
                  <FilePlus2 className="w-4 h-4 mr-2" />
                  <span>New Note</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  <span>Export as .txt</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === 'light' ? <Moon className="w-4 h-4 mr-2" /> : <Sun className="w-4 h-4 mr-2" />}
                  <span>{theme === 'light' ? 'Dark' : 'Light'} Mode</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </CardContent>
        </Card>

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
      </SidebarInset>
    </TooltipProvider>
    </SidebarProvider>
  );
}
