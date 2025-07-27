
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
} from "lucide-react";
import { summarizeNote } from "@/ai/flows/summarize-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

export default function Home() {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [summary, setSummary] = React.useState("");
  const [isSummaryLoading, setIsSummaryLoading] = React.useState(false);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = React.useState(false);
  const [activeFormats, setActiveFormats] = React.useState<Record<string, boolean>>({});

  const editorRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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

  // Load note from local storage on mount
  React.useEffect(() => {
    try {
      const savedNote = localStorage.getItem("tabula-note");
      if (editorRef.current) {
        editorRef.current.innerHTML = savedNote || "<p><br></p>";
      }
    } catch (error) {
      console.error("Failed to load note from local storage", error);
      if (editorRef.current) {
        editorRef.current.innerHTML = "<p><br></p>";
      }
    }
    setIsLoaded(true);
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
    const noteContent = e.currentTarget.innerHTML;
     try {
        localStorage.setItem("tabula-note", noteContent);
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

  const handleInsertChecklist = () => {
    const checklistHtml = `
      <div class="flex items-start my-2 checklist-item">
        <input type="checkbox" class="mt-1 mr-2 w-4 h-4" />
        <div class="flex-grow">&nbsp;</div>
      </div>
    `;
    document.execCommand("insertHTML", false, checklistHtml);
    editorRef.current?.focus();
  };

  const handleExport = React.useCallback(() => {
    if (!editorRef.current) return;
    try {
      const textContent = editorRef.current.innerText;
      const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `tabulanote-${timestamp}.txt`;
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
  }, [toast]);

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
  
  const handleConfirmNewNote = () => {
    if(editorRef.current) {
        editorRef.current.innerHTML = "<p><br></p>";
        editorRef.current.focus();
    }
    localStorage.setItem("tabula-note", "<p><br></p>");
    toast({
      title: "New Note",
      description: "Ready for your thoughts!",
    });
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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleExport]);

  return (
    <TooltipProvider>
      <main className="relative min-h-screen bg-background text-foreground font-body transition-colors duration-300">
        <div className="absolute inset-0 transition-opacity duration-500" style={{ opacity: isLoaded ? 1 : 0 }}>
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

        <Card className="fixed bottom-4 right-4 md:bottom-8 md:right-8 shadow-2xl rounded-xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardContent className="p-2 flex items-center flex-wrap gap-1">
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

            <Separator orientation="vertical" className="h-6 mx-1" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("formatBlock", "<p>")} aria-label="Normal Text" className={cn(activeFormats.p && "bg-muted")}>
                  <Pilcrow className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Normal Text</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("formatBlock", "<h1>")} aria-label="Heading 1" className={cn(activeFormats.h1 && "bg-muted")}>
                  <Heading1 className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Heading 1</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("formatBlock", "<h2>")} aria-label="Heading 2" className={cn(activeFormats.h2 && "bg-muted")}>
                  <Heading2 className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Heading 2</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("formatBlock", "<h3>")} aria-label="Heading 3" className={cn(activeFormats.h3 && "bg-muted")}>
                  <Heading3 className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Heading 3</TooltipContent>
            </Tooltip>
            
            <Separator orientation="vertical" className="h-6 mx-1" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleInsertChecklist} aria-label="Insert Checklist">
                  <ListTodo className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Checklist</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleFormat("insertHorizontalRule")} aria-label="Insert Horizontal Line">
                  <Minus className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Horizontal Line</TooltipContent>
            </Tooltip>
            
            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleExport} aria-label="Export note">
                  <Download className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export as .txt (Ctrl+S)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleSummarize} aria-label="Summarize note with AI">
                  <Sparkles className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI Summarize</TooltipContent>
            </Tooltip>
            
            <Separator orientation="vertical" className="h-6 mx-1" />

            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Create new note">
                            <FilePlus2 className="w-5 h-5" />
                        </Button>
                    </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>New Note</TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start a New Note?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear the current editor. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmNewNote} className="bg-primary hover:bg-primary/90">
                    Create New Note
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
    </TooltipProvider>
  );
}
