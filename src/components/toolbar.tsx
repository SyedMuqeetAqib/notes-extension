
"use client";

import * as React from "react";
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
} from "@/components/ui/dropdown-menu";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

type Note = {
    id: string;
    name: string;
    createdAt: number;
    lastUpdatedAt: number;
  };
  
  type ToolbarProps = {
    notes: Note[];
    activeNoteId: string | null;
    activeFormats: Record<string, boolean>;
    theme: string;
    setActiveNoteId: (id: string) => void;
    handleCreateNewNote: () => void;
    handleDeleteNote: (id: string) => void;
    handleFormat: (command: string, value?: string) => void;
    handleInsertChecklist: () => void;
    handleSummarize: () => void;
    handleExport: () => void;
    toggleTheme: () => void;
  };

export function Toolbar({
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
}: ToolbarProps) {
    return (
        <Card className="fixed bottom-4 right-4 md:bottom-8 md:right-8 shadow-2xl rounded-xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardContent className="p-2 flex flex-wrap items-center gap-1">
            <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="My Notes">
                    <Folder className="w-5 h-5" />
                    </Button>
                </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>My Notes</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Notes</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    {notes.sort((a,b) => b.lastUpdatedAt - a.lastUpdatedAt).map(note => (
                        <DropdownMenuItem 
                            key={note.id} 
                            onClick={() => setActiveNoteId(note.id)}
                            className={cn("flex justify-between", note.id === activeNoteId && "bg-muted")}
                        >
                            <span className="truncate pr-2">{note.name}</span>
                            <AlertDialog>
                                <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100 flex-shrink-0"><Trash2 className="w-4 h-4 text-destructive/70 hover:text-destructive" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete "{note.name}"?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete this note.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }} className="bg-destructive hover:bg-destructive/90">
                                        Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCreateNewNote}>
                <FilePlus2 className="w-4 h-4 mr-2" />
                <span>New Note</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="h-8 mx-1" />

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
    );
}
