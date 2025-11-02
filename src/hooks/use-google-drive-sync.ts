import { useState, useCallback, useRef } from "react";
import * as GoogleDrive from "@/lib/google-drive";
import { useToast } from "@/hooks/use-toast";
import type { Note } from "@/lib/google-drive";

type SyncStatus = "syncing" | "complete" | "error";

interface SyncProgressItem {
  noteId: string;
  noteName: string;
  status: SyncStatus;
}

export function useGoogleDriveSync(
  isGapiLoaded: boolean,
  isLoggedIn: boolean,
  isOnline: boolean,
  notes: Note[],
  saveCurrentEditorContent: () => Note[]
) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFullSyncing, setIsFullSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [lastFullSyncTime, setLastFullSyncTime] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState<SyncProgressItem[]>([]);
  const { toast } = useToast();
  const maxRetries = 3;

  const handleCloudSync = useCallback(
    async (
      showToast = true,
      isAutoSync = false,
      uploadOnly = false
    ): Promise<void> => {
      if (!isGapiLoaded || !isLoggedIn || !isOnline || isSyncing) {
        if (showToast && !isLoggedIn) {
          toast({
            title: "Please sign in first",
            description: "Sign in to Google Drive to sync your notes.",
            variant: "destructive",
          });
        }
        if (!isOnline) {
          setPendingSyncs((prev) => prev + 1);
        }
        return;
      }

      setIsSyncing(true);
      setSyncError(null);

      const notesWithCurrentContent = saveCurrentEditorContent();

      if (!uploadOnly) {
        setIsFullSyncing(true);
        const initialProgress = notesWithCurrentContent.map((note) => ({
          noteId: note.id,
          noteName: note.name,
          status: "syncing" as SyncStatus,
        }));
        setSyncProgress(initialProgress);
      }

      try {
        if (showToast && !isAutoSync) {
          toast({
            title: uploadOnly
              ? "Uploading changes..."
              : "Syncing notes with Google Drive...",
          });
        }

        if (uploadOnly) {
          await GoogleDrive.uploadNotesToDrive(notesWithCurrentContent);

          if (showToast && !isAutoSync) {
            toast({
              title: "Upload successful!",
              description: "Your changes have been saved to Google Drive.",
            });
          }
        } else {
          const onProgress = (
            noteId: string,
            noteName: string,
            status: SyncStatus
          ) => {
            setSyncProgress((prev) => {
              const existingIndex = prev.findIndex(
                (item) => item.noteId === noteId
              );
              if (existingIndex >= 0) {
                return prev.map((item, index) =>
                  index === existingIndex ? { ...item, noteName, status } : item
                );
              }
              return [...prev, { noteId, noteName, status }];
            });
          };

          const syncResult = await GoogleDrive.simpleSync(onProgress);
          setNotes(syncResult.notes);

          const fullSyncTime = Date.now();
          setLastFullSyncTime(fullSyncTime);
          localStorage.setItem(
            "tabula-last-full-sync",
            fullSyncTime.toString()
          );

          setTimeout(() => {
            setIsFullSyncing(false);
            setSyncProgress([]);
            if (showToast && !isAutoSync) {
              toast({
                title: "Sync successful!",
                description: `Synced ${syncResult.notes.length} notes with Google Drive.`,
              });
            }
          }, 2000);
        }

        setLastSyncTime(Date.now());
        setSyncError(null);
        setPendingSyncs(0);
        setRetryCount(0);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setSyncError(errorMessage);

        if (retryCount < maxRetries && isAutoSync) {
          const retryDelay = Math.pow(2, retryCount) * 1000;
          setTimeout(() => {
            setRetryCount((prev) => prev + 1);
            handleCloudSync(false, true, uploadOnly);
          }, retryDelay);
        } else {
          setRetryCount(0);
          if (showToast) {
            toast({
              title: "Sync Failed",
              description:
                retryCount >= maxRetries
                  ? "Sync failed after multiple attempts. Please try again later."
                  : errorMessage,
              variant: "destructive",
            });
          }
        }
      } finally {
        setIsSyncing(false);
        setIsFullSyncing(false);
        setSyncProgress([]);
      }
    },
    [
      isGapiLoaded,
      isLoggedIn,
      isOnline,
      isSyncing,
      retryCount,
      maxRetries,
      saveCurrentEditorContent,
      toast,
    ]
  );

  return {
    isSyncing,
    isFullSyncing,
    lastSyncTime,
    lastFullSyncTime,
    syncError,
    pendingSyncs,
    syncProgress,
    handleCloudSync,
    setLastFullSyncTime,
    setNotes: (notes: Note[]) => {}, // Will be passed from parent
  };
}
