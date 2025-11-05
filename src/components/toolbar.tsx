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
  User,
  LogIn,
  Upload,
  Bold,
  Italic,
  ChevronDown,
  ChevronUp,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
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
  isFullSyncing: boolean;
  lastSyncTime: number | null;
  lastFullSyncTime: number | null;
  syncError: string | null;
  isOnline: boolean;
  pendingSyncs: number;
  editorRef: React.RefObject<any>;
  setActiveNoteId: (id: string) => void;
  handleCreateNewNote: () => void;
  handleDeleteNote: (id: string) => Promise<void>;
  handleExport: () => void;
  toggleTheme: () => void;
  handleSignIn: () => void;
  handleCloudSync: () => void;
  handleSignOut: () => void;
};

export const Toolbar = React.memo(function Toolbar({
  notes,
  activeNoteId,
  theme,
  isLoggedIn,
  isSyncing,
  isFullSyncing,
  lastSyncTime,
  lastFullSyncTime,
  syncError,
  isOnline,
  pendingSyncs,
  editorRef,
  setActiveNoteId,
  handleCreateNewNote,
  handleDeleteNote,
  handleExport,
  toggleTheme,
  handleSignIn,
  handleCloudSync,
  handleSignOut,
}: ToolbarProps) {
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [isFadingOut, setIsFadingOut] = React.useState(false);
  const minimizeButtonRef = React.useRef<HTMLButtonElement>(null);
  const [minimizeButtonPosition, setMinimizeButtonPosition] = React.useState<{
    top: number;
    right: number;
  } | null>(null);
  const savedCursorPositionRef = React.useRef<any>(null);

  const handleMinimize = React.useCallback(() => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      // Save cursor position using BlockNote API
      try {
        const textCursorPosition = editor.getTextCursorPosition();
        if (textCursorPosition && textCursorPosition.block) {
          // Save block ID and try to determine if we're at start or end
          const block = textCursorPosition.block;
          const blockText = block.content?.[0]?.text || "";
          savedCursorPositionRef.current = {
            blockId: block.id,
            blockText: blockText,
          };
        }
      } catch (error) {
        // If we can't get cursor position, try to save block position
        try {
          const block = editor.getTextCursorPosition().block;
          savedCursorPositionRef.current = { blockId: block.id };
        } catch (e) {
          // Ignore if we can't save position
        }
      }
    }

    // Save minimize button position relative to viewport
    if (minimizeButtonRef.current) {
      const rect = minimizeButtonRef.current.getBoundingClientRect();
      // Calculate exact position from viewport edges with pixel-perfect rounding
      const rightDistance = Math.round(window.innerWidth - rect.right - 15);
      const bottomDistance = Math.round(window.innerHeight - rect.bottom);
      setMinimizeButtonPosition({
        top: bottomDistance,
        right: rightDistance,
      });
    }

    // Start fade-out animation
    setIsFadingOut(true);
    // After animation completes, set minimized state
    setTimeout(() => {
      setIsMinimized(true);
      setIsFadingOut(false);
    }, 150); // Match animation duration
  }, [editorRef]);

  const handleMaximize = React.useCallback(() => {
    setIsMinimized(false);

    // Restore cursor position after a brief delay to ensure editor is ready
    setTimeout(() => {
      const editor = editorRef.current?.getEditor();
      if (editor && savedCursorPositionRef.current) {
        try {
          // Try to restore cursor position using BlockNote API
          if (savedCursorPositionRef.current.blockId) {
            const blocks = editor.getAllBlocks();
            const savedBlock = blocks.find(
              (b: any) => b.id === savedCursorPositionRef.current.blockId
            );
            if (savedBlock) {
              // Try to match by block text to find the correct block if content changed
              const matchingBlock = savedCursorPositionRef.current.blockText
                ? blocks.find(
                    (b: any) =>
                      b.id === savedBlock.id ||
                      (b.content?.[0]?.text ===
                        savedCursorPositionRef.current.blockText &&
                        b.type === savedBlock.type)
                  )
                : savedBlock;

              if (matchingBlock) {
                // Set cursor position at the end of the block
                editor.setTextCursorPosition(matchingBlock, "end");
                // Focus the editor to restore interaction
                setTimeout(() => {
                  editor.focus();
                }, 50);
              } else {
                // Fallback: focus at the saved block
                editor.setTextCursorPosition(savedBlock, "end");
                setTimeout(() => {
                  editor.focus();
                }, 50);
              }
            } else {
              // If block not found, just focus the editor
              editor.focus();
            }
          } else {
            // No saved position, just focus the editor
            editor.focus();
          }
        } catch (error) {
          // If restoration fails, just focus the editor
          try {
            editor.focus();
          } catch (e) {
            // Ignore
          }
        }
      }
    }, 150);
  }, [editorRef]);
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

  const handleBold = () => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      const currentStyles = editor.getActiveStyles();
      if (currentStyles.bold) {
        editor.removeStyles({ bold: true });
      } else {
        editor.addStyles({ bold: true });
      }
      setTimeout(() => editor.focus(), 0);
    }
  };

  const handleItalic = () => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      const currentStyles = editor.getActiveStyles();
      if (currentStyles.italic) {
        editor.removeStyles({ italic: true });
      } else {
        editor.addStyles({ italic: true });
      }
      setTimeout(() => editor.focus(), 0);
    }
  };

  const handleTextColor = (color: string) => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      if (color === "default") {
        editor.removeStyles({ textColor: "default" });
      } else {
        editor.addStyles({ textColor: color });
      }
      setTimeout(() => editor.focus(), 0);
    }
  };

  const handleAlign = (alignment: "left" | "center" | "right") => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      // Note: BlockNote alignment might need specific block props
      const block = editor.getTextCursorPosition().block;
      editor.updateBlock(block, {
        props: { ...block.props, textAlignment: alignment },
      });
      setTimeout(() => editor.focus(), 0);
    }
  };

  // Sync status helper functions (memoized)
  const getSyncStatusIcon = React.useCallback(() => {
    if (!isLoggedIn) {
      return <LogIn className="w-4 h-4 text-blue-500" />;
    }
    if (!isOnline) {
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    }
    if (isFullSyncing) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    }
    if (isSyncing) {
      return <Upload className="w-4 h-4 text-blue-500" />;
    }
    if (syncError) {
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
    if (pendingSyncs > 0) {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
    if (lastFullSyncTime) {
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const timeSinceLastSync = Date.now() - lastFullSyncTime;
      if (timeSinceLastSync > TWENTY_FOUR_HOURS) {
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      }
      // Show user profile with green border for signed-in users
      return (
        <div className="relative">
          <User className="w-4 h-4 text-green-500" />
          <div className="absolute -inset-1 rounded-full border-2 border-green-500 opacity-75"></div>
        </div>
      );
    }
    return <Cloud className="w-4 h-4" />;
  }, [
    isLoggedIn,
    isOnline,
    isFullSyncing,
    isSyncing,
    syncError,
    pendingSyncs,
    lastFullSyncTime,
  ]);

  const getSyncStatusText = React.useCallback(() => {
    if (!isLoggedIn) {
      return "Sign in to sync";
    }
    if (!isOnline) {
      return "Offline";
    }
    if (isFullSyncing) {
      return "Syncing...";
    }
    if (isSyncing) {
      return "Uploading...";
    }
    if (syncError) {
      return "Sync Error";
    }
    if (pendingSyncs > 0) {
      return "Pending sync";
    }

    // Simplified status text for better performance
    return `Last sync: ${
      lastFullSyncTime
        ? new Date(lastFullSyncTime).toLocaleDateString()
        : "Never"
    }`;
  }, [
    isLoggedIn,
    isOnline,
    isFullSyncing,
    isSyncing,
    syncError,
    pendingSyncs,
    lastFullSyncTime,
    lastSyncTime,
  ]);

  // Get active styles for button states - using useMemo for reactivity
  const activeStyles = React.useMemo(() => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      try {
        return editor.getActiveStyles();
      } catch (error) {
        return {};
      }
    }
    return {};
  }, [editorRef]);

  // Floating maximize button when minimized
  if (isMinimized && minimizeButtonPosition) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200 shadow-2xl rounded-xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-200 cursor-pointer"
        onClick={handleMaximize}
        style={{
          position: "fixed",
          bottom: `${minimizeButtonPosition.top}px`,
          right: `${minimizeButtonPosition.right}px`,
        }}
      >
        <ChevronUp className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Card
      className={cn(
        "fixed bottom-4 right-4 md:bottom-8 md:right-8 shadow-2xl rounded-xl z-10 bg-[rgba(242,242,233,0.75)] dark:bg-[rgba(36,36,36,0.95)] backdrop-blur-md border-[#E0E0D0]/50 dark:border-[#3a3a3a]/70 border-[1.5px] transition-opacity duration-150",
        isFadingOut
          ? "opacity-0"
          : "opacity-100 animate-in fade-in slide-in-from-bottom-4 duration-200"
      )}
    >
      <CardContent className="p-3">
        {/* Main toolbar with grouped sections */}
        <div className="flex flex-wrap items-start gap-1">
          {/* Heading Group - 4 connected buttons */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              Heading
            </label>
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200 rounded-r-none border-r-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleHeading1();
                    }}
                  >
                    <Heading1 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Heading 1 (Ctrl/Cmd + Shift + 1)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200 rounded-none border-x-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleHeading2();
                    }}
                  >
                    <Heading2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Heading 2 (Ctrl/Cmd + Shift + 2)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200 rounded-none border-x-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleHeading3();
                    }}
                  >
                    <Heading3 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Heading 3 (Ctrl/Cmd + Shift + 3)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200 rounded-l-none border-l-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleParagraph();
                    }}
                  >
                    <Pilcrow className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Paragraph (Ctrl/Cmd + Shift + 0)
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Format Group - 3 connected buttons */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              Format
            </label>
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200 rounded-r-none border-r-0",
                      activeStyles.bold && "bg-[#D8D8C8] dark:bg-[#3a3a3a]"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleBold();
                    }}
                  >
                    <Bold className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bold (Ctrl/Cmd + B)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200 rounded-none border-x-0",
                      activeStyles.italic && "bg-[#D8D8C8] dark:bg-[#3a3a3a]"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleItalic();
                    }}
                  >
                    <Italic className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Italic (Ctrl/Cmd + I)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200 rounded-l-none border-l-0",
                      activeStyles.underline && "bg-[#D8D8C8] dark:bg-[#3a3a3a]"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUnderline();
                    }}
                  >
                    <Underline className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Underline (Ctrl/Cmd + U)</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Color Group */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              Color
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-12 justify-center bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200 relative"
                >
                  <Type className="w-4 h-4" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-red-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleTextColor("default")}>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-gray-300 bg-black" />
                    <span>Default</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTextColor("red")}>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-gray-300 bg-red-500" />
                    <span>Red</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTextColor("blue")}>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-gray-300 bg-blue-500" />
                    <span>Blue</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTextColor("green")}>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-gray-300 bg-green-500" />
                    <span>Green</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTextColor("yellow")}>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-gray-300 bg-yellow-500" />
                    <span>Yellow</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTextColor("purple")}>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-gray-300 bg-purple-500" />
                    <span>Purple</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Align Group - Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              Align
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 justify-between bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200"
                >
                  <AlignLeft className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAlign("left");
                  }}
                >
                  <AlignLeft className="w-4 h-4 mr-2" />
                  <span>Left align</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAlign("center");
                  }}
                >
                  <AlignCenter className="w-4 h-4 mr-2" />
                  <span>Center align</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAlign("right");
                  }}
                >
                  <AlignRight className="w-4 h-4 mr-2" />
                  <span>Right align</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* List Group - 3 connected buttons */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              List
            </label>
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200 rounded-r-none border-r-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleBulletList();
                    }}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Bullet List (Ctrl/Cmd + Shift + 8)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200 rounded-none border-x-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleTodoList();
                    }}
                  >
                    <ListTodo className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Checkbox List</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200 rounded-l-none border-l-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNumberedList();
                    }}
                  >
                    <ListOrdered className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Numbered List (Ctrl/Cmd + Shift + 7)
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Miscellaneous Buttons - Strikethrough (unlabeled) */}
          <div className="flex flex-col gap-1">
            <div className="h-4"></div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200",
                    activeStyles.strike && "bg-[#D8D8C8] dark:bg-[#3a3a3a]"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleStrikethrough();
                  }}
                >
                  <Strikethrough className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Strikethrough (Ctrl/Cmd + Shift + S)
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center my-auto">
            <Separator orientation="vertical" className="h-[50px] mx-4" />
          </div>

          {/* Notes and More Menu */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              More options
            </label>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200"
                      >
                        <Folder className="w-4 h-4" />
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
                          disabled={isFullSyncing}
                          className={cn(
                            "flex justify-between",
                            note.id === activeNoteId && "bg-muted",
                            isFullSyncing && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span className="truncate pr-2">{note.name}</span>
                          <AlertDialog>
                            <AlertDialogTrigger
                              asChild
                              onClick={(e) => e.stopPropagation()}
                              disabled={isFullSyncing}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-50 hover:opacity-100 flex-shrink-0"
                                disabled={isFullSyncing}
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
                                  This action cannot be undone. This will
                                  permanently delete this note.
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
                  <DropdownMenuItem
                    onClick={handleCreateNewNote}
                    disabled={isFullSyncing}
                    className={cn(
                      isFullSyncing && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <FilePlus2 className="w-4 h-4 mr-2" />
                    <span>New Note</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>More</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  {isLoggedIn && (
                    <>
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="w-4 h-4 mr-2" />
                        <span>Sign Out</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
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
            </div>
          </div>

          {/* Minimize Button */}
          <div className="flex flex-col gap-1">
            <div className="h-4"></div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  ref={minimizeButtonRef}
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-[#F0F0E0] dark:bg-[#2a2a2a] border-[#D0D0C0] dark:border-[#3a3a3a] hover:bg-[#E8E8D8] dark:hover:bg-[#333333] hover:text-gray-800 dark:hover:text-gray-200 text-gray-900 dark:text-gray-200"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMinimize();
                  }}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Minimize Toolbar</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
