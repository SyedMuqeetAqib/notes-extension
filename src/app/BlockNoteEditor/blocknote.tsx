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
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { ImageStorage } from "../../lib/image-storage";

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
    // Track image URLs for cleanup
    const imageUrlMapRef = useRef<{ [hash: string]: string }>({});

    // Create custom schema without video, file, and audio blocks
    const { video, file, audio, ...remainingBlockSpecs } = defaultBlockSpecs;
    const schema = BlockNoteSchema.create({
      blockSpecs: {
        ...remainingBlockSpecs,
      },
    });

    const editor = useCreateBlockNote({
      schema, // Use the custom schema
      onUploadStart: (file: File) => {
        console.log(
          "🖼️ [BlockNote] Upload started:",
          file.name,
          file.type,
          file.size
        );
      },
      onUploadEnd: (file: File) => {
        console.log("✅ [BlockNote] Upload ended:", file.name);
      },
      // Don't set initialContent here - we'll handle it in useEffect
      initialContent: undefined,
      uploadFile: async (file: File) => {
        try {
          console.log("🖼️ [BlockNote] Storing image in IndexedDB:", file.name);

          // Store image in IndexedDB and get hash reference
          const imageHash = await ImageStorage.storeImageBlob(file);

          // Return hash reference for BlockNote
          const hashUrl = `indexeddb://${imageHash}`;
          console.log("🔗 [BlockNote] Created hash reference:", hashUrl);

          return hashUrl;
        } catch (error) {
          console.error("❌ [BlockNote] Failed to store image:", error);
          // Fallback to Object URL if IndexedDB fails
          return URL.createObjectURL(file);
        }
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

    // Add direct paste event listener to handle images
    useEffect(() => {
      if (!editor) return;

      const handlePaste = async (event: ClipboardEvent) => {
        console.log("🔄 [BlockNote] Direct paste event triggered:", {
          clipboardData: !!event.clipboardData,
          items: event.clipboardData?.items?.length || 0,
        });

        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log("📋 [BlockNote] Clipboard item:", {
              type: item.type,
              kind: item.kind,
            });

            if (item.type.indexOf("image") !== -1) {
              console.log("🖼️ [BlockNote] Image detected in clipboard");
              const file = item.getAsFile();
              if (file) {
                console.log("📁 [BlockNote] File extracted:", {
                  name: file.name,
                  type: file.type,
                  size: file.size,
                });

                // Prevent default paste behavior
                event.preventDefault();

                // Use BlockNote's uploadFile function
                if (editor.uploadFile) {
                  console.log("⬆️ [BlockNote] Starting image upload...");
                  try {
                    const url = await editor.uploadFile(file);
                    console.log(
                      "✅ [BlockNote] Image uploaded successfully:",
                      url
                    );

                    // Convert the hash URL to an Object URL for immediate display
                    const hash = (url as string).replace("indexeddb://", "");
                    const displayUrl = await ImageStorage.getImageUrl(hash);

                    // Insert the image block at the current cursor position
                    const currentBlock = editor.getTextCursorPosition().block;
                    if (currentBlock) {
                      editor.insertBlocks(
                        [
                          {
                            type: "image",
                            props: {
                              url: displayUrl,
                            },
                          },
                        ],
                        currentBlock,
                        "after"
                      );
                    } else {
                      // Fallback: insert at the end of the document
                      editor.insertBlocks(
                        [
                          {
                            type: "image",
                            props: {
                              url: displayUrl,
                            },
                          },
                        ],
                        editor.document[editor.document.length - 1],
                        "after"
                      );
                    }
                    console.log(
                      "📝 [BlockNote] Image block inserted with display URL"
                    );
                  } catch (error) {
                    console.error("❌ [BlockNote] Image upload failed:", error);
                  }
                } else {
                  console.error(
                    "❌ [BlockNote] editor.uploadFile is not available"
                  );
                }
                return;
              } else {
                console.error(
                  "❌ [BlockNote] Could not extract file from clipboard item"
                );
              }
            }
          }
        } else {
          console.log("ℹ️ [BlockNote] No clipboard items found");
        }
      };

      // Add event listener to the editor's DOM element
      const editorElement = editor._tiptapEditor.view.dom;
      editorElement.addEventListener("paste", handlePaste);

      return () => {
        editorElement.removeEventListener("paste", handlePaste);
      };
    }, [editor]);

    // Handle content changes
    useEffect(() => {
      if (!editor || !onChange) return;

      const handleChange = async () => {
        try {
          const blocks = editor.document;
          let content = JSON.stringify(blocks);

          // Convert Object URLs back to hash references before saving
          console.log("🔄 [BlockNote] Processing content change:", {
            contentLength: content.length,
            hasObjectUrls: content.includes('"blob:'),
            hasHashRefs: content.includes('"indexeddb://'),
          });

          const originalContent = content;
          content = await ImageStorage.replaceUrlsWithRefs(content);

          if (originalContent !== content) {
            console.log(
              "✅ [BlockNote] Converted Object URLs to hash references"
            );
          }

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

    // Update editor content when initialContent changes (with image resolution)
    useEffect(() => {
      if (!editor || !initialContent) return;

      const updateEditorContent = async () => {
        try {
          console.log("🔄 [BlockNote] Updating editor content:", {
            contentLength: initialContent.length,
            hasImages: initialContent.includes('"type":"image"'),
          });

          // Wait a bit to ensure editor is fully initialized
          await new Promise((resolve) => setTimeout(resolve, 100));

          // First, check if content has image references that need resolution
          const imageRefs = ImageStorage.extractImageRefs(initialContent);

          let contentToUse = initialContent;

          if (imageRefs.length > 0) {
            console.log("🖼️ [BlockNote] Resolving images:", imageRefs);

            // Load and create Object URLs for all images
            const urlMap: { [hash: string]: string } = {};
            for (const hash of imageRefs) {
              try {
                const url = await ImageStorage.getImageUrl(hash);
                urlMap[hash] = url;
                console.log(`✅ [BlockNote] Resolved image ${hash} -> ${url}`);
              } catch (error) {
                console.error(
                  `❌ [BlockNote] Failed to resolve image ${hash}:`,
                  error
                );
              }
            }

            // Store for cleanup
            imageUrlMapRef.current = urlMap;

            // Replace hash references with Object URLs in content
            contentToUse = await ImageStorage.replaceRefsWithUrls(
              initialContent
            );
            console.log("✅ [BlockNote] Images resolved, content updated");
          }

          // Parse and update editor content
          const blocks = JSON.parse(contentToUse);
          if (Array.isArray(blocks) && blocks.length > 0) {
            // Only update if content is different to avoid infinite loops
            const currentContent = JSON.stringify(editor.document);
            if (currentContent !== contentToUse) {
              console.log("🔄 [BlockNote] Replacing editor blocks...");
              editor.replaceBlocks(editor.document, blocks);
              console.log("✅ [BlockNote] Editor content updated");

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
            } else {
              console.log("ℹ️ [BlockNote] Content unchanged, skipping update");
            }
            isInitialized.current = true;
          }
        } catch (error) {
          console.error(
            "❌ [BlockNote] Failed to update editor content:",
            error
          );
        }
      };

      updateEditorContent();
    }, [editor, initialContent, autoFocus]);

    // Cleanup image URLs on unmount
    useEffect(() => {
      return () => {
        // Revoke all Object URLs when component unmounts
        const urls = Object.values(imageUrlMapRef.current);
        ImageStorage.revokeImageUrls(urls);
        imageUrlMapRef.current = {};
        console.log("🧹 [BlockNote] Cleaned up image URLs");
      };
    }, []);

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
