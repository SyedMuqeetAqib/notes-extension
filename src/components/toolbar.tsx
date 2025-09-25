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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AlertDialogTrigger } from "@radix-ui/react-alert-dialog";
import {
  Download,
  FilePlus2,
  MoreVertical,
  Moon,
  Sun,
  Trash2,
  Folder,
  Cloud,
  LogOut,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Strikethrough,
  Underline,
  List,
  ListOrdered,
  ListTodo,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Database,
  Search,
  FileText,
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
  theme: string;
  isLoggedIn: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
  isOnline: boolean;
  pendingSyncs: number;
  editorRef: React.RefObject<any>;
  setActiveNoteId: (id: string) => void;
  handleCreateNewNote: () => void;
  handleDeleteNote: (id: string) => void;
  handleExport: () => void;
  toggleTheme: () => void;
  handleCloudSync: () => void;
  handleSignOut: () => void;
  handleTestSync: () => void;
  handleSimpleTestSync: () => void;
  handleForceSync: () => void;
  handleStorageTest: () => void;
  handleDebugDriveFiles: () => void;
  handleClearDriveCache: () => void;
  handleTestDriveAPI: () => void;
  handleDebugNotesState: () => void;
};

export function Toolbar({
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
  handleCloudSync,
  handleSignOut,
  handleTestSync,
  handleSimpleTestSync,
  handleForceSync,
  handleStorageTest,
  handleDebugDriveFiles,
  handleClearDriveCache,
  handleTestDriveAPI,
  handleDebugNotesState,
}: ToolbarProps) {
  // Formatting button handlers
  const handleHeading1 = () => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      editor.updateBlock(editor.getTextCursorPosition().block, {
        type: "heading",
        props: { level: 1 },
      });
      // Keep editor focused after formatting
      setTimeout(() => editor.focus(), 0);
    }
  };

  const handleHeading2 = () => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      editor.updateBlock(editor.getTextCursorPosition().block, {
        type: "heading",
        props: { level: 2 },
      });
      // Keep editor focused after formatting
      setTimeout(() => editor.focus(), 0);
    }
  };

  const handleHeading3 = () => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      editor.updateBlock(editor.getTextCursorPosition().block, {
        type: "heading",
        props: { level: 3 },
      });
      // Keep editor focused after formatting
      setTimeout(() => editor.focus(), 0);
    }
  };

  const handleParagraph = () => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      editor.updateBlock(editor.getTextCursorPosition().block, {
        type: "paragraph",
        props: {},
      });
      // Keep editor focused after formatting
      setTimeout(() => editor.focus(), 0);
    }
  };

  const handleStrikethrough = () => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      const currentStyles = editor.getActiveStyles();
      if (currentStyles.strike) {
        editor.removeStyles({ strike: true });
      } else {
        editor.addStyles({ strike: true });
      }
      // Keep editor focused after formatting
      setTimeout(() => editor.focus(), 0);
    }
  };

  const handleUnderline = () => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      const currentStyles = editor.getActiveStyles();
      if (currentStyles.underline) {
        editor.removeStyles({ underline: true });
      } else {
        editor.addStyles({ underline: true });
      }
      // Keep editor focused after formatting
      setTimeout(() => editor.focus(), 0);
    }
  };

  const handleBulletList = () => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      editor.updateBlock(editor.getTextCursorPosition().block, {
        type: "bulletListItem",
        props: {},
      });
      // Keep editor focused after formatting
      setTimeout(() => editor.focus(), 0);
    }
  };

  const handleNumberedList = () => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      editor.updateBlock(editor.getTextCursorPosition().block, {
        type: "numberedListItem",
        props: {},
      });
      // Keep editor focused after formatting
      setTimeout(() => editor.focus(), 0);
    }
  };

  const handleTodoList = () => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      editor.updateBlock(editor.getTextCursorPosition().block, {
        type: "checkListItem",
        props: {},
      });
      // Keep editor focused after formatting
      setTimeout(() => editor.focus(), 0);
    }
  };

  // Sync status helper functions
  const getSyncStatusIcon = () => {
    if (!isOnline) {
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    }
    if (isSyncing) {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }
    if (syncError) {
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
    if (pendingSyncs > 0) {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
    if (lastSyncTime) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    return <Cloud className="w-4 h-4" />;
  };

  const getSyncStatusText = () => {
    if (!isOnline) {
      return `Offline (${pendingSyncs} pending)`;
    }
    if (isSyncing) {
      return "Syncing...";
    }
    if (syncError) {
      return "Sync Error";
    }
    if (pendingSyncs > 0) {
      return `${pendingSyncs} changes pending sync`;
    }
    if (lastSyncTime) {
      const timeAgo = Math.floor((Date.now() - lastSyncTime) / 1000);
      if (timeAgo < 60) {
        return "Synced just now";
      } else if (timeAgo < 3600) {
        return `Synced ${Math.floor(timeAgo / 60)}m ago`;
      } else {
        return `Synced ${Math.floor(timeAgo / 3600)}h ago`;
      }
    }
    return isLoggedIn ? "Sync to Cloud" : "Sign in & Sync";
  };

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
              {notes
                .sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt)
                .map((note) => (
                  <DropdownMenuItem
                    key={note.id}
                    onClick={() => setActiveNoteId(note.id)}
                    className={cn(
                      "flex justify-between",
                      note.id === activeNoteId && "bg-muted"
                    )}
                  >
                    <span className="truncate pr-2">{note.name}</span>
                    <AlertDialog>
                      <AlertDialogTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-50 hover:opacity-100 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-destructive/70 hover:text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete "{note.name}"?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete this note.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(note.id);
                            }}
                            className="bg-destructive hover:bg-destructive/90"
                          >
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

        {/* Heading Buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleHeading1();
              }}
              aria-label="Heading 1"
            >
              <Heading1 className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Heading 1 (Ctrl/Cmd + Shift + 1)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleHeading2();
              }}
              aria-label="Heading 2"
            >
              <Heading2 className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Heading 2 (Ctrl/Cmd + Shift + 2)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleHeading3();
              }}
              aria-label="Heading 3"
            >
              <Heading3 className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Heading 3 (Ctrl/Cmd + Shift + 3)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleParagraph();
              }}
              aria-label="Paragraph"
            >
              <Pilcrow className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Paragraph (Ctrl/Cmd + Shift + 0)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-8 mx-1" />

        {/* Text Style Buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleStrikethrough();
              }}
              aria-label="Strikethrough"
            >
              <Strikethrough className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Strikethrough (Ctrl/Cmd + Shift + S)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleUnderline();
              }}
              aria-label="Underline"
            >
              <Underline className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Underline (Ctrl/Cmd + U)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-8 mx-1" />

        {/* List Buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBulletList();
              }}
              aria-label="Bullet List"
            >
              <List className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bullet List (Ctrl/Cmd + Shift + 8)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNumberedList();
              }}
              aria-label="Numbered List"
            >
              <ListOrdered className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Numbered List (Ctrl/Cmd + Shift + 7)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTodoList();
              }}
              aria-label="Todo List"
            >
              <ListTodo className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Todo List (Ctrl/Cmd + Shift + C)</TooltipContent>
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
            <DropdownMenuItem
              onClick={handleCloudSync}
              disabled={isSyncing || !isOnline}
              className={cn(
                "flex items-center",
                (isSyncing || !isOnline) && "opacity-50 cursor-not-allowed"
              )}
            >
              {getSyncStatusIcon()}
              <span className="ml-2">{getSyncStatusText()}</span>
            </DropdownMenuItem>
            {syncError && (
              <DropdownMenuItem
                onClick={handleCloudSync}
                disabled={isSyncing || !isOnline}
                className="flex items-center text-orange-600"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="ml-2">Retry Sync</span>
              </DropdownMenuItem>
            )}
            {isLoggedIn && (
              <>
                <DropdownMenuItem onClick={handleSimpleTestSync}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  <span>Simple Test Sync</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleTestSync}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  <span>Test Sync with Sample Data</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleForceSync}>
                  <Cloud className="w-4 h-4 mr-2" />
                  <span>Force Sync Current Notes</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleStorageTest}>
                  <Database className="w-4 h-4 mr-2" />
                  <span>Test Storage System</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDebugDriveFiles}>
                  <Search className="w-4 h-4 mr-2" />
                  <span>Debug Drive Files</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClearDriveCache}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  <span>Clear Drive Cache</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleTestDriveAPI}>
                  <Search className="w-4 h-4 mr-2" />
                  <span>Test Drive API</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDebugNotesState}>
                  <FileText className="w-4 h-4 mr-2" />
                  <span>Debug Notes State</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              <span>Export as .txt</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={toggleTheme}>
              {theme === "light" ? (
                <Moon className="w-4 h-4 mr-2" />
              ) : (
                <Sun className="w-4 h-4 mr-2" />
              )}
              <span>{theme === "light" ? "Dark" : "Light"} Mode</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
