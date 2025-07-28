
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
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AlertDialogTrigger } from "@radix-ui/react-alert-dialog";
import {
    Bold, Italic, Underline, Download, Sparkles, FilePlus2, ListTodo,
    Heading1, Heading2, Heading3, Minus, Palette, Pilcrow, MoreVertical,
    Moon, Sun, Trash2, Folder, Cloud, LogOut
} from "@/components/icons";

type Note = {
    id: string;
    name: string;
    content: string;
    createdAt: number;
    lastUpdatedAt: number;
  };
  
  type ToolbarProps = {
    notes: Note[];
    activeNoteId: string | null;
    activeFormats: Record<string, boolean>;
    theme: string;
    isLoggedIn: boolean;
    setActiveNoteId: (id: string) => void;
    handleCreateNewNote: () => void;
    handleDeleteNote: (id: string) => void;
    handleFormat: (command: string, value?: string) => void;
    handleInsertChecklist: () => void;
    handleSummarize: () => void;
    handleExport: () => void;
    toggleTheme: () => void;
    handleCloudSync: () => void;
    handleSignOut: () => void;
  };

export function Toolbar({
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
                <DropdownMenuItem onClick={handleCloudSync}>
                    <Cloud className="w-4 h-4 mr-2" />
                    <span>{isLoggedIn ? 'Sync to Cloud' : 'Sign in & Sync'}</span>
                </DropdownMenuItem>
                {isLoggedIn && (
                    <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="w-4 h-4 mr-2" />
                        <span>Sign Out</span>
                    </DropdownMenuItem>
                )}
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
