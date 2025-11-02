import { useState, useCallback, useRef } from "react";
import { IndexedDB, type Note as IndexedDBNote } from "@/lib/indexeddb";
import { useToast } from "@/hooks/use-toast";
import type { Note } from "@/lib/google-drive";

export function useNotesManager() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isIndexedDBReady, setIsIndexedDBReady] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const { toast } = useToast();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const createNewNote = useCallback(async (): Promise<Note | null> => {
    if (!isIndexedDBReady) {
      console.log(
        "⚠️ [Create Note] IndexedDB not ready, skipping note creation"
      );
      return null;
    }

    try {
      const newNote: IndexedDBNote = {
        id: `note-${Date.now()}`,
        name: "Untitled Note",
        content: JSON.stringify([
          {
            id: "1",
            type: "paragraph",
            props: {},
            content: [
              { type: "text", text: "🎉 Welcome to ", styles: {} },
              { type: "text", text: "Tabula", styles: { bold: true } },
              { type: "text", text: "! 🎉", styles: {} },
            ],
            children: [],
          },
          {
            id: "2",
            type: "paragraph",
            props: {},
            content: [
              {
                type: "text",
                text: "Your personal note-taking companion with IndexedDB storage and image support! ✨",
                styles: {},
              },
            ],
            children: [],
          },
          {
            id: "3",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🖼️ Image Support", styles: {} }],
            children: [],
          },
          {
            id: "4",
            type: "paragraph",
            props: {},
            content: [
              {
                type: "text",
                text: "You can now paste images directly into your notes! Images are stored locally in IndexedDB and synced to Google Drive when you sync.",
                styles: {},
              },
            ],
            children: [],
          },
          {
            id: "5",
            type: "paragraph",
            props: {},
            content: [
              {
                type: "text",
                text: "Try pasting an image (Ctrl/Cmd + V) or dragging and dropping one into this note!",
                styles: { italic: true },
              },
            ],
            children: [],
          },
        ]),
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      await IndexedDB.saveNote(newNote);
      setNotes((prev) => [newNote, ...prev]);
      setActiveNoteId(newNote.id);
      localStorage.setItem("tabula-last-active-note", newNote.id);

      toast({
        title: "New Note Created",
        description: "Ready for your thoughts!",
      });

      return newNote;
    } catch (error) {
      console.error("❌ [Create Note] Failed to create note:", error);
      toast({
        variant: "destructive",
        title: "Create Failed",
        description: "Could not create a new note.",
      });
      return null;
    }
  }, [isIndexedDBReady, toast]);

  const deleteNote = useCallback(
    async (noteIdToDelete: string): Promise<void> => {
      if (!isIndexedDBReady) {
        console.log("⚠️ [Delete] IndexedDB not ready, skipping note deletion");
        return;
      }

      const isLastNote = notes.length === 1;

      try {
        await IndexedDB.deleteNote(noteIdToDelete);
        setNotes((prev) => prev.filter((n) => n.id !== noteIdToDelete));

        if (activeNoteId === noteIdToDelete) {
          const updatedNotes = notes.filter((n) => n.id !== noteIdToDelete);
          if (updatedNotes.length > 0) {
            const sortedNotes = [...updatedNotes].sort(
              (a, b) => b.lastUpdatedAt - a.lastUpdatedAt
            );
            setActiveNoteId(sortedNotes[0].id);
            localStorage.setItem("tabula-last-active-note", sortedNotes[0].id);
          } else {
            // Create new note when deleting the last one
            await createNewNote();
          }
        }

        toast({
          title: isLastNote
            ? "Note Deleted & New Note Created"
            : "Note Deleted",
          description: isLastNote
            ? "Last note removed. A new note has been created."
            : "Note removed from local storage.",
        });
      } catch (error) {
        console.error("❌ [Delete] Failed to delete note:", error);
        toast({
          variant: "destructive",
          title: "Delete Failed",
          description: "Could not delete the note from local storage.",
        });
      }
    },
    [isIndexedDBReady, notes, activeNoteId, createNewNote, toast]
  );

  const renameNote = useCallback(
    async (noteId: string, newName: string): Promise<void> => {
      if (!isIndexedDBReady) return;

      try {
        const currentNote = notes.find((n) => n.id === noteId);
        if (!currentNote) return;

        const updatedNote: IndexedDBNote = {
          ...currentNote,
          name: newName,
          lastUpdatedAt: Date.now(),
        };

        await IndexedDB.saveNote(updatedNote);
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? updatedNote : n))
        );

        toast({
          title: "Note Renamed Successfully",
          description: "Note renamed in local storage.",
        });
      } catch (error) {
        console.error("❌ [Rename] Failed to rename note:", error);
        toast({
          variant: "destructive",
          title: "Rename Failed",
          description: "Could not rename the note in local storage.",
        });
      }
    },
    [isIndexedDBReady, notes, toast]
  );

  const loadNotes = useCallback(async () => {
    try {
      await IndexedDB.initDB();
      setIsIndexedDBReady(true);

      const loadedNotes = await IndexedDB.getAllNotes();

      if (loadedNotes.length === 0) {
        const welcomeNote: IndexedDBNote = {
          id: `note-${Date.now()}`,
          name: "My First Note",
          content: JSON.stringify([
            {
              id: "1",
              type: "paragraph",
              props: {},
              content: [
                { type: "text", text: "🎉 Welcome to ", styles: {} },
                { type: "text", text: "Tabula", styles: { bold: true } },
                { type: "text", text: "! 🎉", styles: {} },
              ],
              children: [],
            },
            {
              id: "2",
              type: "paragraph",
              props: {},
              content: [
                {
                  type: "text",
                  text: "Your personal note-taking companion with IndexedDB storage and image support! ✨",
                  styles: {},
                },
              ],
              children: [],
            },
          ]),
          createdAt: Date.now(),
          lastUpdatedAt: Date.now(),
        };

        await IndexedDB.saveNote(welcomeNote);
        setNotes([welcomeNote]);
        setActiveNoteId(welcomeNote.id);
      } else {
        setNotes(loadedNotes);
        const lastActiveNoteId = localStorage.getItem(
          "tabula-last-active-note"
        );
        const activeNote =
          loadedNotes.find((n) => n.id === lastActiveNoteId) || loadedNotes[0];
        setActiveNoteId(activeNote.id);
      }

      setIsLoadingNotes(false);
    } catch (error) {
      console.error("❌ [IndexedDB] Failed to initialize:", error);
      setIsLoadingNotes(false);
      toast({
        title: "Storage Error",
        description:
          "Failed to initialize local storage. Some features may not work.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const saveNoteContent = useCallback(
    async (noteId: string, content: string) => {
      if (!noteId || !isIndexedDBReady) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const currentNote = notes.find((n) => n.id === noteId);
          if (!currentNote) return;

          const updatedNote: IndexedDBNote = {
            ...currentNote,
            content,
            lastUpdatedAt: Date.now(),
          };

          await IndexedDB.saveNote(updatedNote);
          localStorage.setItem("tabula-last-active-note", noteId);
        } catch (error) {
          console.error("❌ [Content Change] Failed to save note:", error);
          toast({
            variant: "destructive",
            title: "Save Failed",
            description: "Could not save your note to local storage.",
          });
        }
      }, 500);
    },
    [isIndexedDBReady, notes, toast]
  );

  return {
    notes,
    setNotes,
    activeNoteId,
    setActiveNoteId,
    isIndexedDBReady,
    isLoadingNotes,
    createNewNote,
    deleteNote,
    renameNote,
    loadNotes,
    saveNoteContent,
    saveTimeoutRef,
  };
}
