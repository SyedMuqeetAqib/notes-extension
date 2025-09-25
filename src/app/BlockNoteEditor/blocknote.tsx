import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { lightDefaultTheme, darkDefaultTheme } from "@blocknote/mantine";
import type { Block } from "@blocknote/core";

interface BlockNoteEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  autoFocus?: boolean;
  theme?: "light" | "dark";
}

export interface BlockNoteEditorRef {
  focus: () => void;
  getEditor: () => any;
}

const BlockNoteEditor = forwardRef<BlockNoteEditorRef, BlockNoteEditorProps>(
  (
    { initialContent = "", onChange, autoFocus = true, theme = "light" },
    ref
  ) => {
    const editor = useCreateBlockNote({
      onUploadStart: (file: File) => {
        console.log("Upload started:", file);
      },
      onUploadEnd: (file: File) => {
        console.log("Upload ended:", file);
      },
      initialContent: initialContent ? JSON.parse(initialContent) : undefined,
      uploadFile: async (file: File) => {
        // Option 1: object URL (fast, but must be revoked later if you care about memory leaks)
        return URL.createObjectURL(file);

        // Option 2: base64 string (self-contained, but larger in memory)
        // return new Promise<string>((resolve) => {
        //   const reader = new FileReader();
        //   reader.onloadend = () => resolve(reader.result as string);
        //   reader.readAsDataURL(file);
        // });
      },
      // Enable paste handling for images
      pasteHandler: ({ event, editor, defaultPasteHandler }) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf("image") !== -1) {
              const file = item.getAsFile();
              if (file) {
                // Let BlockNote handle the image upload using our uploadFile function
                if (editor.uploadFile) {
                  editor.uploadFile(file).then((url) => {
                    editor.insertBlocks(
                      [
                        {
                          type: "image",
                          props: {
                            url: url,
                          },
                        },
                      ],
                      editor.getTextCursorPosition().block,
                      "after"
                    );
                  });
                }
                return true; // Indicate that we handled this paste event
              }
            }
          }
        }
        // For all other content, use the default paste handler
        return defaultPasteHandler();
      },
    });

    const isInitialized = useRef(false);
    const hasFocused = useRef(false);

    // Keyboard shortcuts handler
    useEffect(() => {
      if (!editor) return;

      const handleKeyDown = (event: KeyboardEvent) => {
        // Only handle shortcuts when editor is focused
        if (!editor.isFocused()) return;

        const { key, ctrlKey, metaKey, shiftKey } = event;
        const isModifierPressed = ctrlKey || metaKey;

        // Heading shortcuts
        if (isModifierPressed && shiftKey) {
          switch (key) {
            case "1":
              event.preventDefault();
              editor.updateBlock(editor.getTextCursorPosition().block, {
                type: "heading",
                props: { level: 1 },
              });
              break;
            case "2":
              event.preventDefault();
              editor.updateBlock(editor.getTextCursorPosition().block, {
                type: "heading",
                props: { level: 2 },
              });
              break;
            case "3":
              event.preventDefault();
              editor.updateBlock(editor.getTextCursorPosition().block, {
                type: "heading",
                props: { level: 3 },
              });
              break;
          }
        }

        // Paragraph shortcut (Ctrl/Cmd + Shift + 0)
        if (isModifierPressed && shiftKey && key === "0") {
          event.preventDefault();
          editor.updateBlock(editor.getTextCursorPosition().block, {
            type: "paragraph",
            props: {},
          });
        }

        // List shortcuts
        if (isModifierPressed && shiftKey) {
          switch (key) {
            case "8": // Ctrl/Cmd + Shift + 8 for bullet list
              event.preventDefault();
              editor.updateBlock(editor.getTextCursorPosition().block, {
                type: "bulletListItem",
                props: {},
              });
              break;
            case "7": // Ctrl/Cmd + Shift + 7 for numbered list
              event.preventDefault();
              editor.updateBlock(editor.getTextCursorPosition().block, {
                type: "numberedListItem",
                props: {},
              });
              break;
          }
        }

        // Checklist shortcut (Ctrl/Cmd + Shift + C)
        if (isModifierPressed && shiftKey && key === "C") {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          editor.updateBlock(editor.getTextCursorPosition().block, {
            type: "checkListItem",
            props: {},
          });
          return false;
        }

        // Strikethrough shortcut (Ctrl/Cmd + Shift + S)
        if (isModifierPressed && shiftKey && key === "S") {
          event.preventDefault();
          const currentStyles = editor.getActiveStyles();

          if (currentStyles.strike) {
            editor.removeStyles({ strike: true });
          } else {
            editor.addStyles({ strike: true });
          }
        }

        // Text color shortcuts
        if (isModifierPressed && shiftKey) {
          switch (key) {
            case "R": // Red
              event.preventDefault();
              editor.addStyles({ textColor: "red" });
              break;
            case "G": // Green
              event.preventDefault();
              editor.addStyles({ textColor: "green" });
              break;
            case "B": // Blue
              event.preventDefault();
              editor.addStyles({ textColor: "blue" });
              break;
            case "Y": // Yellow
              event.preventDefault();
              editor.addStyles({ textColor: "yellow" });
              break;
            case "P": // Purple
              event.preventDefault();
              editor.addStyles({ textColor: "purple" });
              break;
            case "O": // Orange
              event.preventDefault();
              editor.addStyles({ textColor: "orange" });
              break;
            case "K": // Black (default)
              event.preventDefault();
              editor.removeStyles({ textColor: "default" });
              break;
          }
        }
      };

      // Add event listener to the editor's DOM element
      const editorElement = editor._tiptapEditor.view.dom;
      editorElement.addEventListener("keydown", handleKeyDown);

      return () => {
        editorElement.removeEventListener("keydown", handleKeyDown);
      };
    }, [editor]);

    // Expose focus method and editor instance to parent component
    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          if (editor) {
            try {
              editor.focus();
              // Position cursor at the start of the first block
              const firstBlock = editor.document[0];
              if (firstBlock) {
                editor.setTextCursorPosition(firstBlock, "start");
              }
            } catch (error) {
              console.error("Failed to focus editor:", error);
            }
          }
        },
        getEditor: () => editor,
      }),
      [editor]
    );

    // Auto-focus the editor when it's ready
    useEffect(() => {
      if (!editor || !autoFocus) return;

      const focusEditor = () => {
        try {
          // Focus the editor and position cursor at the beginning
          editor.focus();

          // Position cursor at the start of the first block
          const firstBlock = editor.document[0];
          if (firstBlock) {
            editor.setTextCursorPosition(firstBlock, "start");
          }

          hasFocused.current = true;
        } catch (error) {
          console.error("Failed to focus editor:", error);
        }
      };

      // Use a small delay to ensure the editor is fully rendered
      const timeoutId = setTimeout(focusEditor, 100);

      return () => clearTimeout(timeoutId);
    }, [editor, autoFocus]);

    // Handle content changes
    useEffect(() => {
      if (!editor || !onChange) return;

      const handleChange = () => {
        try {
          const blocks = editor.document;
          const content = JSON.stringify(blocks);
          onChange(content);
        } catch (error) {
          console.error("Failed to serialize editor content:", error);
        }
      };

      editor.onChange(handleChange);

      // Cleanup function to remove the listener
      return () => {
        // Note: BlockNote doesn't provide a direct way to remove onChange listeners
        // This is handled internally by the editor lifecycle
      };
    }, [editor, onChange]);

    // Update editor content when initialContent changes
    useEffect(() => {
      if (!editor || !initialContent) return;

      try {
        const blocks = JSON.parse(initialContent);
        if (Array.isArray(blocks) && blocks.length > 0) {
          // Only update if content is different to avoid infinite loops
          const currentContent = JSON.stringify(editor.document);
          if (currentContent !== initialContent) {
            editor.replaceBlocks(editor.document, blocks);

            // Focus the editor after content update (when switching notes)
            if (autoFocus && isInitialized.current) {
              setTimeout(() => {
                try {
                  editor.focus();
                  const firstBlock = editor.document[0];
                  if (firstBlock) {
                    editor.setTextCursorPosition(firstBlock, "start");
                  }
                } catch (error) {
                  console.error(
                    "Failed to focus editor after content update:",
                    error
                  );
                }
              }, 50);
            }
          }
          isInitialized.current = true;
        }
      } catch (error) {
        console.error("Failed to parse initial content:", error);
      }
    }, [editor, initialContent, autoFocus]);

    // Create a transparent theme based on the current theme
    const baseTheme = theme === "dark" ? darkDefaultTheme : lightDefaultTheme;
    const transparentTheme = {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        editor: {
          ...baseTheme.colors.editor,
          background: "transparent",
        },
      },
    };

    return (
      <BlockNoteView
        editor={editor}
        className="h-full w-full bg-transparent"
        theme={transparentTheme}
      />
    );
  }
);

BlockNoteEditor.displayName = "BlockNoteEditor";

export default BlockNoteEditor;
