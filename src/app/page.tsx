"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Pencil,
  Info,
  Copy,
  Download as DownloadIcon,
  Loader2,
  Cloud,
  User,
  Upload,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import * as GoogleDrive from "@/lib/google-drive";
import type { Note } from "@/lib/google-drive";
import type { StoredTokenData } from "@/lib/secure-auth-manager";
import { StorageTest } from "@/lib/storage-test";
import { IndexedDB, type Note as IndexedDBNote } from "@/lib/indexeddb";
import { ImageStorage } from "@/lib/image-storage";
import {
  ErrorHandler,
  handleErrorWithToast,
  QuotaManager,
} from "@/lib/error-handling";
// Lazy load BlockNoteEditor - it's heavy with BlockNote libraries
// Load it only when we have an active note to display
const BlockNoteEditor = dynamic(() => import("./BlockNoteEditor/blocknote"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
});
import type { BlockNoteEditorRef } from "./BlockNoteEditor/blocknote";

// Sync progress types
type SyncStatus = "syncing" | "complete" | "error";

interface SyncProgressItem {
  noteId: string;
  noteName: string;
  status: SyncStatus;
}

const LazyImageDialog = dynamic(() => import("@/components/image-dialog"));
const LazyStatusIndicator = dynamic(() =>
  import("@/components/status-indicator").then((mod) => mod.StatusIndicator)
);
const LazyToolbar = dynamic(
  () => import("@/components/toolbar").then((mod) => mod.Toolbar),
  {
    ssr: false,
    loading: () => (
      <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 h-[52px]" />
    ), // Placeholder with same height
  }
);

// Utility function to extract text content from BlockNote blocks
const extractTextFromBlocks = (blocks: any[]): string => {
  if (!blocks || !Array.isArray(blocks)) return "";

  try {
    return blocks
      .map((block: any) => {
        try {
          // Handle blocks with content property (paragraph, heading, quote, list items, etc.)
          if (block.content && Array.isArray(block.content)) {
            return block.content
              .map((item: any) => {
                if (item.type === "text" && item.text) {
                  return item.text;
                }
                // Handle link content
                if (
                  item.type === "link" &&
                  item.content &&
                  Array.isArray(item.content)
                ) {
                  return item.content
                    .map((linkItem: any) => linkItem.text || "")
                    .join("");
                }
                return "";
              })
              .join("");
          }

          // Handle code blocks - they have content but it's structured differently
          if (
            block.type === "codeBlock" &&
            block.content &&
            Array.isArray(block.content)
          ) {
            return block.content.map((item: any) => item.text || "").join("");
          }

          // Handle table blocks - extract text from all cells
          if (
            block.type === "table" &&
            block.content &&
            Array.isArray(block.content)
          ) {
            return block.content
              .map((row: any) => {
                if (
                  row.type === "tableRow" &&
                  row.content &&
                  Array.isArray(row.content)
                ) {
                  return row.content
                    .map((cell: any) => {
                      if (
                        cell.type === "tableCell" &&
                        cell.content &&
                        Array.isArray(cell.content)
                      ) {
                        return cell.content
                          .map((cellItem: any) => {
                            if (cellItem.type === "text" && cellItem.text) {
                              return cellItem.text;
                            }
                            return "";
                          })
                          .join("");
                      }
                      return "";
                    })
                    .join(" ");
                }
                return "";
              })
              .join(" ");
          }

          // Handle blocks without content (like images, files, etc.)
          // For these, we might want to count them as having some text representation
          if (block.type === "image" && block.props?.caption) {
            return block.props.caption;
          }
          if (block.type === "file" && block.props?.name) {
            return block.props.name;
          }
          if (block.type === "audio" && block.props?.name) {
            return block.props.name;
          }
          if (block.type === "video" && block.props?.name) {
            return block.props.name;
          }

          return "";
        } catch (blockError) {
          console.error("Error processing block:", blockError, block);
          return "";
        }
      })
      .join(" ")
      .trim();
  } catch (error) {
    console.error("Error extracting text from blocks:", error);
    return "";
  }
};

// Default content for new notes (from Introduction note)
const DEFAULT_NOTE_CONTENT = `[{"id":"cdbf94f7-d474-4892-bada-427544324b6e","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":1,"isToggleable":false},"content":[{"type":"text","text":"📒 Meet ","styles":{}},{"type":"text","text":"Tabula Notes","styles":{"bold":true}}],"children":[]},{"id":"b55b8dee-dd4f-4712-a9bd-f86f08c0ff5f","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Ever wished your notes could ","styles":{}},{"type":"text","text":"just work","styles":{"italic":true}},{"type":"text","text":" — beautiful, organized, synced, and always at your fingertips? That's exactly what ","styles":{}},{"type":"text","text":"Tabula Notes","styles":{"bold":true}},{"type":"text","text":" is built for.","styles":{}}],"children":[]},{"id":"bcd643e2-60cc-4526-b315-afc43b46bed2","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"1d684380-d56c-4b7c-879d-4abb153e69f9","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"📝 Write Freely with a Modern Rich Text Editor","styles":{}}],"children":[]},{"id":"483a652c-55c7-4ee0-ad5a-cb8259dd009d","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Tabula Notes comes with a ","styles":{}},{"type":"text","text":"block-based editor","styles":{"bold":true}},{"type":"text","text":" that feels fast, fluid, and natural. Format your thoughts with bold, italics, headings, checklists, and more — all just a shortcut away. You can even see your ","styles":{}},{"type":"text","text":"real-time character count","styles":{"bold":true}},{"type":"text","text":", helping you stay focused and concise.","styles":{}}],"children":[]},{"id":"320c2c77-63a1-4e24-8cc9-cac3533a7928","type":"image","props":{"url":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABdwAAAFECAYAAAA9T/xZAAAQAElEQVR4AeydB4AbxdXH/yNddQFjsAHTjA0E03sLEAiEhITkCxBaQiD03knoPVTTS+gdAoHQQy8hoYdeDKa444ox7te13/vPaqXVqteTdG9Pb6e9eTPz25mV9HZvFRr33reOijLQOaBzQOeAzgGdAzoHdA7oHNA5oHNA54DOAZ0DdT0H9Lu/+j90Dugc0Dmgc0DnQAXmQAi6KQEloASUgBJQAkqgVwlo40pACSgBJaAElIASUAJKQAkoASWgBOqDgDrcMx1HLVMCSkAJKAEloASUgBJQAkpACSgBJaAE6p+AjlAJKAEloASUQIkIqMO9RCDVjBJQAkpACSgBJaAEykFAbSoBJaAElIASUAJKQAkoASWgBJRA7RBQh3vtHKtq66n2RwkoASWgBJSAElACSkAJKAEloASUgBKofwI6QiWgBJSAEsiDgDrc84ClqkpACSgBJaAElIASUALVRED7ogSUgBJQAkpACSgBJaAElIASqC4C6nCvruOhvakXAjoOJaAElIASUAJKQAkoASWgBJSAElACSqD+CegIlYASUAIBAupwDwDRpBJQAkpACSgBJaAElIASqAcCOgYloASUgBJQAkpACSgBJaAEKk9AHe6VZ64tKoG+TkDHrwSUgBJQAkpACSgBJaAElIASUAJKQAnUPwEdoRLokwTU4d4nD7sOWgkoASWgBJSAElACSkAJ9GUCOnYloASUgBJQAkpACSgBJVAeAupwLw9XtaoElIASKIyA1lICSkAJKAEloASUgBJQAkpACSgBJaAE6p+AjrBuCajDvW4PrQ5MCSgBJaAElIASUAJKQAkoASWQPwGtoQSUgBJQAkpACSgBJVA4AXW4F85OayoBJaAElEBlCWhrSkAJKAEloASUgBJQAkpACSgBJaAElED9E6jpEarDvaYPn3ZeCSgBJaAElIASUAJKQAkoASWgBCpHQFtSAkpACSgBJaAElEBmAupwz8xHS5WAElACSkAJ1AYB7aUSUAJKQAkoASWgBJSAElACSkAJKAEl0OsEyu5w7/URageUgBJQAkpACSgBJaAElIASUAJKQAkogbIT0AaUgBJQAkpACSgBQB3uOguUgBJQAkpACSiBeieg41MCSkAJKAEloASUgBJQAkpACSgBJVARAupwrwjmdI1ovhJQAkpACSgBJaAElIASUAJKQAkoASVQ/wR0hEpACSgBJdBXCKjDva8caR2nElACSkAJKAEloARSEdA8JaAElIASUAJKQAkoASWgBJSAEigZAXW4lwylGio1AbWnBJSAElACSkAJKAEloASUgBJQAkpACdQ/AR2hElACSqCeCKjDvZ6Opo5FCSgBJaAElIASUAJKoJQE1JYSUAJKQAkoASWgBJSAElACSiAvAupwzwuXKiuBaiGg/VACSkAJKAEloASUgBJQAkpACSgBJaAE6p+AjlAJKIFaI6AO91o7YtpfJaAElIASUAJKQAkoASVQDQS0D0pACSgBJaAElIASUAJKQAkkEVCHexISzVACSqDWCWj/lYASUAJKQAkoASWgBJSAElACSkAJKIH6J6AjVALVSEAd7tV4VLRPSkAJKAEloASUgBJQAkpACdQyAe27ElACSkAJKAEloASUQB8loA73PnrgddhKQAn0VQI6biWgBJSAElACSkAJKAEloASUgBJQAkqg/gnoCHuLgDrce4u8tqsElIASUAJKQAkoASWgBJSAEuiLBHTMSkAJKAEloASUgBKoYwLqcK/jg6tDUwJKQAkogfwIqLYSUAJKQAkoASWgBJSAElACSkAJKAElUP8EyjlCdbiXk67aVgJKQAkoASWgBJSAElACSkAJKAElkDsB1VQCSkAJKAEloARqnIA63Gv8AGr3lYASUAJKQAlUhoC2ogSUgBJQAkpACSgBJaAElIASUAJKQAlkI1D7DvdsI9RyJaAElIASUAJKQAkoASWgBJSAElACSqD2CegIlIASUAJKQAnUAAF1uNfAQdIuKgEloASUgBJQAtVNQHunBJSAElACSkAJKAEloASUgBJQAkqABNThTgr1KzoyJaAElIASUAJKQAkoASWgBJSAElACSqD+CegIlYASUAJKoEoIqMO9Sg6EdkMJKAEloASUgBJQAvVJQEelBJSAElACSkAJKAEloASUgBLoOwTU4d53jrWONEhA00pACSgBJaAElIASUAJKQAkoASWgBJRA/RPQESoBJaAEKkhAHe4VhK1NKQEloASUgBJQAkpACSgBPwGNKwEloASUgBJQAkpACSgBJVBfBNThXl/HU0ejBEpFQO0oASWgBJSAElACSkAJKAEloASUgBJQAvVPQEeoBJRAiQmow73EQNWcElACSkAJKAEloASUgBJQAqUgoDaUgBJQAkpACSgBJaAElEDtEVCHe+0dM+2xElACvU1A21cCSkAJKAEloASUgBJQAkpACSgBJaAE6p+AjlAJFEBAHe4FQNMqSkAJKAEloASUgBJQAkpACSiB3iSgbSsBJaAElIASUAJKQAlUJwF1uFfncdFeKQEloARqlYD2WwkoASWgBJSAElACSkAJKAEloASUgBKofwI6wjQE1OGeBoxmKwEloASUgBJQAkpACSgBJaAElEAtEtA+KwEloASUgBJQAkqg9wiow7332GvLSkAJKAEl0NcI6HiVgBJQAkpACSgBJaAElIASUAJKQAkogbomYB3udT1CHZwSUAJKQAkoASWgBJSAElACSkAJKAElYAnoTgkoASWgBJSAEigvAXW4l5evWlcCSkAJKAEloARyI6BaSkAJKAEloASUgBJQAkpACSgBJaAEap6AOtyzHkJVUAJKQAkoASWgBJSAElACSkAJKAEloATqn4COUAkoASWgBJRA8QTU4V48Q7WgBJSAElACSkAJKIHyElDrSkAJKAEloASUgBJQAkpACSgBJVATBNThXhOHqXo7qT1TAkpACSgBJaAElIASUAJKQAkoASWgBOqfgI5QCSgBJaAEciOgDvfcOKmWElACSkAJKAEloASUQHUS0F4pASWgBJSAElACSkAJKAEloASqhoA63KvmUGhH6o+AjkgJKAEloASUgBJQAkpACSgBJaAElIASqH8COkIloASUQJyAOtzjLDSmBJSAElACSkAJKAEloATqi4CORgkoASWgBJSAElACSkAJKIGKElCHe0Vxa2NKQAl4BDRUAkpACSgBJaAElIASUAJKQAkoASWgBOqfgI5QCfQ1Aupw72tHXMerBJSAElACSkAJKAEloASUAAmoKAEloASUgBJQAkpACSiBkhNQh3vJkapBJaAElECxBLS+ElACSkAJKAEloASUgBJQAkpACSgBJVD/BHSE9UhAHe71eFR1TEpACSgBJaAElIASUAJKQAkogWIIaF0loASUgBJQAkpACSiBggiow70gbFpJCSgBJaAEeouAtqsElIASUAJKQAkoASWgBJSAElACSkAJ1D+BWh2hOtxr9chpv5WAElACSkAJKAEloASUgBJQAkqgNwhom0pACSgBJaAElIASSEtAHe5p0WiBElACSkAJ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AiIgAiIgAiIgAiIgAiJQJqCCe5mI+utPQCsQAREQAREQAREQAREQAREQAREQARHYfAJaoQiIgAhMkIAK7hM8KEpJBERABERABERABERgvQkoexEQAREQAREQAREQAREQge0koIL7dh53rXp7CWjlIiACIiACIiACIiACIiACIiACIiACm09AKxQBEVgRARXcVwRe04qACIiACIiACIiACIjAdhLQqkVABERABERABERABERgcwmo4L65x1YrEwER6EtA9iIgAiIgAiIgAiIgAiIgAiIgAiIgAptPQCsUgQUSUMF9gXAVWgREQAREQAREQAREQAREQAT6EJCtCIiACIiACIiACIjAehNQwX29j5+yFwEREIFlEdA8IiACIiACIiACIiACIiACIiACIiACm09AK5yTgArucwKUuwiIgAiIgAiIgAiIgAiIgAiIwDIIaA4REAEREAEREAERmD4BFdynf4yUoQiIgAiIwNQJKD8REAEREAEREAEREAEREAEREAEREIHNJ9BhhSq4d4AkExEQAREQAREQAREQAREQAREQARGYMgHlJgIiIAIiIAIiMA0CKrhP4zgoCxEQAREQARHYVAJalwiIgAiIgAiIgAiIgAiIgAiIgAhsDYEtLrhvzTHWQkVABERABERABERABERABERABERgiwlo6SIgAiIgAiKwPAIquC+PtWYSAREQAREQAREQgSIB9URABERABERABERABERABERABDaKgAruG3U4x1uMIomACIiACIiACIiACIiACIiACIiACGw+Aa1QBERABERgXAIquI/LU9FEQAREQAREQAREQATGIaAoIiACIiACIiACIiACIiACIrB2BFRwX7tDpoRXT0AZiIAIiIAIiIAIiIAIiIAIiIAIiIAIbD4BrVAEREAE+hNQwb0/M3mIgAiIgAiIgAiIgAiIwGoJaHYREAEREAEREAEREAEREIFJElDBfZKHRUmJwPoSUOYiIAIiIAIiIAIiIAIiIAIiIAIiIAKbT0ArFAERqCeggns9F2lFQAREQAREQAREQAREQATWk4CyFgEREAEREAEREAEREIGVEVDBfWXoNbEIiMD2EdCKRUAEREAEREAEREAEREAEREAEREAENp+AVrjNBFRw3+ajr7WLgAiIgAiIgAiIgAiIgAhsFwGtVgREQAREQAREQAREYKEEVHBfKF4FFwEREAER6EpAdiIgAiIgAiIgAiIgAiIgAiIgAiIgAptPYNNXqIL7ph9hrU8EREAEREAEREAEREAEREAERKALAdmIgAiIgAiIgAiIwNwEVHCfG6ECiIAIiIAIiMCiCSi+CIiACIiACIiACIiACIiACIiACIjAOhCYr+C+DitUjiIgAiIgAiIgAiIgAiIgAiIgAiIgAvMRkLcIiIAIiIAIiEAnAiq4d8IkIxEQAREQAREQgakSUF4iIAIiIAIiIAIiIAIiIAIiIAIiMBUCKrgv7kgosgiIgAiIgAiIgAiIgAiIgAiIgAiIwOYT0ApFQAREQAREICWggnuKQg0REAEREAEREAER2DQCWo8IiIAIiIAIiIAIiIAIiIAIiMAyCajgvkzamisjoJYIiIAIiIAIiIAIiIAIiIAIiIAIiMDmE9AKRUAERGDLCKjgvmUHXMsVAREQAREQAREQARGICehZBERABERABERABERABERABMYmoIL72EQVTwTmJ6AIIiACIiACIiACIiACIiACIiACIiACm09AKxQBEdhAAiq4b+BB1ZJEQAREQAREQAREQAREYD4C8hYBERABERABERABERABERhCQAX3IdTkIwIisDoCmlkEREAEREAEREAEREAEREAEREAERGDzCWiFIrCmBFRwX9MDp7RFQAREQAREQAREQAREQARWQ0CzioAIiIAIiIAIiIAIiEATARXcm8hILwIiIALrR0AZi4AIiIAIiIAIiIAIiIAIiIAIiIAIbD4BrXDCBFRwn/DBUWoiIAIiIAIiIAIiIAIiIAIisF4ElK0IiIAIiIAIiIAIbDcBFdy3+/hr9SIgAiKwPQS0UhEQAREQAREQAREQAREQAREQAREQgc0nsOIVquC+4gOg6UVABERABERABERABERABERABLaDgFYpAiIgAiIgAiKw+QRUcN/8Y6wVioAIiIAIiMAsAhoXAREQAREQAREQAREQAREQAREQAREYgcDEC+4jrFAhREAEREAEREAEREAEREAEREAEREAEJk5A6YmACIiACIjAZhBQwX0zjqNWIQIiIAIiIAIisCgCiisCIiACIiACIiACIiACIiACIiACHQmo4N4R1BTNlJMIiIAIiIAIiIAIiIAIiIAIiIAIiMDmE9AKRUAEREAE1oeACu7rc6yUqQiIgAiIgAiIgAhMjYDyEQEREAEREAEREAEREAEREAERyBFQwT0HQ81NIqC1iIAIiIAIiIAIiIAIiIAIiIAIiIAIbD4BrVAEREAEpkVABfdpHQ9lIwIiIAIiIAIiIAIisCkEtA4REAEREAEREAEREAEREIGtI6CC+9Ydci1YBMzEQAREQAREQAREQAREQAREQAREQAREYPMJaIUiIALLJ6CC+/KZa0YREAEREAEREAEREAER2HYCWr8IiIAIiIAIiIAIiIAIbCQBFdw38rBqUSIgAsMJyFMEREAEREAEREAEREAEREAEREAERGDzCWiFIrAYAiq4L4arooqACIiACIiACIiACIiACIjAMALyEgEREAEREAEREAERWFsCKriv7aFT4iIgAiKwfAKaUQREQAREQAREQAREQAREQAREQAREYPMJaIXDCajgPpydPEVABERABERABERABERABERABJZLQLOJgAiIgAiIgAiIwKQJqOA+6cOj5ERABERABNaHgDIVAREQAREQAREQAREQAREQAREQARHYfALtK1TBvZ2PRkVABERABERABERABERABERABERgPQgoSxEQAREQAREQgZUTUMF95YdACYiACIiACIjA5hPQCkVABERABERABERABERABERABERgGwhse8F9G46x1igCIiACIiACIiACIiACIiACIiAC205A6xcBERABERCBpRBQwX0pmDWJCIiACIiACIiACDQRkF4EREAEREAEREAEREAEREAERGBTCPwPAAAA//+t/mBPAAAABklEQVQDACgZqvlQmmqbAAAAAElFTkSuQmCC","backgroundColor":"default","textColor":"default","textAlignment":"left","caption":""},"content":[],"children":[]},{"id":"31afb5f0-be79-43a5-a983-b35467f76405","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"e6237273-a243-47f3-b348-ff0c2bdfe5e6","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"0c8fff1e-a1f9-43bb-9a9d-427bffcc4347","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"🖼️ Add Images Instantly","styles":{}}],"children":[]},{"id":"f9be95f9-50ab-4363-b45a-653fac923dd3","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Bring your notes to life! Simply ","styles":{}},{"type":"text","text":"drag and drop images","styles":{"bold":true}},{"type":"text","text":", paste them from your clipboard, or upload in popular formats (JPEG, PNG, GIF, WebP, SVG). Tabula handles ","styles":{}},{"type":"text","text":"smart storage and deduplication","styles":{"bold":true}},{"type":"text","text":", so you never waste space.","styles":{}}],"children":[]},{"id":"0e74dddb-ea5e-40ea-906a-31b1f9779794","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"17918fad-eabf-4464-99c7-a6876009f789","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"☁️ Sync Seamlessly with Google Drive","styles":{}}],"children":[]},{"id":"5e4a9efd-cb8d-48f7-a8fc-9b5d696785ca","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"No more losing work or juggling backups. Tabula automatically ","styles":{}},{"type":"text","text":"syncs with Google Drive","styles":{"bold":true}},{"type":"text","text":", giving you:","styles":{}}],"children":[]},{"id":"28e7bc11-7837-451f-b207-0192bfa1587a","type":"bulletListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Offline-first editing","styles":{"bold":true}}],"children":[]},{"id":"e8007fad-5891-4f7a-8b23-2134934850a5","type":"bulletListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Automatic daily backups","styles":{"bold":true}}],"children":[]},{"id":"5a8cf4d3-d950-447b-80a5-a8b74b0e32a8","type":"bulletListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Smart conflict handling","styles":{"bold":true}}],"children":[]},{"id":"4843c91f-f156-4d12-a57d-813a3c0400f4","type":"bulletListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Manual sync whenever you want","styles":{"bold":true}}],"children":[]},{"id":"6eea9c07-9df2-426e-8cad-c3d9736fe5d8","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Your notes stay secure and up-to-date — wherever you are.","styles":{}}],"children":[]},{"id":"b89bcd87-ec49-44ff-aa9f-6d24ccc21beb","type":"image","props":{"url":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA9QAAAGCCAYAAAABnItHAAAQAElEQVR4AeydBWAURxfH3yYEl+Du7u7uxYsUl9JSoy5UvlKjRgsVSmmLthRKcXd3K+7urgkheJJv/rOSvbu9y93FLrkHN/5G9rczm307s7MBI/aGRLFhBtwHuA9wH+A+wH2A+wD3Ae4D3Ae4D3Af4D7AfcCzPhBASeofN5YJMAEmwASYABNgAkyACTABJsAEmIBvEGCFOj7PA5fNBJgAE2ACTIAJMAEmwASYABNgAsmWACvUyfbUen5gnIMJMAEmwASYABNgAkyACTABJsAE3CfACrX7rFjStwhwa5gAE2ACTIAJMAEmwASYABNgAolKgBXqRMXPlfsPAT5SJsAEmAATYAJMgAkwASbABJIbAVaok9sZ5eNhAnFBgMtgAkyACTABJsAEmAATYAJMIEYCrFDHiIgFmAAT8HUC3D4mwASYABNgAkyACTABJpAYBFihTgzqXCcTYAL+TICPnQkwASbABJgAE2ACTCCZEGCFOpmcSD4MJsAEmED8EOBSmQATYAJMgAkwASbABJwRYIXaGRmOZwJMgAkwgaRHgFvMBJgAE2ACTIAJMIEEJMAKdQLC5qqYABNgAkyACZgJsJ8JMAEmwASYABNI2gRYoU7a549bzwSYABNgAkwgoQhwPUyACTABJsAEmIAdAVao7YBwkAkwASbABJgAE0gOBPgYmAATYAJMgAnEPwFWqOOfMdfABJgAE2ACTIAJMAHXBDiVCTABJsAEkiQBVqiT5GnjRjMBJsAEmAATYAJMIPEIcM1MgAkwASagEmCFWuXANhNgAkyACTABJsAEmEDyJMBHxQSYABOINwKsUMcbWi6YCTABJsAEmAATYAJMgAl4SoDlmQATSEoEWKFOSmeL28oEmAATYAJMgAkwASbABHyJALeFCfg5AVao/bwD8OEzASbABJgAE2ACTIAJMAF/IcDHyQTimgAr1HFNlMtjAkyACTABJsAEmAATYAJMgAnEngCXkAQIsEKdBE4SN5EJMAEmwASYABNgAkyACTABJuDbBPyzdaxQ++d556NmAkyACTABJsAEmAATYAJMgAn4L4E4OnJWqOMIJBfDBJgAE2ACTIAJMAEmwASYABNgAv5FIKEUav+iykfLBJgAE2ACTIAJMAEmwASYABNgAsmeACvUlqeYI5kAE2ACTIAJMAEmwASYABNgAkyACbgmwAq1az5JI5VbyQSYABNgAkyACTABJsAEmAATYAIJToAV6gRHzhUyASbABJgAE2ACTIAJMAEmwASYQHIgwAp1cjiLfAzxSYDLZgJMgAkwASbABJgAE2ACTIAJWBJghdoSC0cygaRKgNvNBJgAE2ACTIAJMAEmwASYQEIRYIU6oUhzPUyACTgS4BgmwASYABNgAkyACTABJpCECbBCnYRPHjedCTCBhCXAtTEBJsAEmAATYAJMgAkwATMBVqjNNNjPBJgAE0g+BPhImAATYAJMgAkwASbABOKZACvU8QyYi2cCTIAJMAF3CLAME2ACTIAJMAEmwASSHgFWqJPeOeMWMwEmwASYQGIT4PqZABNgAkyACTABJiAIsEItIPCPCTABJsAEmEByJsDHxgSYABNgAkyACcQPAVao44crl8oEmAATYAJMgAl4R4BzMQEmwASYABNIMgRYoU4yp4obygSYABNgAkyACfgeAW4RE2ACTIAJ+DMBVqj9+ezzsTMBJsAEmAATYAL+RYCPlgkwASbABOKUACvUcYozKRUWJRrrwkSJNDZEzIAZcB/gPsB9gPsA94FE6wP8d5jvx3yqD5A4Hy6NuL3mn98RYIXa7045HzATYAJMgAkwASbABJhAPBDgIpkAE/BDAqxQ++FJ50NmAkyACTABJsAEmAAT8HcCfPxMgAnEBQFWqOOCok+UYbEExeUSNdFoiyzGKhaR7OznKhunkYGQWTAL7gPcB7gPcB/gPsB9gPtAHPUBcWOaECxFNc5/MTZACDi7/7a8Q3ReFackHQKsUCedc8UtZQJMgAkwASbABJgAE2ACTCAJEOAm+g8BVqiT1LkWT73MT7dsnoCJA7FLFjGWP3sxT8OWhXIkE2ACTIAJMAEmwASYABNI4gQ8vS+2l3d6+PaCMiws/X7efI8v/U5Lio8ELjMWBFihjgU8zsoEmAATYAJMgAkwASbABJgAE2ACCUnAt+pihdq3zoepNeKJlXw6pbny6ZVI1oIySQStfmYRK79VHo5jAkyACTABJsAEmAATYAJMIHYErO69zXFOSzcLSb+0hLjZFUH++RyBGBVqn2sxN4gJMAEmwASYABNgAkyACTABJsAEmIAPEEhuCrUPII1NE0xPoExeT2ejY9MC7/LaN5bDSWs/Sz5ffL64D3Af4D7AfYD7APcBf+0D3t39epvLirLTsuyFpVKgRzrNxQkJTIAV6gQGblsdh5gAE2ACTIAJMAEmwASYABNgAkwgqRJghTrRz5z+lEm44mc8eHLSLrMI/E7EYhGNUp0Yo3H26aI6+ygO84Nu7gPcB7gPcB/gPsB9gPsA9wFf7gPiFta7EyQzxpllj8hpwWZBm/typzk4IQEIsEKdAJCtq9BHhEg1eUXI4acnw3VI9DoCpVkZrUCrJFdxWjZfcrgtTIAJMAEmwASYABNgAkzAKQFX97ZWaUZBVomIMwRi5UFJunFakI2ATcBpFk6IHwKsUMcP1xhKRacXInBghNfqhyQYqzTP41CS2ZhKMEfrflMyexOEAFfCBJgAE2ACTIAJMAEm4MsE9Ptks2vTXnMC/DaJXgVQCozTzEiEkQKGR4bYShgCrFAnDGdTLe51dPekTMW69DopDdEwLvNyIhOwIsBxTIAJMAEmwASYABNgAsbKa0sUcXej7X5J7ktaNpkjPSbACrXHyLzNgM4tjPg5G3gukjyo1FyK5tcco1497EGp7oiqxUaJatgwAR8jwL2SCTABJsAEmAATYAIGAXfubD2UUW+EHV/JFnVaRHpYuCpurkKNMdk2iXrAlM7eeCPACnW8oTUXjE4twpojfA4/F0kOstYRKAHGlIogjCkqLrzOVCX1YhEXNXAZTMC/CfDRMwEmwASYABNgAvFJwNndbLzcOFvcIqMeGO+P0WVuI9HweF8R54yRACvUMSKKjQA6MYwoQ3OEz+aHaBibSLcDyKkbkUn36q6I8vSnZnV+kUGKZZlqRvWCwX7mwH3An/oAHyv3d+4D3Ae4D3AfSJp9wOKmFve6ro1FJnei7PuIzGOOlBEeWXpuy0xIlAnwwMgAW/FAgBXqeIAafUURhaP/wgiv+YcoGHOce37k0o3IoXvhiqC7P4hbXSzUtptKUQXVaFd+Uxb2MgEmwAR8lwC3jAkwASbABJiARsDVva05TRNXHas7aMSpqW7bDuU7RHhclEMGvUiZYBOQMWzFDQFWqOOGo6kUdFYRhAMjvOYfomDMcTH7kUM3Qlr3whVBd34Y5majasimnCjLyphE3PNaFcJxKm/mwBy4D3Af8LAPWL57x2VwP+I+wH2A+0Ds+oB7d7WGlDPchgA85jtt1Y9Yt4y5fJnBIULGxmTpuRzkbBIQcJDgiFgQYIU6FvAcs2odVHMc072JsSvMLhhTiepwtsiEKLOJqSAj3ZzJym8IsocJMAEmwAT8jAAfLhNgAkwgaRCwuoc1x7l5FOYs8Ntlc3ofbidnE3QoxyHCRtyjgFGU4fEoOwtbE2CF2pqLF7Fax9Qc+wIQDWMf7zwM6SjKkTqAamdLQZ3zB9GzhVPSs0U8M/2LpCJLU1TEe2VSU/+ibJgB9wHuA9wHuA8k+T7Af8/47zn3Ae4DTvqAl/fJTu67Pb1/xz0/7v2hA0AXiJ6Nd645mFNULcIcY/IjUQYNjwyx5T0BVqi9Z2fKqXVIzTElSK+TaJnmaEEahqQi3Tp3CiqZIYAypFAcRTmGCTABJsAEmAAT8BMCfJhMgAn4EwHc+0MHgC4AxVo9dugIMGooJtuppJFgeGIqitNdEGCF2gUc95K0jqg59nmcRNuLaeFo6Ra5gqQirSWwwwSYABNgAkyACTCBpEOAW8oEmECcEYBiDd0gusBonSE6ztrnVNJIMDzWBXBsjARYoY4RkSsBrQNqjlkSUTDmOOd+SMIICeHgKVSeNDwjLWjwjwkwASbABJgAE2AC8U6AK2ACvk4AugF0BLlXpWysUBqiAzLGmeVUEgkyk+GRIbY8I8AKtWe8TNJax9McU4KbXVvPYSpAeHOkCeCZaR0Nu0yACTABJsAEmAATYAL2BDjspwQwUw1dwVbZEAqEmzwsJY1Iw+NmaSymE2CFWifhkat1OM0xZ7WIMifb+TVpODAitWh6PiUCA/+YABNgAkyACTABJsAEkgUBPoi4JGDoCtAdYGThhkeGXFmWkkak4XFVBKfZEWDtzQ5IzEGto2mOWd4iypxs8kMSRkRpjvDJH5ZzSA9bTIAJMAEmwASYABNgAkyACSQsAR+vzUFXMHQJeGBiPgBLKSPS8MRcEEtIAqxQSwzuWloH0xxzLosoc7LJb5I0eXUB7Oin+9llAkyACTABJsAEEo5AVFQUmU2kCLOJImaQeAzM/RH+hBsNXJOvErDXFWQ7bXQKm4BMtrIspYxIw2OVlePsCLBCbQfEeVDrWJpjlrOIMieb/JokHBhTCnuZABNgAkyACTCBhCUABQXK4j16QNcCQulciht0IsUVOhR0nvamPEu7Up2iHalOsmEGidIH0P/QD9Ef0S/RP9FP0V/Rb9F/E3bEcG0+TQC6BYxspOGRIWeWpZQRaXicZfcmPlnmYYXardOqdSjNMWexiDInm/yapOaYEgxvlO0OA0Y8e5gAE2ACTIAJMIG4IQAl5ElUBN1S7tDpFFdpj1CcD6S8QGdSXKergaF0OzCcwgMe0SPlCUXy3+W4gc6leEUA/Q/9EP0R/RL9E/0U/RX9Fv0X/Rj9Gf3aq0o4U5Ik4FJnMHQNw+PyGC2ljEjD47KM5Jvo3pEFuCfmz1JaR9IcMwmLKHOy5ocUjAhqjvA5/FwODAdpjmACTIAJMAEmwATcJQBlAzN6d5T7dDbFNdqT6gydCLpGNwLv0hPlCaWmIMoakIHyB2al4ilyU7mg/FQpqDBVS1mUqqcsxoYZJEofQP9DP0R/RL9E/0Q/RX9Fv0X/RT9Gf0a/Rv9GP0d/d3dssFzSJeBSdzB0DnhgXB+npYQRaXhcF+LHqQG+cuw+3Q6LfmQRZXEIJimT1yyIwQAj45zIyDS2mAATYAJMgAkwAY8IQLGAghEaEE7Hgi7RkaCLdC0wTM48Z1TSUMHAbFQ+qACVT1mQiqTISbkCM1NwQDpKo6SiICWQFPHfowpZmAnEIQH0P/RD9Ef0S/RP9FP0V/Rb9N+Moh9jJhv9Gv0b/Rz9Hf0e/T8Om8NF+RIBTWeADgFj2TRNRk2zCahRdralhGWkXUYOUgAzcEXAaS9ylUlLM+U1ebVE6dgMACcyUpAtJsAEmAATYAJMwCMCUCjuBjykE4GXFNEqzQAAEABJREFUhTJ9he4E3KcgcduTRyjNUEZKBuWlHIHBlFpJ6VG5LMwEfIEA+i36L/ox+jP6Nfo3+vmxoCuy36P/Yxz4Qnu5DfFAwKQ72OgU5qpMMhSrV1hsCjLXwH5BgBVqAcHlz6L/WETZFWGSMHnNQjYd34mMWT52fs7NBJgAE2ACTMA/CGBWDkrExcCbdDjoAoWkuCcVaSyXrZiyMOUNzMpKtH90Bb85SijX6Nfo3+jnUKzR79H/MQ4wHjAu/AaIPx2oSYew0S3MDEwyMSnVNqJ6GZaReiK7IBAAi40VAeveYx1rlV/EORG26fBOZERu//3xkTMBJsAEmAAT8IIAFIf7ykM6IhTpyylCZAm5AoKpQspCcjk3ltDKSLaYQDIkgP6NZeGyv4t+j0PEOMB4wLjA+EAcm2RGwKRL2OgY5sM0yZijrfzORZ2nWJXjT3EB/nSw7h+r1mE0R89nF9Sj7VxNSnPsEsmmozvIOETYZ+ewDxLgJjEBJsAEmEDiEsDsG5SFkIAwwg7IWOqaTklFpVLkpfwpslGA+J+4LeTamUDCEUB/R79H/8c4wHjAuMD4wDjBeEm41nBN8UPATmcwBW10DXPlhozhMafa+B0kjAjDYyPv7wFWqJ31AK/6i5ZJc+yLtungNjIIwNjn4DATiHMCXCATYAJMIFkRgHKAv6BXAm7TiaBr8thyBGSiMkH5KUNAGhlmiwn4IwH0f4wDjAccP8YHxgnGC8YN4tgkZQLyTEYfAIJayEbn0OKkY8gYHhntluVFFrfKTQZCrFA7nETRW8TPHI0gjDnO0a9JaI59utGxkQ5jCJgCJq+RzB4m4NcE+OCZABNgAs4JQCnAn85LATfpQtAtKYidjwumyC79bDEBJkCE8YBxARYYJxgvGDcYP4hjkwQJ4AQazTYF4IURaYbuIfw2Py3dnfepDVG9ABkhLT2GXUGAFWoBIfrnbQfR8mlOdHmqz2mHJlMG4RU/NQPbTIAJJE0C3GomwAQSjACUAfzdhHJwKUh9X7pYilyEnY8TrBFcERNIIgQwLjA+0FyMF4wbjB+MI8SxSVoEcO7MaoQz5dipDiILwDEbHgQ8MN7m86CKJCTKCrVxsqw7hnWskSlGj01HtinMFBBe8RNlqbbw8I8JMAEmEO8EuAImkFQJQAnAX0wsX4VygOMoniI3ZQ5IDy8bJsAELAhgfGCcIAnjBuMH4wjjCXFskhIBTcPACTSabQrYeE0BQ9Z9j/PczlPcLz15SLJCbT6P6Bcw5rgY/VoGzTGLa11djbJJjw5ECa/4CRnVFh7+MQEmwASYgCMBjmECkgBu/vEX87YSZizzxsxbcEA6mc4WE2ACzglgnGC8QALLvzGOMJ4wrhDHJikRUDUN6BLRrcbZ1EI2XlNAS46e4bZI02WsXIjDWKX5aRwr1PLEW/cK61iZQbM0Cc3RIqWjdnHptVuFES0cPQCi47Qc7DABJsAEmECSJsCNjy8C+It5nx7QyZTqBmR4NxQzb/FVH5fLBJIbAYwXjBscF8YRxhPGFcJskhoB9cxF6xRovxoHX7TSDHXEFC8ThWVEGR4R6fhznuo8xbGU5BvDCrV+bj3uD1oGzdGLcXBt0k0Bw2t40NMdsnMEE2ACTIAJMIF4J5BEKsAnf9DUs0E34BB2L8a7oTLAFhNgAm4TwLjB+EEGfTzp4wtxbHycgEl9MBQIqzgchk08IuyMkW547AScBD0Ud1JKsohmhdrJaYxNHzFmp50VIuLFT9Ss2sKjjQVTWEayxQSYABNgAkyACYCAviQVmyndDXhI6ZRUcvdipLFhAkzAcwLY/RvjCOMJ4wol6OMMfja+TEDoDOIX3UJN+7CJi07VZ6o1KVOC+15nRbtfQvKV9HOFGl1DGPEzn2K7oDlJ82sSmqNFSsfoqA5pWoRwxE/IqrbwsDItIbDFBJgAE2ACTMA5AfzVvKc8IGymBKn8gdngJAXDbWQCPktAH0cYVxhfGGc+21humB0BcbbELzpS00KMOMOjimhBTUqN020tTVNK9FgH1xDTU2QELBg90v9cP1eovTnhWofRHPdKiBaO9mk5TREmr5bIDhNgAkyACTABJqAvRb0UcFvCyBUQTBkC0kg/W3FNgMvzJwIYRxhPOGZ9fOnjDXFsfJOAjc5gE7BXie0SXR2OIWp4XElzmolAgMnP3lgSMJ742PTD6ED0hgFanOag6xveWLaBszMBJsAEmAATSE4E9CWooUo4haS4R0EUQHlTZElOh8jHEhsCnDfWBDCeMK4wvjDOUKA+7uBn45sEVN1BtfUl3dAp0NponUOGYKnGENc8aizbsSQQEMv8STQ7OpEw4hfdAdVDQZTqs7K1VM0xS1gr09ES0R3bPrORU4wB+7To/OxjAkyACTABJuCPBPCXETf3VwND5eHnCswsVGo/vX2RBNhKygR8se0BYkRhXKFtGGcYbxh3CCc1c+HSFdq+cy8tXbmO5s1fJg38iENaUjsep+3VFAv1PKl2tKwa1kSio3WfmixUIM2jx8M1ogwPYm2MQwoiYESJQpmxkfWXAP9FMp1p2RdMYUuvW0J6Tk1Yc2w6mYxjZVonxS4TYAJMgAkwAXsCuLFHXHjAA7oTeF/OTucMDEaUT5gLdy7S9gs7pYHfJxrFjWACXhDAuMIsNcYZxhuKiIqKguPz5vLVa7RgyUr68ruR9NvYSTR34XJav2k7bdu9Txr4EYc0yEAWeXz+wGJqoKYxS5UCyqzq0XJpAc2x0UE0CaeOkcepBGpznuiHKaxQu33SnfeuKL1b2YhEB1SfasvqpNfIJfq4jJBJbDEBJsAEmAATYAIqAfx1hFJ9M+COjMgemIkU8V8GEtHafH47Pbd4EDVb+Db1Xf+dNPAjDmmJ2DSumgl4RQDjCuMLmTHeMO4w/hD2VfPw8WOpSI/8YyJt2b6b7j94EGNT7z94IGWRB4o1yogxky8LxKBU255DU0jzmrQRi6PUhCxSOMqWACvUGg/XXcZ1qlaEpaP18+g0rSjNEcp0dBL7mAATYAJMgAkwAVsCkUok3QoMl5FZAzJINzGtv/dOo+c2DKfNIWcdmoE4pEHGITGJRYTdv0tQqpJYs7m5sSCgjy+MN4y7WBQV71lPn7tAI3/7SyrHemU5smWlxg3q0IB+3ejjQa/SN58NkgZ+xCENMro8lHCUgbL0uAR146oyTanQHAfdwkEX8aheo1SHXM5THESTfYR/KtToATCenl6LPMaTHZs0LaA5Dj3bZkbbEOI/XJ6eD5ZnAkyACTCBZEtAV+ZC6S5FKFGUUUlDqZWUiXq8i44tp28OzjLa8ErRZjS6zpvSwK8nQAayejix3PCH92jv2f00fetc+nnJbzTnv4V08Pwhevj4gcsmjVn1J9X5sTt1HPkcXbp9yaWsPySuP7SRVu1fK01kVKTbh4x7RD0f3IjICLfzJoYgxhfGGcYbxh3aoI9D+H3FHDl6gsb++S/dCgmRTYKS3K1zO3rr1eeoeeO6VKRQAUqXNq1MgwU/4pD2lpCBLPIgDWWgLJSJcFIxtudF6BLip7bd8KhBG50DUaZ0zYt+ihQbo6WZ42L0Iw9MjILJT8DPFGqcZZi4OZHWJUXHRvu0+mSEudvKCJloOzBkFFtMgAkwASbABPyWAP5C4m9jaOB9ySBzQDrpJpZ1//F9enfHOFl9usAUNK3Jp/RmzRepYaG60sA/XcSlCwySMpC99/ie9Ce0dV8o0p/M/Jaqft+Fuv09iD5d8Qf9sWM+fbT0V+r81ztU5bvOUsF+EvHEoWmPnjyi37fOpseRT+hI6GVatneNg4y/RXy8cAS9OneoNBEWzJzxQP/V88F98PihM1GfidfHGcYd2o9x6DONEw3BbPLfU+cIn/qrWa2iVKQrliulRrhhQxaKNfLq4igTZevhpODi/ES3Uz1Thq16jGTboG0IQo4xiPXWoDQYb/PHSb4ELcTPFGprtq5PuZaqObYlaJGaY06LXl6hJUrHpEzLsJrDdkCocWwzASbABJgAE2ACRKGBqhKSMSB6xikxuGy9sMOo9tOKvalirnJGWPdUEHGfVuylB2nbhZ2GP6E8526cp2fHv00zDq8TVVrPpkZERUgF+7W/P6JbYbeEXPQvZYqU1LxYNRkRFJCCahVX/TKCrWRPQB9n+rjzpQN++PgxzZqzxGgSlnB3aNPCCHvqQV6UoedD2ahDDycF10aH0HQL1RG2+KnHoHqidRM1VtpqkvAaHuHXfkaU4dESoh3nKdEy/uCLvULtD5QseotFlAUJJ1IyWlp2eazi7EQ4yASYABNgAkwgmRPQbxLvKw/oifKEUlMQYTlqYh72sVunjeqbFm5g+O095jRzHnu5+AjffRBO/f58l/beVN/vLpUpN416+kNa/soY2v7eDJrQ9QsaWO1pyp8ui6x+7YX99PbUz8n0uF/Gf9ftU5rebzitf3MSlc5bUsax5R8EMM4w3jDuMP5w1Pp4hD8xzfKV64xl3phdxhLu2LYHZaAslIPl36gDft83URZNFHHiZ5EgopwmiDT1ZylhGanKsx1NwO8U6uhDj61P62Gao5amBhyeAMlo858rGSGz2FykoqNlGltMgAkwASbABPyRAP4c4u9jOKmz0+kCUic6hvum5dvpU6V32h5zmjmP0wxxmLBw11K6/EDdEb1a9iI0+cWR1LR8IyqQrQBlTJOB6pSsSW+0epn+fu5Hypc2mPBv25VjtPvUXngNo5BCFQqUo8zpMxtx7PEfAvp4w/jDOMR4TOyjx2eusIkY2oH3nzG7DL8rs3bjNlqzYasrEZmGslAmAqgDdcHv08Z0UnCOotuqJhi26jGSo3UUU4LhNTyGPHvcI+BfCjX6CYx7bISUR8JCXvyMLIZHRJJ4+isd4YmOtxkAoodHp2iyROxhAkyACTABJuC3BO4HPpbHnjaRNyNDI7KlUWd14T8feh6OpTGnmfNYCsdx5OErJ4wS21VsRulTWyv+uYNzUecKzSmVkkKaY1dOGfngOXH5BO06vUcabGyGOCuDTbb2nNlHC4Uij023zt+8YGyweuvubZkf5dhvbHY55IqRdlvI6WXfuXeHNh7eTKsOrKVrodf0aLdc1IG8c7cvoE1HttDFW5eMtrhTAOpbd3gjzftvEeGYXB23O+W5I2Pm/DhC7evIBz5L966krcf/I+y2jriENPp408dfQtbtrK4du/YZSY0b1jH8zjyHjxyn5avW04rVG+jgoaPOxIx4c5nmugwBH/NInUHoDnqz7HUKxEsZeAyjxWiOEe2Wx4NMEIVxq9zkIeRfCrXdOcO5hrGLtg1aCETp6rFNmhpQbVMRMkJapkg7r2lA2KUksSA3lwkwASbABJhA3BF4ROqmWViGGneleldS2ZzRmx7NPrLEaSHmNHMepxniMOG+affuNEGuZ/Vfaf487R28UJrudTrZtGLEivHUc/KH0py/Yf3wYM3B9dRp5PPUfdL79N6in5dUth8AABAASURBVOWGXc1/G0AvTXiHbobdlAqzXsbCXctsyl++b40sG+l7zu6X8gPGv0U1fuhOA2YOoVfnDKUGv/SlTr8+T1DSbTLbBS7dvkzvTfmUmvz6nMz74bJR9PyML6jpKBEWZR67fNwuh23wzv0w+mL2d9R4ZH96aeZX9MHSkfKY6g3vRgt3LrEVjuOQmXPYvTDafXovPf1Lf9GWZ+mt+cPp2amfUPXhXemdyYPpwaMHlFD/9PGmj7+EqtdVPXv2HZbJmEnGpmIy4MLKkycXpUuTltKmTkN58+Z2IakmoUyUjZBeF/w+b2LUIYQOIn7m44gORvuiVRtTnJ7JIkpPgotkGPj91fi1Qh13J92+G2lhzTHqMYVtniQJATVJtUWQfwlBgOtgAkyACTABnyOg/33Ew+uHAapCjZnUxG5o5VwVqE5wQdmM30+upIl7pkq/2UIc0hAHWeSBP6FMyexFjKpm7FxMdx/cNcJx6ZmxZQ69MvsbOnrnikOx6y8dpgF/DaJ7D93b4fy+UBTfm/oFbbx0RJRlu4naodsX6eVJ/6MroVdFmuMv9F4ovfnPJ7Tw5HbHRBGz6fJR6iiU6sW7bRV6kSR/mB1/4c/36N+DawgbtclIzbof+ZjeWzyCnOXVxOLMOSseXLwx4ys6EnrZrsxIWnx6B304/Ut6/OSRXVr8BPXxhvGHcYha9HEJf0KbC5eu0P0H6gOFsmVKulV9powZ6OP3X6XBH7xGwZkyupVHLxt1oU63MiWakH5mohtgc47sVQojbHi0jPZhLZodjwj4iUKNzgLjCRtreaP7WiVbxYlHPjI62iKbh0kiIJOEHH6etJBl/YsAHy0TYAJMwL8IRNFjJVIecgpKId3Ett6q+qzRhG8Pzaa2c16iz9f/IA38iNMFzLJ6XHy7zco3pHSBKWU1/107Qf3HvUXL966ie4/UT4/JhFhax6+cpK9WjTdKaVagEv3Y9m1a9/pfNL7r59S3Qgs6HHKJhq3+y5Bx5fl2xVjad/0MDW7Un2b3/4mWvPQ7fdnsJcqozbCfDLtGv63806GIh48fEhTx/bcvyLQeZRvTX92/pJ3vz6b5A0bSB/X7iPgAqSh/uWw0Xb9zXYRtfz8vH2Ns4JY1ZTp6s2YXuRnbspfH0GdNBlDp4Dw0ZOkfdCcO+dm2IDoEZTpr6vQ0rPWbtPSlP2hO/5/p5WrtDYGlp3fSkj0rjHB8elJo400df+pdanzWF1PZly5HP1ApWjh/TOJep5vLNtfpdYHxmVGeFk0rEbqEXlW0VwioP5EkPMK2+VlE6XqIVqqNuBqwyqSmWNuQh7FOTU6xfqJQe3nKPOwDqrhq6zVGh6J9pPdYwxXS5mQR5B8TSOIEuPlMgAkwgVgRwI1hFEXIMlIovnG7UiFnWfq7wQeUWyhfaNiJ+7dp6oVt0sCPOKRBBrIIJ6QpmL0AfdX6dfleNOqFsvnG/GFUf3g3emvyxzRl00w6fe00krw249dNpodR6sqBWjmL00+9v6TWlVtSzuBcVLdkLfpfh3fo+cqt6frDMLfqgLI66plPqHf9blQmX2kqnKMwPVO7I/3Y4X0j/+6LRwy/7vlj5QTacPGQDEKJ/7TT+1SreHVKlyotlchdnPo36kXft3pVpt9+fI9GCKVaBjTr1NVTNE3MTGtB+qrtm/RKiwGEzdjAsUfdLjSixxcyWT9eGYgnK714gDC677fUrmorKpSjEJXOV4reajWQXq3e0ajx8CXXy9cNwVh69PEWJcYfxmEsi4t19lu3Q4wycubIZvhj8pw+e55gYpLT081lm+vU033OjTK3SA/oLtJUv2ojrBvnKrMu4eA6FuIg4s8RvvEXyufOgCe9RpPVHONQZFhaRhQ89ssxVAnVjla0IcmGCTCBhCPANTEBJuBLBBTtLj5CUf8+KqT4TPNq5KtK89v9Qp+U66otAUfbFOlHHNIgk1gNblWpOc14/ieqnauE0YTwiEeEGc4hq8dRq9Gv0DO/DpDvB0dGqSsADMEYPNioa8XJnYbUEKHEBgUGGWHd80bLl6hw+ux60KVbUyi/UITtheqVrmOUcTz0CoWEhxoiTyKe0KwDa2Q4e6r09EG7N0UPwXmQUYbVvlobKp4plwyvOrlLTGOo/QkR6w5vgSNN1zINqXHZBtJvtgpky0/vNO5njoo3f8cKTeRDCfsKOtVoZ0TtvXTM8MenRxE0Ub4x/rTxiLjEMA/vqcu9UXe6tGnhxGigSI/9ayrBwB9jBiFgLttcp0jywZ/elzXlWA+KltroGiKs/oSA+Kl+zTbChkdLcOV4IuuqnOSV5pcKNboCjKen0shjeKJLsIgSF24t3SrRSBWJ4gfJRL5eoQlsmAATSAoEuI1MIBkTwJ9Ez9S8hIeRIVUG6lWhC01oPYyO9JwmDfyIQ1rCt8i2RszQ/vnCL7TohVFyGXPFrAVtBDBzjfeD+415nW6F3bJJcxU4deUUQTmHTLGMOQkKJ/z2JlVQKqqar6R9tGW4Qr4ylvGILJY1LxxpLt66KF1Y2GjsmvZ5sFoFylJgQCCiLU2NAuVkPGapsVmaDAhrz/mDwlZ/tYpUVT0WdtVC5S1i4z6qrJidtyo1V3BOClTU4zt445yVSLzHYTxiXMZ7RXFYwb3w6Hf4zf44rCJRizJ0BnlipCXao7vCq/+0KM3RY6VrFaerJ5ZpMpdzC3lgnEsk3xS/VKi9P51OuokRrXmkIy2tKtVvdH7EiijxM01KyxBS2DABJsAEkhUBPhgm4C2BwChFZtXmYKSfLfcJFM1VVC5jnjZwNG14cxJ9+9Rr1Dh/BaOA/66dpHenfk4PTbuDG4kWnpvht43Y0jkLGX4rT5FsrtP1PNkyZNG9Dm5K0+y3edbtxp2bhuyC49uo6jftnZqZB9YasuduXDD8N0yf6yqcvYARb+/JlzWfiIr/2+Ws6TOLehx/eFiQUnvl4aGHKwocS3MvRh9v+vhzL1f8SaVKG71jffi9aEU5rms0l22uM67ribvyNN1BOOJn0imEV0agJsMjAsIvfsIjfppHc0SE3c9pgp0cB0Eg/q8QqCWxDfoEjCftcCZvE28TsC7dRsQmYCNvo2zbpHCACTABJsAEEpAAV+VDBBRSZ+aeJJAiQS7+Hbp2mDw1LopL8KTsGbNTx+pt6fdnv6fxz3xGuVOrOx9vuXKMVu5f51Z7Hj56YMhlTpPJ8Ft5MqVVy7dKi20cPnVlLgOz5s6M+f1nsyIe8jDcKCJzBmtlFgKYbc+ROj28fmP08aZo448S+V+WzMFGC65eu2H449pjLttcZ1zXE1fludYdTDqHyeu8bpOQyWsj7yzeRsgUgDyMKSq5ev1DoY6Ds6c/rbMqyqavyIBZWkaQTacXAS1WFhctrcbKSLaYABNgAkyACcRIIHkLBEWptylP6EmiHejUA7Op1JSu1GnlZx4b5INBGYl2ABYV1y1Vm56r2clI2XdB3dzLiHDiyZg2Wok+ed318uMzN12nO6nCrWizsl4qU26a2ud7t0y1olWM8rOaFP5LNy8b8fYeKO/68nL7tOQa1sebPv4S+zjz5M5pNOHk6fOGP6495rLNdcZ1PXFTnqozmHUIGSN0DL38aK9M0VZzC7/4GTK6x8KNLtsikaNsCKh/qWyi/D0gepn4xUzBXsg+LEqwidIDumtKl1HSEpH8YwJMgAkwASaQTAm4cVhY5K3fnKSKVD+XZZ5ldKOIOBMZtOpL+nzf1FiXhzLiW6k+f/MCDV3wszS/rxgfY5tL5i5qyJyOQTnWBXMFR280dvD6WXK1qdmJa/GnUGfLmE1vEmVIlZYqFarglsliWladI31Wo4wzLt5NPn8j/hQ4owE+5tHHmz7+MB4xLhOrmfny5KI0qVPL6g8eOird+LD0slEX6oyPOuK2TKE7iJ8sU3dtAqZIk1eKSMs+0j4shWwtKSIt23g/D2GM+DkC8+FbdxCXT2gsskRHRfuMWkSU+ImgbquuiCDt0ZH0ssUEmAATYAJMwF8JRCnq7XvKSHXJ94OoRwmOAgrwgqv7jXrb5SxPs5t94bb5vEJ3gtELgFINBV0Px7WbJmVq+mvPUmlGbJ1B2LjLVR2bjm83knNmymH4XXnwOSd91+yQJ/dp0oZpluK7Tu2h9ReiN/2yFIpFZIncxShf2mBZwq7rZ8i8A7iMNFnHr5yk63eum2JUb40ilVWPsBfvX00Rkeon2kTQ5rfqwHqbsD8E9PGmjz99PCbmsVeqUFpWf+3GTdp7wPEzajLRZAUERKs4Zr9JxMaLMlE2IvW64PdZY6M+6AFNY9GDNo1XI1XbJsGl/qGVaJcBQcuSkOCXJrq3+eXhe3jQFn1HjVJttTSzX4txjIruvDJNWPInLDUL20yACTABJsAE/JoAdOpUUeonme4lsEINZfpzbWZaV6SHNf2EyuQo7bbpXq4TwRzpOZ1QBk4mFHS8hw1/XJtsGbJR3dyljGK/XzyKLt66ZITNngU7l9A/e5cbUXWLVzf8rjwKKdS9SmtD5Pv1k2np3pXGpmbYOOzg+UM0aPZQioiyVlCNzLHwBAYE0jMVW8gSUM+7/35G9x7dl2GzdebaGeo6/i2qP6IPtfvlWXr0JPrBTMNStSiVkkKKb7x0hP5eP1X6zda2Ezvotx1zzVF+4dfHG8YfxqEvHHS1KtGb6a1ZtznGJpUuVZxaNG0gDfwxZTCXaa4rpnyJlS4VXak2CEv8ZDt0VwZUK3rZtxpWbbOgLEmNNttmEXM8+y0JsEJticXLSHPnM/uNqWe90+qJuutlfZyNCTABJsAEmECyJaBQughVoQ6PfJBoR9m/fBepRMemAShDz//n/pm6N87dN5o/T+lTpJLlQknsPPpV+nruDzRl4wxauGsp/bpsDL04/m0atHgE3X3yUMo1yleWmpVrJP3uWN3rdDa+cQ1l9q35w6nOsK70yl/vU+MfulPnv96hWw/DqXe5pjEUF7vkAU36UbviNWUhmy4foZf/GiSPEwr9vnMH6J+N06n7n+/S/cjHUqZ39faUMkVK6YeVMzgXvVyzI7zSDN84hV7/+0Oau30BrTqwlj6b/R29PvMrKpg+GwWnTCdl/MXSx5s6/hSfOOzcOXNQ7RrqqgLMJM9bFP1AyFkDG9WrSTDO0vV4lIUyEUYdqAv+pGWitOa60DV0EUia/QiziRUBv1Ko0XdgYkXMnNllYRaJdlHmoN79zcWznwkwASbABJiAvxFQFPUGXhGzoWmUNJQiKoAe0GPSl6EmBI+dV9XlyphZxqx0bOtEGSgrtuXElL9iwfI0/bmfqHRwHikql2XvX0FD1oyn9xb9TL9un03rLx2WabD6V3yKRvYdSikCUyDolsHs8C+9v6FWRaJntbHD9prz++jK/VAKTpGGhnd4lyrkL+tWed4KoR1fdf4f4YEAyth+9YQ8Tij0XSe+R1+umUAhj9SdvLuWaUidarSDmI15rlFvaqMdBx4OrDi7hz5cNoqTUYH/AAAQAElEQVRenTOUph1cQ/cjntC3Hd6j3NiMzSZn8g1gnGG8Ydxh/CliHOJoFUWBk6imRbOGlCU4WLZh2469tGLNJumPjYUyUBbKQNmoA/6kYMy6g1mnkG13iECsZSQSolfOqqFY2agFJlaFJLHMAUmsvR40F6dSN+5kg6yjnBFreCCjBlQb4WhjH4flT9Gpmk8Xkq6wxE+m6K4MsMUEmAATYAJMgAlkfJJaQrgTeU+6CWFhaXZ81ROfZaPNRXIWoYkDRtCLVdpS9RxFKSjAVlnGu8dQIoe3fpM+aP8WBZm+9Yz87pgMadLTT72+pOn9htPA6h2pQ/Fa1K1sY/q0yQCa8eJIalrO/Rlvd+pzJoNPWg3r/gW9UbMz6Z8B02WxnLtStkI0ustgGtL5I8vjRP7ve3xOgxv1N97J1vOXy5KPpvb9nqoUqaRHJSnX28bq40wfd96WEx/5UgUFUeeOrYyi16zfTJhdNiI89CAvytCzoexUQUF60LddXWeQrrDETzZYd2VAtex1EQsRYy2tjWatCWqOWpiN7TzFRkyWDlkY25TkEkrGCrWXp8jhXDtEWBcsxaRl0xcNYeMlBk1Gdi41VY+xzqjKsM0EmAATYAJMwB8JZIpMIw/7dqQ62ygDbLkkkDFNBnqnzWs06aVRtPvDubT4xd9pcs9vaNNb/9DKd6fSD0IZbls1WjGxL2xk32/pyCdLpSmVt6R9shGuUKAcvfHUS/Rd98/pi04fUM+6XSh/1nwyPfxh9AOQoMDopdZI7NeghywbdWAJOeKsDNoJGZhyBaxnvKHcD2zxAq14ZwqtfHU84RNai1/8jXZ8OJumvvIHNSxdz6poIw4z3b3rd6Olb02m5a+MpRl9h9PWd6bRzFfHUdn8ZaTcnNcnGO0NMi0bl4kurAAlwMiHY0iXKq2NtLucd3+8QCtnsU3++Ajo40wfd/FRh0WZbkcVLpCP+naPXqqP2eWfR01wa6MyvRJsQIY8yKvHoUyUrYd9342STVRt6RWWHtJcQ/cQSfpPS5I6h+HXE525doJ2QWe5/CmeFWqPz7bWizRHdkiHMoxEmxQZKy1TLhkWlvjZCHOACTABJsAEmICfEsDiUkVRSFEUSv8kLQVGKXQn6n6CLvtOLuhTBKagIjkLE77BnDVD1jg5LGzuteXYNjE14Pzm5djVk0ZduYJzGP748uA482XJS5UKVRDHW4Q8UXzRJuQvkC0/lS9YjoLTRX9vG2n+YrDcG+MM4w3jTlHUMaj4GIBSJYvRC/17GMu/8f7ztFkLCEoylnCfOnOOwu/dM1oNP+KQBhnIIg8EsMwbZaFMhN0zPiIlh5+wxA8t0hypZBh+JNgYqxQtTnNkATZ5OBATAVaozYSMjmSO9N5v9WDIKE3WJS0tyvwmhBbFDhNgAkyACTABPySgKOotvEIKpQgIpMxCqQaGm5FhcOLd6O87V81pPSvqTQP0jcnMn9LyppzEzjPnv4XU8qfe1H/aZzRm5Z9k9bkp7I49/ZD6ualAJZAqFow7jol9/Mm5fn18Ybxh3GH84XgVRYHjUwazya8PfNbYqAyNg5KMJdzjJk6jr4eNov99MUwa+BGHNMhAFgYbkKEMlIVwUjKqBqHaaruFX/xUv50tgi51EpHu8c9FXR6XlQwysELtzkm06DQ2UVpAc0wl6jG6shwd1oX0GBm2CcgYtpgAE2ACTIAJ+D2BLE/SSQbXI0JdzopKoTiw8IksfHMan72Kg+JkEdiYLK7LlAUnsFU+XykK0T5R9dOW6fTs2Dfo9xXjafHu5TRjyxz6aPoQ6vfvYMImX2jaS1XbUZ7MeeBl48MEcKeK8YUm6uMNfl82qYKCqF2rZvT6y/2kYp0mtbrfgqs2Q0Yq0iIP8qYKCnIl7rtpJp3B5BXt1UM4oyIorpiw7WeddSkjWQgZccJv/CwjjdR48STFQgOSYqN9p83mXqb5NcdVG21FREj8VHnDowbZZgJMgAkwASbgpwQwJ6YoCimKQmkiU1OGiNT0mCLpakRIghCBAhzXFcVHmXHdxpjKK5a7GI3s/D/5OSnI/nftJI3YOoPeWfgjfbJyNM05uhnRlC4wJX3f6nV6o9XLMsyWbxPAuML4wjjDeFMUdewpvt1s2Tp85grK8ScfvE4DX+hDT7dtQQ3q1qCalStIAz/ikAYZyCKPzJxkLU1nkI605JFE+2TQ2jKEDI+QM/tFkH/uEpByrFBLDNadyDpWZvDM0guycUVA/NSC9KdIaohtJsAEmAATYAL+TkBR1Ft5hRQKCAigHI/TE/5dibgt1OpIeNkkEoF6pWrT3IFj6KOG/eS3oEsH5yEs7S6cPju1LVqD3qr1jPx8V/tqbYj/+T6BSDGiMK7QUowzjDeMO4QVRYGTZEy+PLmoRtWK9FSzhtShfUtp4Ecc0pLMgbjRUFWNUG11pln4xU9mtXdlpPeWXpxjCc5THGWTb0zSUagT5Rx400nUPM7fVVDTE+VwuFImwASYABNgAkmUQPqItJTxcWo5S33xya0kehTJp9lpUqUl7NaNz1ZhF+z9Hy+gJW9PouE9h9DLzZ+normKJp+DTeZHgvGE2WmML4yzZH64fnB41rpGtG5ine4ajDd5XJeYnFKTr0KN864bd84YZN2Rg4wbstHvKujCqqvaKAQSIiR+MhTdy2WQLSbABJgAE2AC/k4Ac2OKohA+P4RZs5yP1d2Xr0SGUFjkfeJ/vkMA58h3WsMtcZcAxhHGE+QxvjDOcC4VRSEFkWx8l4CuOwhdwrzWVQS1Nus+e1dLtnJ0Uas0+zh3ZSGnG/sykkk4+SrU8XKC0BusCjZ3Y7t0kUX8oiNtAtHRiezj6pkAE2ACTIAJ+BwBRbG9pU8blYpyPcwg23k+4oZ02WICTMB7Avo4wrjC+DKXpCi248+cxn4fJmDSNaRXWo7tVaNV21mqYzzHWBFghdqKijnOop+pUaptFlXfX7CJiQ7YiIuA+KmJJmVcf9KkJrDtlAAnMAEmwASYgL8QwC29oijRs9RPMlO6iJQUHvWQzj65TvyPCTAB7whg/GAcYTzlFOOKZ6e945gouTSdQVUnVFvVQzQ/GmXyImhjLNNMOolZ2FLWLMB+Vqhj2wfiopNpZWhObFvE+X2NALeHCTABJsAEvCagKFCpiRRFkYbEv/wPsgib6FpkKF1LoF2/ZYVsMYFkQgDjBuMHh6OPJ0WJHmOKoiCJjY8SMHQGwxOLhsZFGbGoPjlkZYXa07PostOpidpDI4uS1XQkRPscQ4hhwwQSiwDXywSYABPwNQIB2s29Qorc8TsVpaSC9zMT/p2NuEG3I+/Cy4YJMAE3CGC8YNxAFOMI4wmz0xhfiNPHG/xsfJ1AtEYR7UObbUOIgYnWUazTIaPOdEsfW24SYIXaTVCeiemd1N41lyLSxM8cw34mwAQ8JsAZmAAT8BMCijhORVGMpd/BkRkoz4OMhH8nnlyhkMhweNkwASbgggDGCcYLRDB+MI6gTPNGZCCShI3UKaRldxB6nL1rJ8bBWBFghdptfHpHdMzgNEUkiJ+RQfWrth5phKIfGelJ7DIBJpDsCPABMQEm4C0BRYFKTaQoijRQArI9yWRsUnb8yWWeqSb+xwScE8DMNMYJJLAJGcYPxpGiqGMK8YqiwGGTFAhouoOhSxhttn0XWqZLyxAwPE6itXTXqZoQO4KAXyjU6A4w4njd/tl2xehsnpYTnVP49My6y2sqBBT+MQEm4LMEuGFMwMcI6EtRFVJkyxRFoRyPgymntvP3CTFTjXdDZSJbTIAJGAQwLjA+EIHxgnGjKNo40saTPr4gwyapEdCUC82JjYqhF2FPwJluZC+nh1EOjB5Ozq5fKNSJfgJd9SYtTXVUO9Hbyw1gAkyACSRBAtxk/yAAFUBRFGPpt6IolFMo1bm15d94NxS7FxP/YwJMQBLAeMC4QADjBONFURS5HwEv9aYk+s+k3rpSH1ylJdEj98Vms0Idm7MiO6m0KOYnQZqcQ32meJPXQYwjmAATYAJMIDkR4GPxkoCiKHI+TVEUG6U6+5NMVPCeulEZdi8+9Pg8hUXeJ/7HBPyVAPo/xgHGAxhgfGCcKIrioEwrikL8LwkRsNEZbAKmg3AWr4kYycIjflosO14QYIXaC2ixzcJ9NrYEOT8TYAJMgAkkLAHfqk1RFEulOlNkeioZnovSRaSk8KiHdOTJRTr/5AZFiv++dQTcGiYQfwTQ39Hv0f8xDjAeMC4wPhRFYWWaku8/1jES59z6uUKNbgfjKXxP8ljJijjx87RWlmcCTIAJMAEmwARUAoriqFQHBgZSakpJRe7lMN6rvhIZQvsenaErEbfJtEhSLYRtJpCMCKB/o5/L/i76PQ4N70sXEeMB4wLjA5uQmZd5K4oCMTbJgYDULaRldzRWcXYiRtATWT0T8sDoYf9z/Vyh1k64sz7gLF7LZuuowlHajnv2a8DVVJHD8JgkjDwinX9MgAkwASbABJiAWwQURbGZqVYURZ19CwiQ71UXC89OGR+lpsdihvp8xE3a++g0XRTug6hH5Ev/uC1MIDYE0J/Rr9G/0c/R39Hv0f/xvrRUosWYUBRFviahKNHjhvhf0iag6RAm9cJQMGzi5FGqMc50FSnizFKzOqY6i3eUTNYxrFBbnN646htxVY5FEzmKCTABJsAEmAATEAQUJVo5wMybNJrykI7SUMGH2ajwvayUIUJVrC+Jmer9j8/R0ccXCTsfQxkRxfDPfQIs6QME0G/Rf9GP0Z/Rr6FIo5+jv6Pfo/8riqI+ZFICWJkm//0XVzpJXJWT3M4EK9SWZ9S+u9iHLTPZRtpnkWFpaXLRftWn2loiO0yACTABJsAEmICbBBRFEcqCQvinKIrwB5CxvFUo1xki01Khe9moSHg2yvooLQVGKXQn6j5h52MoI/sfnaVTT67KZeEhkeF0P+ohPY6K4CXilBz+Jd1jwBJu9EP0R/RLLOdGP0V/Rb9F/0U/Rn9Gv0b/Rj9Hf9dnpeU4EMq0oqjjA5/GUhTVn3TJcMtVAughqk+1zbqE8IufGq/Z9mEt2rVjn8k+7Dq3v6SyQh3fZ9pVv3OVFt/t4vKZABNgAkyACSQzAlJZEMekKIpUqvXZaqlUCMU6fVQayvMwC5UOy00F7mWmzI/SUIqoAHpAj+lmZBhhuezxJ5fpwOPztOfxadrx6CT99+gEG2aQcH3AxBr9D/0Q/RH9Ev0T/RT9Ff0W/Rf9GP0Z/Rr9G4q03t9l/9eUaajQGB/E/5InAVc6hau05EkjwY+KFeoER+6kQtHZxc9JIkczASbABJgAE2AC7hBQFEUo01AfiBRFEf4A1QiFWlc0AgNTUHBkesr3MCuVvpubiofnpHz3gyn7w/Tyneu0EUFS0cbMH/E/JpBIBND/oDijP+KdaPRP9FP0V/Rb9F/0Y/RnZ4o0mg5FWlHUMYFwXBouK3EISJ1BWolTP9dqSyDANsghrwh40KFtRW1DAPG6FAAAEABJREFURPZhr1rDmZgAE2ACTIAJ+D0BqUQICoqi2CjW0Up1IEEJCQgIpDRRKSlLRAbK9ShYvnNd9F5OOYtdOiwPlbuTlw0zSJQ+gP6H2Wf0x4IPs8n+iX6K/op+G2DzkEj0ZyVAPjxSFEX2eUX0f4wD4fBPJZCMbHudIToc7XPjcD0SdqM8PxUJ8NPj9u6wHTqd/bsL7hTrUIg7mViGCTABJsAEmAAT8JCAoihCwVBIISJFUaTRl8HCDQwMJF0p0f0ISyPSEMcmkJhB4jEICAyUfVT2SU2BxvlAWLqKqkSjPyuK2scVIrXfi7Dw8i/JEvC24Z7pGqq0ahs12gWNePZYEgiwjOVIFwS0HqY5LgRNSR4Jm/KxlwkwASbABJgAE4gtAUVRpIKB2TqFSCrWiqKIuGhlBAoJFJTAQBEnFJcANsQMfKcvoF8GQrlWRJtMRlEUtT8Tif6sSKMoCvE/JqAS8EAHMUQNj1qEu7Yfy7FC7ccnnw+dCTABJsAEmIC/EVAURSod9sq1oiAeykogBQYEUgqT0gJlmw3YsEnofoB+iP4YoASKfhugKs+iryqKQgqRiFOkURSF+B8TYALuE4hLyYC4LIzLsifg5AmPOTrKFDB57UviMBNgAkyACTABJhC3BBRFkcoIlGsYqCS6IZGmKIpw2CgKM1CUxGEgOiApRIZBP9WNoiCF+J8/EjDrDG7pEuYM/ggsfo85ARTq+D0ALp0JJBSBKHHBYhNFzIAZcB/gPpBc+4D93xOoK2zIUOaYRcKzILt/VmPPToSDTIAJJDABVqjtgSdQmJ8TJRBoD6qx+iNljvOgKBZlAkyACTABJsAEmECCEDDfq1j5E6QRXEmiE2DdIvFOASvUicc+TmrmQrwnYP9Hx/uSOCcTYAJMgAkwASbABHyTAN/v+OZ54VYlHwKsUMfJubR/JmQf1iqxiFajVFuTSs5Ooh+b+Y+KuTEPHj+h0LC7dONWCF2+eoPOX7xK5y5cYcMMuA9wH+A+wH2A+wD3gSTVB3APg3sZ3NPg3gb3OOZ7Hmf3QmYZ9icVAlFkqUVYRuKY7BPsw5Bh4ykBVqg9JcbySZKA/sfD3PiIJ0/o9p0wunDpGl0TSnRo6F26d+8BPRbKNeSJzNLsZwJMgAkwASbABJiA7xPAPQzuZXBPg3sb3OPgXgf3PLj3MR8BZGHMcexnAkzAMwKsUHvAy9tnOGo+1XZWnetUZ7k43h0C9n8oIiIjKSTkDl28coPC7oRTpAinSpWSsmUNpgL5clKJogWobKkiVKFssaRluL18vrgPcB/gPsB9gPuA3/cB3MPgXgb3NLi3wT0O7nVwz4N7H9wD4V7IfA9lf69kTmO/bxKIWXeIsp69duNwYi7bjUL8SIQVaj862f52qPjjAGM+7rv37tOly9fpzt17Mjpz5oxUtHBeKlmsAOXJlY2CM2Wg1KlTUmAgDw0JKB4tLpoJMAEmwASYABOIewK4h8G9DO5pcG+Dexzc6+CeB7XhHgj3QrgnQlg3uGeC0cPsMgEm4B4B1hrc4+SWVJTpcY7Ja5HXLtUuaJGBozwggD8GMOYsQIwnsrduhcrPPmXKmF7OROfPk4PSpU1jFmU/E7AiwHFMgAkwASbABJIsAdzr4J4HM9e4B8J9Eu6JcG+EeyTzgSENxhzHfh8lYH/yXMxJm0XNOouPHlmSahYr1EnqdHFjYyJg9QcAF5DrN0KMWem8QokumD+XnImOqTxOZwJJkwC3mgkwASbABJiAIwHMXOMeCPdCSMVsNe6RcK+EsNlY3VOZ09nPBJiASoAVapVD3NpWVyX7GhxkHCLsc3A4BgJWF/5I8Qju+s0QevDgAQUFpZDLu7NmzhhDSZzMBJhAghLgypgAE2ACTCBBCeBeCMvAcW+EeyTcK+Geyb4RVvdW9jIcTiwCdrqDXdCyVe7IWGbkSFcEWKF2RYfTkgwBqws+/jCEhoTRg/uqMl24QB5e3p1kzig3lAn4LgFuGRNgAkwgORDAMnDcG0mlWtwr4Z4J9072x2Z1j2Uvw2Em4M8EWKGO07Nv99jHLhinVXFhBgGrCz3+IITfu09h4ermY9jpEsucjEzsYQJMgAn4BwE+SibABJiAUwK4N8I9EgRwz4R7J9xDIWw2Vvda5nT2+zgBB53EIcLHD8C3m8cKtW+fH25dDASsLvD4QxAVgU9jhcnceE8IT2FlgC0mwASYABPwYQLcNCbABBKaAO6RcK+EekNCwgj3ULiXQthsrO65zOnsZwL+SoAVan8988n0uPU/AKF37hq7eeM9oWR6uHxYTIAJMAEmkJgEuG4mkEwI4F5J3/0b91A4LP2eCn42TIAJOCfACrVzNnGXwqsq4o6lqST7J6U65sePn5D+bcWc2bOYcrCXCTABJsAEmID/EuAjZwKuCOj3TLiHwr0UZPV7K/hh7O+9EMfGhwnYn0AfbmpSbhor1En57HHbDQK4XuAiDxN+/76Mz5w5I38aS5JgiwkwASbABJhAkiPADU5gAnifGvdOqBb3UrinkgYRbJgAE3BKgBVqp2g4wZcJ4AJvbp85fO/eA5mUJTiDdNliAkyACTABJsAEmED8Ekgepev3Tvq9FI7KfI9lFUYcGybgzwRYofbns59Ej93hwq4dB+IfPHxEkRGRlCpVSv5ElsaFHSbABJgAE2ACTIAJ2BBwEsAGZbiHwr0U7qlwbwVRrASEqxs9Xg+zywT8mQAr1P589pPBsesXeP3C/ujRI3lUGdKnlS5bTIAJMAEmwASYABNgAu4T0O+h9Hsq/R5Lv+dyv6S4k+SSmIAvE2CFOtHOjtVlySou0RrokxXrF3Vz4/S4yMhIevT4iUxKmyaVdNliAkyACTABJsAEmAATcJ+Afg+FeyrcWyGnfq8Fv26s4vQ0P3cT4PCtdAaruARoCldBrFBzJ0iyBPTLhvmCHvEkQh5P6lSsUEsQbDEBJsAEmAATYAJMwAMC+j2Ufk+FrPq9ln7vhTg2yYUAH0dsCbBCHVuCnN8nCOBCDxMRESnbExSUQrpsMQEmwASYABNgAkyACbhPQL+Hwj0V7q1g3M/Nkkwgngn4YPGsUPvgSeEmWROwuqDbx+nhwEDu2tYUOZYJMAEmwASYABNgAs4J6PdQ+j2VLmkfRrxVHOLZMAF/IuBK6/AnDnysSYyAvuQIF3IY+Y5PpDo7ncQOhZvLBJgAE2ACTIAJMAHfJCDurXCPhXstGDRSvweDnw0TYAKUnN6h5tPJBJgAE2ACTIAJMAEmwASYABNgAkwg4QjwDHXCsbatiUNMgAkwASbABJgAE2ACTIAJMAEmkKQJsEKdpE9fwjU+sWvSlxmZ22GOgz+SEm4R0p07d2jqjNnSbN32n7lZLv1Pnjyh6TPnynwrVq51KcuJTIAJMAFXBEJDo69DuCa5kk3ItFG/j6OCxSrQ2+995HW1O3bsktfJNWs3eF2GNxlDQkIJdf740yh6850PaOSvo2n5itV048ZNb4pLsnkWL1kh+R88dDjBj2HlqnWybv1vrO5OmzmHkHb4yFG6e/dunLcrLvptnDfKBwrEvRXusfSmmP2u4vQ0dpmAPxBghdofznIyO0az2owLO4zdIcZ7MGPGjDThr0nUu/cAeqptF7p89apbdY4ZN5F69npO5rt5+5ZbeViICTABJmBF4MLFi/JaguvQ5SvuXYOsyonLuIiICPr40y/p4vkLNHLkaDp16oxXxU+cNFUe2/fDf/Yqv6eZrl+/QR069aBsOQtT85Yd6P0PP6FRo8bS2+9+RK3FNb5wiQr0+ZdDyZceXHh6jJ7ID/rwU8l/waKlnmSLE9kvv/5O1o1+bTa9ej1PT7XuSOUr1qZsuYtRzz7P06rV6+Okzrjqt3HSGB8tBPdaMHrzzPdiehy7TMBfCbBCHYsz79XFxFkmZ/GxaB9njV8Cv/40jFKkTEl374TRx4O/jLEy3LB9/PlXUq5p80bU/ZlO0k/ETlwSwKxd9jzFCWb9hk1xWTSXxQSYQAwEAgMDqW/v7lKqfoO6VKhQAenXLV8cn2vXbaDKNRrQokXLZDODs2SmevXrUIcObahs+TIUlCoV3Q+/T1999T2VrlCTjh07IeXYil8CGTJnokqVKximfMVylC1Hdlnpk0ePaPr0OdSy1dP00sC36MGDhzLeWyumfuttuZyPCcQrAWe6g7N4F43xIouL0vwviRVq/zvnyfaIzU9OE+IgS5QoRh++/5as6u+/p9DmLduk35k1+LOvKOx2qLw5G/nj987EfD/ex1sYRVF0++ZNaR4/jvDx1nLzmEDyI/DLT9/R1UsnaM2KBRQQYHub4Wvjc936jdS8VSe6cukKZc2ejSaM+40unD5Ea1cupFnTJ9HeHRtF+CC9994bFBgURFcvX6V2T3eja9euJ78T52NH9FSzJrRj61rD7N6+nq6cP0phoZdo+rSJ1KBhPdni8eP/plbtutDjx49l2FvLVb/1tszkkC+h762SAzM+Bv8jYPuXzv+On4+YCcSKwAeD3qKiRQvLMt5850PCsjEZsLO2b99JEyZMkrFQwqGMywBb8U6AK2ACTCDhCWTNmiXhK/WwRnwK6L0PPqGoiAh5Hd+yfjn17dOdUqdOZVMSjmXo15/TXxN+I0VR6OTJ0/TCy2/YyHAg4QikSZ2aOj3djlYtm0eDB78vK96wfhN9/8MI6Y+NhXMdm/yclwkwAf8kEOCfh81HndwIKFGJs1gFf9hHjhgmce7etZfGTfhb+s0WbtreePsDwlPeYsWK0PvvvWlOtvHfvh1Cy5avojHj/qJJk6fSho2bY3zqfvTYcbmJzp69+23Ksg9gWeOatRvoyrVrNkmYaUH8ps1bjXi0Y8asefTNdz/Q2bPnjHhXnocPH8l2oKx79+4ZomfOnKXJU6bRosXL6eZNz94b3717r9yc5vfRE2j+wiV07tx5o1x7z+WrV2X9q9dEv1O3avUaGYc2uXqXE23HTNXEv/8lGDwACQ8Pt6/CaRjLDXft2kN//vWPPFYsNfdytsShjtOnz9CSpSvojzET6O9JUwnnCX3KQVCL8PZ83rp12+h72DjvwMFDhE30tGJj5aC96KfYVGicmE3CJk8hoaGWZaIf43zt3LnbMt0cuW//QXl+cb70eJxL5IeJq36IvjN3/iJ5DvDOJsaHXl9MLtoTm76F8rFB15SpM2T/Ap/Y9i2MSfBBP0X5VubSFXU8Qc7ZWAgLC5P8IWM+nzjXiENb9bJjMz71MsBy85ZtNF48nMQ5R1hP88b9Z8p0wnVbURSa+OcfVKRIIZfF9OjamV577UUps1hcz85duCj9ziz0E0+v5/ZlYfzPW7CYfvtjvNzQcu++A/YiLsNgtHrNBskM4xoPA/C3CJmsrhWI98TE53UjpnYoikKff/Ih9evXS4oO+WqY5d+Ibdt3yH568fIVKYfrEf62/DziN3m9lpHCsuq3Ipr0v51gh7ArgzGFvn/8+EmnYvhbgSEGh0kAABAASURBVI3Wxoi/85DF62BOhX0kIbHusXzk8LkZTCBGAqxQx4iIBZiAawItmjehZ57pKIU+/vQrh91g/5o4hXBDDIFffv6eoITDbza4QX77vY8oX5Ey1KbdMzTw1Xeo//MDqXHTtlSsdFWbP/rmfPD/Omqs3ETno48/R9CpeartM1IOf8DNQus2bJbxz/R4Vka//OrblCNvcerRsz99+unXdPzEaRkfk3Ur5LYsBxv6nBc3mngYUKREJSpWsjI92/8V6tCxO+XMU4yaPdWBcCPuqryNm7ZQtVqNqHqtxnJzmtffeI86de5FRUtVoS7d+5HVDcha8bAAdXft1s8o+vthI4w2/TlxshFv9kDBK1qqEjVt3p6ef+FVaerUby53KUYabr7M8mY/ztv7H31KmbIVoBq1m9ALL70uj7VJs3ZUtkJNWrFijVncI//uPfuo0zO9qbg45nYdutFrr79Hzw0YSA0bt6biZarQzNnzLMvz9HziGN4Z9D/KX7Ss0fewcV6lKvWoco2GhJtJy4pkZMwWFMGsuYpQ2fI1CZsKvTzwLXWTp+IV6aefRzkUsHDxUnnOGjRr43InX6wGwTJPnPPJ/043yonLfnjh0mXq2KUXlSxTlbo800eeA7yzmV0cT8MmrS1v3o2GCA/6j7d9S2QnfRzUqtuM+vZ7SfavauKcFCpegaBQQsYbc/jIMckY/RTKtVUZP/38q5QB34VLlluJ0Nx5i6RMyzadiUzPNK2uSd6OT1QMBXCg6P+ZcxSiBo1a0UuvvEkYo8HZC9K33/8IEa/MZ0OGyny9enWlWjWrS39M1ttvvSaXfqNNU0z9zpwPY8rb67leDvre0517Uglx/e/cpTe98eYgwrisWr0BoT/8999OXdSpO1k8yCxSsiK1eKqDZIb86Mv1GrYkKJf21wqnBVkk4Bjj87phUaXTqO+//YLSpk9HEY8f06zZ8x3knnvhddlPl4iHIHjIk79IWfm35b33B9PYcRMNeat+i8Svvh0u878g+h3Czsyhw0cIYwpjZu9+xwcf+njG3wpstjZQ/J2HbN5CZQh/R2L6u+isXo5nAkwg8QmwQp3454Bb4AUB3Mx4kS3esgz7/itKnzEDhYhZvk8+/9qoBzMUHw4eIsNdu3YkKN8yYGcNfP1duSPuw3sPqETJ4tSpSwdq1aqFfKcPu+X2f26gUwXKrqhYBYcN/4XG4QYjMpLKlCtN1apVodSpU3pc5pGjx6mjUEAuXLxEtWvXoKefbkv5C+SX5awVsyVPixvEe/fvy7C9tf/AIWrXsQft2b2P0qRLIx4qNKBu3TpR1aqVCUsz585ZQLjRNM8+oozcuXJS27ZPUd26tRCURlEUGYf4koKrjDRZ/4gbYih4Vy5dkUs5a9asJm6IGsr33HEukdZVPFgwZTG8qB+KxI8//ipv5HLmzkl9+vSgjp3aE/yY1eze53k6LxgYmdz04AFMrXrNaf78xTJHhkwZZbkoO0euHHT29Dnq2ecFOesvBZxY7pzP18SN+i+//EHoeylTp6aWLZtR5SoVJY/DBw9TsxYdaOSoMU5qcB39wf8+k4pgWOgdecPbvn1rOZtUslRJQtygDz4hfJ7HXErPbs/IINrjTJGDwLr1m+X7rPD37tEVjoNx6Ice9EPc3LYXD4EWLFgiV5dggyT04wYN68nNCDdt2krVajclzD47VCwiYtO3RHbC7sp4txfjAGG839uuXSvKki2bPO7GLdvRfnF+kOapaSiOAWML+Zx9vm/xkpVIlmbFitXStbeWLldlGjWqS8HBmeyTbcLejE+9AOyuPWbMBEqfPj2hDzVqXF/2p8cPH9Inn3xFP/3s+GBGz+vMxWqZc9rqm65d3N8gskC+vPTw7lV68vAWfTjobcviY3s9x07i6HsLF6o7bOO6hGtgw0b1CWMU14fWHbq73BxtkVAe+w94TfYVNLJYiWL01FPNZf5t23ZQk6ZtKDTEepUIufEvPq8bblRvI4Jl2q1aNZdx02bMka6VdeXaVeoo/vbgPXiM5zp1alKBAvmsRG3i+vXuIcNYVn7exfUcKwAgiLLbtG4Jr2Hw+bF22t81RGK1GsZzpszBFPnkCeHvSOUaDci80gNyvmp87R7MVzlxu/yHACvU/nOuk+yRxnThjik9IQ48X57c9OXnH8uqoJDqy1U/G/It3bpxQyrbw76PVrSloGYN+fp7+vPPyaQEBtI//4yng3u30vR//qQFc6fS6WN76JWXB8gb+j7PviyX+2rZ4ty5duUaYZb73Xdfp2uXT9K+nZto66aVVK9ubY/r6tF7ANWsXpVuXjlJG9YupZnT/qbjh3fSRx++I8taJ2aTsaRdBkwWblbadOgqla0mzRrSscO7aMXiufTP3+No2+ZVtGXjCqlQ4Iawz7Mv2byz3qhhfZo7awrNm/OvUeLSxXNkHOJ79+xmxMODGfTnX3wDXtmuyxeO0ab1y2n5ojl08+opGjJEPZ9Q4P+dPkvKma2ly1fR+nUbKV2G9LRsyVzCRkZ/jhtFM/79i44e+E8q8qG3Q+j5F18lV7Pc5jLhx810r74vSCUdyvPqlQvo2sXjsly9bNwY4yYMN7XIY2XcOZ9QuLGhD3arR9+7Ic7XovnT6b8tawg8sMsxyv5w8OfyvVH43TV4tQA3iZD/YdjXdP3SSZo9YzKNHzOSDuzZTJ999iGSaMDLr9usOChSpBBhh2UkTpvmyB3xMDNmqTfOUM5r1KiKKAfjbT/EUvdefV+kfXv2U3CWzPL8Xjt/TPbj1cvn0yExRqGgYGy/PPBtOT7Nlce2b2Ep7rPPDyQojLjxXr92CV06e5jmzPyHLp87TOvWLKbgTJnkjLW5Xnf9adOkoZbNm0rxpZpSLAOahVcrjh45qoWIloq+bn+dBaOly1dLmXatW0nXleXp+NTLWrdhCw39/mf6d8qfdPXCUdmHVi6dR4f2bycoRJDDg5kbN27C67Y5cfKUlFUUhRoLBV0G4sCK7fX80aPH1E08xEPfy503N/23ba28LuEaiHeGj4nrKB4aYuPFdk42R8Oy8B7iYR4eQGIMH9y/jY4IXgvnTaMbl0/QxL/+oFNnztG7Hwz26ojj87rhVYNEppZNmwibaPfe/Q7jUSYI64svhlJkVBRtXL+Mborr0fo1S2jSXzE/LHy6Qxv5cBdjYPYs65VBoniaOnUmHOrxTGeblWi4Frbv1EP+XWslHpQfObiDYDCecW2fP3eafNBx5tRZ8Tf4C1mGL1o4flftiindVV5OYwJJnQAr1En9DHL7fYbAKy89J2f28EcFG5ThHa3fR0+Q7ftSKNt5c+eSfrOFJWBDhqjLDv8nlM1uXTrKmUFdJm3atPTj8K+peo0qhJvrTl37xvrzIHrZVi7eD/zumy8os3hqbpXublzJksVoxrSJlCFDBiNLihQpaIjgUKtWdRm3a/de6ZotKJ+XLlySSvPECX9Q7pw5zclUXSjp40arG8/Mm7eIfvt9nE26uwG8E9qpaz/Cp1deeKE/ffnFYMqWLauRHQrH/z54l956a6CMe/Ptjwgz0jKgWfPmL5K+Zzp3oKZNGticN8ykjRs9kgYM6EcvPv8sPX78RMq6a737zuuEWbh5QoFqUL8uBQUFGVnBdNh36qqH8+fOE5QvI9HO4+p8bt32H/1vsHrz9uf4UYS+h+PWiwCPSRPHSKXl4b0HhOWdepo77uJFy+WNbYGCBejNN16hVKlSGtkURaFP/vc+vf32q/TFJx8Z8bqnb6/u0rtk2SrCKg8ZMFl4L1SfDXq2jzp7ZEo2vN72w59+/o0WL15GeMj176Tx8vyazwGU/rG//yzrwbuSeEdVBoQVF31r2I+/EB7GYFfpSX+Npjq1a1KgeOAmipdu3Tq16O8Jo+mBOC+I88a0a6MqwStXryPwNJehz1o3b95YjkWs4DhgNxv+345dso3I10YoCUQEb5ybRw8e0NjfRxDGmaIoRvl4iDlh7CgCI0TuFg8/4LprdIU6ixj3Vq/huFuOWS4urufDf/rFeFXkz7G/UaWK5c1VEI4bfQKrVvBOL17RsREQgX7Pv0L37obLd8InCEYlSxQXseoPf1N69ehKn3/6AYWH3VUjPbDj+7rhQVNsRPPlyyPDEY8f061bt6Xf3kqdNjVtFA+jatWs7rD7vL2sOYxrbpdOT8uof5085Nu5czedOKE+pOnTq6uU1a0XxINbrCqqUrUS/Tt5HOEhmZ4WKMZ1azG7jnjEjR37l/GKGMJsmAATSBoEApJGM7mVTMD3CUBhHDViuFSstm79jxo1byeXKGP5LJRtqyOYMlWdgStVphQN/ug9KxGpTP057jeZdvP6DVolboBlIB4sZ0tnPa2qfeuWZFbO9PyKolCbNupSuO3ihlyPh3vh0mVas2o9vDTix28clGmZIKz2bVtR9+6dhY9o0pRp0vXUwowbZniw7PXnH751mv2N11+RaZiJPGr37dkw7WZ06/adZDUDDYX0j1E/UZdOHWyUSVmgCytjxoz04oBnCbNweIBgJVq8WFEKEA8okGb1YALxMK7O57/TZkqFF0pTj64qT+QxG5zDV15+Xkat27BZysuAG9bdu+rN+kVxXs9duGiZY9jQL+kF8dAhe/ZsNumdOrWTMzZ44IH3dG0SRWDlqrVSmVMUhbppfUFEO/y86YcoZOI/U+HI89C8WSPpt7fq16tDa1cvooViRj9fvtxGcmz7Fh7ITZ85T5b35usvyYdIMmBn4SEO3v21i3Y72PKppvJaBaVqy9ZtNvmWrVotw127dKLWQg6BVYI5XN0sX7lGevFqCB4wyEA8WHio0fHpNpYlQzEpVUpVFvfs2Wcp4yzy2PGTMilXrhzSdWYdPnKUsFzXyuC1DnO+uLie/z1ZvabhYVyzpg3NxRv+AgXy0/fiwSciFi1ZYaNAHjl6jA7sO4gkGvHTd5QpU0bpt7ewXL1QkYL20TGG4/u6EWMDnAhkFw9G9KRr16/rXhu3SaMGlD9/zEu8bTJpAX2FE5bb64qzliSd6bPmSrd48aI27+NjM76lS1fINPytwcNWGbCzOrRrLXeaR/QWcf8Alw0TYAJJhwAr1EnnXHFLLQjg5tMiOtGisPT0xRefk/XjRlVRFIKSDWVbRtpZq1apN6UNxM25eQbMToxKlSxBWP6H+DXrVKUT/rg0iqJQ5coV46TI6jWqOS2nkJixROLhw8fgGGbDhk2GwtagQT0j3srTtLGq5OzaucfmZtJK1ipu5ap1Mhqz5eaZUxlpsvC+ZB5t5uPYCfUGXE9u3LC+9B45dIR693uBsJOsjIhHCxtx4SZ++E8j5Xt3qOratRtwHIyiuD6fy7XluvXq1XbIa46oUa2qDN69E0aXrlyVfnes+qJcRVHk0vVuPfrR7LkLxEz9Y3eyyuXMnTQlaurMWQ55ps+cLePwWgDOkQxYWN70Q7x2gHOK4urUVldTwG9l8DrEUy2bkXkGcGUs+xb2aO66AAAQAElEQVR21ce+CagPM2lwnZmqVSo7S4oxPleOHIT9DSC4QlOO4cdmUyu0zfSaiRlqvFOP+GUrVsExzBKhyCHQUSgCcOPLVKpYzmali309RQqpSuHR48ftk1yGU6QIlOkP7z+QrjMLexlUrFyXrEyvfgNsssX2eo4HTye0B3eNGzewKZvsQo0bqdcfzMhu2LTFSN26dYfhr1FdHbtGhMmDmdEqVSqZYtzzxvd1w71WOErdfxB9HvEg0FGCxMOpKlbRbsU1aliX8mrK+IzZqvKsZ8QD1X+1mes+fbrLB1V62rr16t+1oFSpqEpl17zr1Kklsx0+6llflpkSyPK1e64EOmyuhgnESIAV6hgRsYCvEvDVC/vXQwZTqrSpJTbMINVw8n4nBM5duASHypUtLV1XVoVyZWXyxYuXpRsfFm6y4qLcLC6WjAcGppBVQDmUHs26fElV1oKzZCar5fGamHRKly4hXViXr1yB45G5dEnljhnxUmWrkStz48YtWfaRI7YPAF4SD07qN6gr06ZPn0N167eQ5bz86ts0beYclztUy0wxWLhJw1LiwZ9+SR069aASpatQ2kx5pDt48Jcx5FaTXZ3Ps+fVWePPPvtGttsZg9btuqiFCfuYBzd6eDjz/qA3RS6i/7bvIuy+nrdQWerW+zn5+SmsSCAX//QZodWrNxBmeXRRLL2fM2+RDPbTNguSAQvLm354Rcyo60WV18acHnbHjW3funL1mlFN6VLR/dyINHnwoM0U9Njbvm1rmWeRNoOGwPb/dsp3PctVKEv58+ahZo0bSgVh7frNxmsPeM0AS1wh37q1uuIE/vgw2WL4nnWgtlIjMtK0zbgbDcmVI6eU8uQhkczgwort9fyq9lknVFGmVEk4Tk3hwgXlKg4IXDblu3JNvY7mypOLsFkX0p2ZcmVi/rtjn9fd64a31w37+twNX7se/WAxe47sltmcPdi2FLaLxLW0r7aUW1+JoIts2ryV8KqSoijUq7u6qaKedln7e41XtipVrevyWjt/4RKZDasipMdHLV+99/JRXNwsPyHACrWfnGg+zIQjEBycidKlTS8rzJ8vr3StLCgG+COLtPz5ncshHaZAgXxw6FbIbekmN+vWbVVxLVQwf4yHltfENcSLnWqxw69eCZbvuTJ4hxOy5ptWhFOmDKIVS+bQsO++JGyMhTiUM27cRPl5qJz5S9CHH3/u1TvvuEErXKKS/NzN0O9+okWLlhFmplFH2fJl5LvH2O0XYW8M+p5+XMiPdjszeE8TMjBXrqo36/C7Y77+8lOaNXMyNWhYTyplWDo/a8Zc+fmpwkXKET4Lhs/3WJXVtElDwqZs2Fhp9uwFhshiofzh/dB0GdITlkkaCXHkuW3qT67Gr7PqYtu37twJM4rOnctx3wUjUXhy53a9XFmIuPy1bt1cpmOJsP6AY8WqtTKuzVNqGpbj46EgrlUbN22VaavWrJOrSXB+qlfzftZPFpZIVq7cOWXN6Ev6scsIOyvk+ll6/OCmjWnRoomUwsZw0iMsjCkwEl7y9nruSd+DgldAWz1zOyQE1UoTfjdcunjlRHpcWFkyZ3aR6piEY0yI64ZjzTHH7D9wUArhgayzGWopYG25Fduzh6os4+sH+/ar9SHjDG2jMlznChYsgCjD3Lyl/l1DhLNrrB4fels9j5dc7CSOctgwASbgewRYofa9c8It8pJAlGcTFF7WEnfZ0qZNK3cORYmnT52B49KcOHVKpmfPmlW6nlq+/lQ5ezb1PdrjJ07Jm3VXx3fmdDSvmGZhrMrR81SqXIEOH/jPLfP5Z46bZ2HG4+23XqWDe7fQfmFG/z5CfjoL72ZjI6/hw3+hrj2etWqC0zhsZteiTSfCsl98iu2D99+i+XOn0cljeyg85CLt3bGR8O5xUJA60++0IBcJ6Hv6KgpsDOYugzZebD4FpXf18vl09swhuVPz66+/RFhGj/6Iz4LVqtuUrB6KBAUFUe+e6uY+06ZHL/ueOn22PLKuXZ6mdOnSSX9cWlmzRCsZR495vvQytn3LXP+JE7avGdgf58lT0ePAPs2dcJnSpYz3NletVBXpZdqu3+ZP/OnLvldor6gsW75KFo/9DAICkuZtRJ1aNUjfhwCfRpMHZGEpiiIfBimK6kZGRtJm7R1X8/u4GFMY9yjC2+u5eTb+tOkahzLtDXYDP332vIzOliX6b0KOHOpDliNHjhNkpIAT69Dh6J3cnYjYROMYE+q6YVOxG4F52icGWz/VzA1p70RKlyopNwhF7lmz5sKRr7FMnT5H+q1WzGTNkkWmwXL3OrtssXqNQx5rk7CxSe3eKmHpcG1MQCWQNP8Sqm1nmwkkeQIF8qtPsw8cOhzjsezde0jKmG/iEJFGW14eHn4PQUuDJWQRj917f9WygASIzJM3j6wlPOwunT9/QfqdWfqNoKIoFNMsnlUZ+fKps/13RV3YRMYdk0u7UbUqD3G42Xr+uT7057hRdOb4fqlYIx67Ra/fsAlet8zceQsJyji+T3pg71bCLG/rVs0JMx9Q4FHIkydPYrxZhpwrUzC/uhLgrpjRcuf4IYMN01yV6SotT66ccqfmn4Z/S8cP7aKftM3gsCTy19+tP13TU1s+uXnzNjpz5izhG62LFi+X1fTSZotkIA4tKPt6cQcOxDwudVndjW3fymn6GsAhu30G9Dp099DhI7rXaxefVULmZStWEj49teO/3fJTcLVr1US0NC2bqzOyS5atkhvwLV6qKtRt2zwl05OihQcfzZuqezGMnTBRKkbuHAd2O8d+ApC1XzJdIJbXc32fDJR96IhrZffEyZNyfwLI6jtcw1+okPo3BRv6HT9xAlFOzQFtVtepgEVCwQS+blg0wSFq1er1pH+vvUtndTduB6E4iujXp6csCe9M46HgmrUb5Kcx8TDFavM882qq1GnTEK6jMZlChdR9AWRFycHiY2ACfkCAFWo/OMl8iL5LoG2bFrJxK1etc/nOLTa8wnJZCLdopt7cwg9TrkwZOHToyDF5sysDdtbade4rdHZZEyzYtHED0j+Bs1BTmpxVvmDhUplUr34dcraLLQQiIyLgOJiW2pLNEydOufzsFDKGht6BY2nwbi9uquwTcbP+zdefGjNgBw+5vjk259+6Y6cMduzQhvCJHBmws3bu2kP68lK7JLeDUNIhvHnrdpcrAvBJpQcPHkLUYxMWFmbZr7ER3OuvvURYvo5C99t9kglxMJUqlie8ywv/zFnzCTOJOO6ChQsQPieG+Lg2+FQbPm+DcpevXgPHqZk0eSqN/HU04VNCulBs+xbOeWltT4VFy9SHB3rZ9u7qtevtozwOt9FWHSxZsZqWrVgl+0LzZo0JrzTohVWrWpkyZ81K2KwNm8vhWoSZyibaxli6nKeus/HpaTneyuMBGPLu27OffhwxCl6XBjO+nw/5VsrgWtW1Wyfp163YXs/NfW+e9j6tXra9u3jxChmF84ANAGVAWDgnUO6El0aM/AOOpcFKmO07dlumuYpsLR7uIT0+rxso312DT2S98upbUrxEyeJk//dRJsSh9YxQ2FOkTClfwcF+A9NnqrPTnTu2t9w8r3HDesbfgf/+U6/tzprj6m+NszwcH/cEuEQm4A0BVqi9ocZ5mEAcEejVo6tUIs+dPUfvvj/YstS7d+9Sv/4vyzQ82W4glEgZ0KxKlcpLX8it2zR+wiTpN1tQGn/4eaQ5yif9WbJkps4d28q2ffC/T+mYttutjDBZY8dNJP0zJAPEjLApSXrTpklrbAp3xMmSXSgM2LQHGXr0GUDmHWIRp5vFS1ZQttxFqUHjVmRegomNjMpWrE35C5S2ZI78T55EGDtxly9XGlFuGX0zorBw9V1I+0zYzG3EyN/toz0OY/McLHk9uP8QffzJEKf5PxvyDWXPU4S69upPT8TMuFNBuwRspJY1V1F65bV37FLUIJbOPn6krpqoWL6sGmlhP6ttPPbPtBk0eep0KdGnV3ePviMrM3lgDXiur5SePXOe0/O7fftO6v/8QHr73Y8oMCD6T2ls+xYq7qEpanjffOoM6+Wff4yZYHxmDnm8NXVq1ySshgi7HUqffvGNLKZVC9tls4GBgdSqZROZ9u77n0i3pXiwhyXAMuCB5c749KC4WIl2erodtW/fWpaBjf5G/OJ8XGH38179XpAPdZDh+f59yH7VSlxcz1EuykffmzJ1BrwOBu/vfqKdK4zj9OnVPTsgiNcg3tI+9zdB/D2w+puAlQidu/UjzGIjjycG9cXndcOTtuzZu59q12smlVu0aeL43yh16lSeFOGxLB6Wtmv7lMw34a/JNHP2fOnv3bO7dO0t7EHQQetjb7z9gc3fEbMs9pIoVLwClalQk/RVOOZ09jMBJwQ42kcIRN8F+EiDuBlMwJ8IVBCKxLg/RshDHj/+b/p66HC6d/++DMPC0uc+z75EUIozixmiebP/JdzcIk032OkXaQi/9tb79NW3wwhLQQ8fOUqjx/5JdRs9Rfny5iXccEDGl80fo36iCuIBwf3w+1KB27Vrj9FcKGD/Tp9F77z/Pxn32msvEm5gZcBkYWatWeOGMubXUaNpi5iBvX79BmG2VEYKK03q1LRo3nTCO8rr1m6g7j37y1lGzECJZDnT/++0mfTsgFcJm2IFpUxJhQsXQpI0WL6cLl0a6X/vw08InxnSzxs27kG4a3dVKcuWIzvVrlVDyrpjNWvSWIphI67f/hhPaLuMENbx4yepb/+XaMYM9f09EeX1D7twj/ntZ5n/+2Ej6H+Dv5D9Rp9xx3F8/uVQ+uGnUYTzgeWt+pJzmSkGq1SpEvKBwr//zqRffxtL+mZdeCCAmZrnX3yd9F3D8Z41OfnXtVtnUoRCt3/vAVq1Qn3PFzf1TsTjJPrFAc9S//69ZVkYU7+PnkD4pBEi0A/xDnHHrmp65SoVqbrp80Sx7Vuo483XXqaCYhYe/ldef5fwEAkPcRDGjfeYcX/RO4MGU7ESxRAVK4N31du1UXfqPnv6nCyrRXO1D8qAZj3VUlWy8W4/otq1aQXHY+PO+PS40Fhk+HXkD1SsWBE5M//uoI+pYZPWcpd+jLXbt0MIO+0P+fp7qt+oFc3RlCdco4Z/77jTflxcz196ob/R9159YxDNnrtAtk0/RKyG6N7rOblCpVat6oRvG+tpujvk84+pd+9uMvjSK29Sper15fhGP8aDseLlqtHV69fo+efVaxR58C++rxvmpoSGhtL+A4cMg1l1POTEw6SmLTtQtRoN6eTJ04QZ47G/j7AZh+Zy4trft7eqPONvNpb/58mXhxo3que0mrHib3z5iuXoyqUr9FSbzrR02Uq6c+eOIY8VaG07dJW7618Tf6tq1axmpLGHCSQvAsn3aFihTr7nlo8siRDo07s7ffGFqiTiE0bZchWlClXrUrHSlalIycpyRiSlUADnz/6HSljcQOMGdeHcfwnL/CIeP6bPP/9WKKV1qLyYGovc1QAAEABJREFUQX31tXcpS3Ammj19UrzO6MUV6owZM9L8OVPFzG9+OrDvINWo3YTyFS5DlWs0oCw5C1OfPi9I5e7pju3oh++/dlrtgOf7yQcIuNmq3/Apyp2vBP36+1gb+YoVygkuk+XNGHbRrtegJWXNVYgqVqtHGbLmoz59X5TvxhUpUohG/TLMJi8Co4Xyjx1lcUPVqm1nwnmrXruxaGcRQvi/7bsos3gIMvmvMQ4PQZDfmWnSpAG1EQoOFPk33hxEefKXlDfEuYRbulx1mjZttuwv2OXaWRnuxj/brycNGfKxFIdSXaFSHcpdoBSVKl+DMmUrSF999b18oNC4aQN6753XpZy71oeD3iYom5B/S8zM5MpbXJ7HHMKtXa85TZr0rzxH3w/9ksq6+HwPHl481aIpipGmbt1a8j1EGYhHa9QvPxCOG0vMX3/jPSpStLycPcqcoxC1afcMXb18lUqVKUVTJ09waEVs+xZmGaf/8ydlyZaNMHP8yqtvU8FCZQifNoM78NV3KFu2LPTvpHEOdXsT0db0LnSZcqXJfp8GlNmsSSO5ORf8iqLQU62aweuVcWd8elWwF5nQvzatX071G9SVuTdt2kq9ej1PGGvZcxWRO+0PGTKUduzYJdNbtWpByxbOorRp0siwvRXb6znK+00o+dgILiz0DuFzc1lyF6EqNRtSnoKlCNcpPIjCQ4A5M/+htGnTIouNURSFxvz+i7yOIAHXUoxv9GPMfEdFRNKMKROpcqUKSPbYxOd1w9wYfPO6ctV6pJvqtRpT+6e7ya8ErBMPQiGLZd4bVi+ifn17IJggpmXzpnJs6pX17dXN5TUeu8EvmDuNChQsIB8AtG3fVfytUf/OZxV9DJ9cxANDXNPH/P5zjJ870+tllwkwgXgm4EHxrFB7AItFmUB8Efj4w/do5C/DCcobPkty6MBhOnPqrFRmGjWuT0sXznA5y1mzRjWaN2sqNRczS3inTm9n27ZP0aL5MyhLlsx6lM+7eIcUn6Pq1q2TVLjwVB83G1Bcg8VxfPThO/T3n3+4vIFpJxSE5YtnERQe/YD/+0+9IdbDcJsItosFHzBGGDOxWAKNTcFQ19tvv0q7d2wgrAJAutlgpmbDmsWktxPnbfeuvXIZJZbQtmvXinZuXU3NmjY0Z4vRjxnO2TMm0zvvvCZn0DFjjBviG9euy6W5Y/74hT5633oZdYyFWwj874N36bdRPxJuTJGMek4cOyH7Hm4AsXP58kVznCoQyGNlMmcOpuWL59C7775OGTJllLNsOI/4NExK8YAIs2s4R+8Ixlb5zXH6bBvi+vTqDifeDR5UQelAH8BKBlQIRQab5uXMnZP69u1Jm9YuNXbJRrrZxKZvoZyqVSvTlvXLZP/CDD36AVaqwI/+umXjStI//QT52JjmTRsT3glGGW2EwgjX3uTIkZ3QJsTXFDNoeN8Xfm+Mu+PTm7K9yYNlvLjmzJwxiRo2qm88ONDLUhSFmjZvRP/8M57mz/mXsIxXT7NyY3s9x6qBqaKu9957Q44dPFTZt2c/XbtyTZ6nPn16EHaCdtUO9F+saFq1Yj69+eYrcmk7+uzPP31Hu7evo9atmls13e24+LpuuGpAQIoU8mFrnTo1acCAfrR65QI6uHdrgs1Mk/YPbHv37KKFiHppXyMwIiw8+t81XMswo44Hpvg7j+sh/mbj1YP9uzYRXkOwyM5RTIAJ+DgBX1CofRwRN48JeE7g2sVj9OThLfryi8FuZ37lpecIn9U4dngXrVg2jzaKm+nz5w7TyqXz3NqACTfwS8TMya0rZ2Q5obfO09xZU6SSjkY8CLsi29Sja2cEDfNM5w4y/vGDm0acNx7cYOOYYfBeprMy8LkjyDy+d92ZiFyC+c/f4+japeP039Y1tFQoZvv3bqELpw9Jps5mh8wFNmpYnw7s3kzXr5yiQ/u30z9OZvPADYwvnT9KWzetlOzPnjlENy6flJ+nwmyhuVyzHzt7o53XL52gnf+tp2VL5tKp43tlXsweFSig7qRtzuOOPzAwkL7/dgjdunpazNRvlZ/NwjFcvXCMnuvfW97wh944J89b3z62CqY35xNLnHFjevLYHlorZns2rFtKN66dplMijI2bFEVxp9kOMlCqv/vmC7p87igd3L+Nlou+vHf3Jrpz8xxtXLeMcI4cMllEZMqQQcZCEe8i+qsMOLHish8GB2eSfeDSuSO0b89meX5Pn9hHF88cpgljf3W5IR6aF5u+hfxFixYm9C+c980bVtD6tUso5PoZeU3ImzsXmY+1ZIniyOKVySQeeDy8e1X2p2+/+sxpGRgfGLs4d06FRMLIEd/LsnA9EkHLH869q/HpThkoeObUibIunA+EvTV4neHp9m1olbj2hoVcoiMHd9A68cAM/fb2jbNiVno2devSUY49d+qI7fU8g+jzQ7/+nPS+h2vgf9vW0rWLx+WXBAqK2U532tGwQT25mgcP6cDotYEvkP76Svhd9csQQUEpHYrCpwBxrrHSxCFRi4iv68a61YvlOUX9ZvMo/BqdFtfX9WuWEF4PalC/rlvnw51jwSG52+cg++Owb4w24u8A4mIyGM9/jf+drou/a7vEg1qcU/SzOzfOE86Pt38vYqqX05kAE4h/AqxQe8yYMzCB+CMARQqz1I3FLEmtmtXlDbOntWEHZWxe5koR9LTMxJLHUjnMBGOWFzct3mw4A6UOS+Ux8+vqODADV61aFQJ7KCuuZO3ToJBgmW/TJg0IN0WK4p0Cal9uQECAnB3HbBKOATf99jJxFVYURX6aq17d2lS7Vg0C+7gqG+cNCh8UTCzv9vQ4fh89XjalY4fWBCVXBhLQwgOcMqVLEc6v1XLomJoSm76FsrHCpEaNqoQHVclhXOOYdOPu+NTlE8JFf8WS6rp1ahH6bXrTpl+e1B8X13Nct9D3cA3EEm1ca9xpw7Vr1wk79LuS3X/woEwuVED9jKAMeGgpSvxdNzxsSpIRx8MSvG+Pc4p+hn6SZBrPDWUCTMCSACvUlliSUSQfChNgAkwgCRNYs3YD4R13HMLAlwfAYcMEmIALAgsWLaXyVerKHfb1jRbtxbHB1/SZ82R03To1pcsWE2ACTIAJeEeAFWrvuHGueCLAxTIBJsAEDh46TIM//ZLeGfQ/at9JXdL+9NNtCTOGTIcJMAHXBI4cPkY3r9+gv/+eQvUbPUUzZs2jI0ePUWjoHcLY+m74z9S8dSfCvg9Zs2ejgQNfdF0gpzIBJsAEmIBLAqxQu8TDiUzAJQFOZAJMIB4ITJ85l4Z+9xP98ssfclf3WrWq04ifv4+HmrhIJpD8CAx67w365JMP5BcMdu7cTT169qdyFWpR1hyFqGLluvTxx0Mo5NZtwo75O7atJWyYlfwo8BExASbABBKOACvUCceaa2ICiUyAq2cCSYNAvjx5qFOXDvTii8/R2NEjadXyBeTpe+1J40i5lUwgfgh8NvgDOrJ/m5h9foHq1a9DmInGTu5ly5ehnj2foZ9+HEorl82j/HnzxE8DuFQmwASYgB8RYIXaj042HyoTSFIEuLF+S+CFAf1o+j9/0m8jh1P/Z3sRNtrzWxh84EzASwKFChWkX376jtauXEjYKf5e6CXau2Mj/f3naHr91RcJn+fysmjOxgSYABNgAiYCrFCbYLCXCTABJuAtAc7HBJgAE/BlArybtC+fHW4bE2ACSZkAK9RJ+exx25kAE2AC3hHgXEyACTABJsAEmAATYAJxQIAV6jiAyEUwASbABJhAfBLgspkAE2ACTIAJMAEm4JsEWKH2zfPCrWICTIAJMIGkSoDbzQSYABNgAkyACfgNAVao/eZU84EyASbABJgAE3AkwDFMgAkwASbABJiA9wRYofaeHedkAkyACTABJsAEEpYA18YEmAATYAJMwKcIsELtU6eDG8MEmAATYAJMgAkkHwJ8JEyACTABJpDcCbBCndzPMB8fE2ACTIAJMAEmwATcIcAyTIAJMAEm4DEBVqg9RsYZmAATYAJMgAkwASbABBKbANfPBJgAE/AFAqxQ+8JZ4DYwASbABJgAE2ACTIAJJGcCfGxMgAkkUwKsUCfTE8uHxQSYABNgAkyACTABJsAEvCPAuZgAE3CXACvU7pJiOSbABJgAE2ACTIAJMAEmwAR8jwC3iAkkIgFWqBMRPlfNBJgAE2ACTIAJMAEmwASYgH8R4KNNXgRYoU5e55OPhgkwASbABJgAE2ACTIAJMAEmEFcEuJwYCLBCHQMgTmYCTIAJMAEmwASYABNgAkyACTCBpEAg4dvICnXCM+camQATYAJMgAkwASbABJgAE2ACTCAZEIiVQp0Mjp8PgQkwASbABJgAE2ACTIAJMAEmwASYgFcE/Emh9goQZ2ICrghs3rqTVq/dQqF3wlyJcVoyIhAVFUUHj5ygxUvX0t//zqEpMxbQ8pUb6PzFyz59lA8fPqTDx07Kdv8zfT5t2baLrl6/6Vabz5y7SPMWr6KJU2bTzHlLadt/e+j+/Qdu5fVUKDIyklAfxtWkqXPl+EIY8TGV9eTJE9q6fTfNmLtEtHUOLVm2ji5fvhZTNpl+R4zhPXsPyeObMXcpwY84mejEOnrslGwf2urMoO1OsnM0E2ACTIAJMAEmkAwIsELtsyeRG5YUCCxZsYFmLVhGt2+H+mRzL1+9TmfOXiAoUz7ZwCTWqGPHT9OX342i38ZOpkUr1tK2HXtpk3ioMm/JKhr642ga8dtEunErJM6PKrbnEfmHDB1Fv46eJNu9WSjTk4VSPWToSJq9YDnhIYFVoxGPBwbDRoyl5as20Pad+2jN+q30t1B0vx72u1TQrfJ5G3f/wQP65fe/CfVhXG0VijtchEf+MYkePHjotOjzF6/QkKG/0qRp82jthm2irXtp4fI19O0Pf0gFG8fiLPOuvQdp8FcjaOzf0+Xxrd2wVfoRt3vfIWfZaN3G7XL8o43OzNGjp5zm5wQmwASYABNgAkwg6RNghTrpn0PfOAJuhU8SmDp9IQ37ZRxdvHTVJ9uXlBqFWdlRYyaLWd0blCNbVmr/VFN6oW9X6t+zEzVrXJfSpU1Lx06epuE/j6Wz5y/F6aHF5jxeEOf+51//pJA7d6hOzSr0ynM9aNCbL1C3jm0oU4YMtGrtZqlwWjV45rxl8oFBmtSpqWmjOvTaC73p2V6dqVql8nQ7NFQq6KfPnLfK6nEclOmRv/1Nx0+doRJFC1M/wfWDt1+ivj06UuEC+SRbKNWPHj12KBsPtHBubt4OodLFi1L/3l0IeTt3eIpSpU4lFewFYobdIaOIwEORvybNIkVRqE3LxvT2wP705sv9qHWzhqRERdEEkbZzzwEh6fjTH560ad6Iundqa2lKly7mmJFjmAATYAJMgAkwgWRDgBXqZHMq+UA8IcCyTMATAlg2/M+MhfQkMoKqV65An374GrVsXp8qVSxD1apWoI5tm9MX/3uD8uTKSWHh4TR+4gyfWWCQac8AABAASURBVBWwftN2unvvHrVoWp96dW1P5cqWpEIF8lKDetWFYj2A0osHARs37aB79+/bINl/6JhQRLdSypQp6dUXelGndi2odKliVL1KeerfpzM93bqZlJ8llG5Xs79SyA3rwKHjdPbiJalMD3yxF9UQXAvky001q1WkNwf2o2KFC9KZ8xfo6InTDqUtXLaGwu7epdIlitErL/SkapXLEfI2aVCL+vfqJOVXrN1CN27ckn6ztXTFeoqIiqSX+3ej1i0aUrGiBalE8cLUplVjelHERYpzvmr1ZnMWw39LKPAING5Yi+rXrWZp0A7IsGECTIAJMAEmwASSJ4GA5HlYfFRMIGkQiIiIkDf5mOW7ceu2s0Y7xN+7d5/wbiZmyKzeLYVyFBZ2l0KFQeawsHAKE34YhD01MdWH2UWU/fDhI6dFo52QgdGF9DiUr8dBOYMCa5bT05y5jx49ku/KIh/KdCbnbfy/QpmOiHgilbre3dvL2Uz7stKkSS0Vz0wZM9DN27dpsVDU7GXMYXfaHBfn8eixU7LahnWrS9dsZc6cicqWKS4VyqPHbRXVY5ri2rJxPSpcKL85m/Q3b1qPihUqSKfPXaC9B47IuNhYen31alWhoBQpbIoKCgqi2tUrybjDR09KV7ewf8H2nfvFOQmgnt3aUWBgoJ4k3TKli1OZksUIivHqDVtlnG7dCgmlazduUo5s2eTDArL7V7ZMCcqcKROdu3RFKOzhNqn37z8g9HvM3uPc2yRygAkwASbABJgAE/AbAqxQ+82p5gP1JQLY7GjmvKX07sdD6bNvf6HhI8fTZ1+PkO/nOlteivZjeSrkBn3yHeG90s++/lnk+4V27jmIZMOM+2sGffj5cLp+86aMGzNxmgwj7vGTJzLOHcvd+jZv2SXL/2vyLCKyLnnP/sNSZuToyYbA9Zu3Zdzv46ZQhHi4gE2oPvh0GH01/DcZ/8W3I10qa3indsqMBTToEzUP8r33v6GE5b9YBmxUpHnCw+/JjarseWnJls6Vazfo5NlzcqYWM5Yp7JQ9c6bg4IzUT5sR3fbfXqHERZqTpd+TNo+L5XnEJl0N69aQy7uDM2WU9dtbGcUDAMSFhoTBMcyJE2elv0TxQtK1skqVKCKj7ZVcGemhVbxoIercriWV0Mq0z54xY3oZFRJyR7q6deLEGcE5gooVLkBZgjPp0TYuZp4RcfiI+nABfpiIiEhZZ8f2zRG0NHhAEiVmsKG4mwVuavsmZMkcbI5mPxNgAkyACTABJuBnBFih9rMTzoeb+AQws/XDyAly8yPc0BcrXJAaCKUnW5bMdOXadZo4eTbt3XeY7P/NX7xa7iodcieMShYrIpfwVqlQlqCcT5wyhy6IWTQ9TzkxK1e3VlU9SDmzZyOEYQIUxYh35fGkvqpVylGgEkAHxeyhebbZXP7OXQdksFa1itI1W5GRUTR52nxx3EeocMF8VK92NcqdM4ecPZwwaabl5leRkZE0/u8Z8h3fqKgoKlW8KFWtWI4oQKFDR0/Q0J/GEDZkM9ezfNVGuVHVhEkz6NKVa2pSDPbeveq5yJ8nF6VLlzYGaZKKHZRuLEE+fkpVSvVMnrY5tucR7WjSqLZc3q23wd49fUp9Bzp3nhw2SfceqLt4p0mbxibeHEirpV24cMUc7ZUfS7zR1gzp01nmP33mgozPlzundHXrhPYON5aj63H2bs4c2WTUtRs35EoNGRBW9qyZCXVWKFtShBx/WHFx4fIVShEQSLm0MnSpkNvq5nNZxSw/zitWjOzYuU++P4+wLscuE2ACTIAJMAEmkLwJBCTvw+OjYwK+R2DuopWE5d0F8uahoZ+/S2+/1p+6dWpNX3z8ppwtw/ucy1ZusGn4o0ePae36rXJZ6zuvPUdvvNKXOrRuSs/3e4Zee6kPiSk6+mfqfGO35iZCier5TDvCklwU1Ltbe0IYJtBuSSzS7Y2n9WH2s6SYWYyIeEJ7xUy0fXl4iHDgyAkKCAikakL5tk/Hu7Fnz12kTz98lV4Z0JN6dGlL/3vvZfkQALOsS5evt89C02YvloozNqz6bsh79PrLfei5vl3ouyGD5AOKu+HhNHfhSpt8urIWGJiCgtzggMxXrt+AQ/nz55FuTFagKDdvLlXpu3ZVXSGg5/G0zVbnEecQBvXo5XrrHjx0jE6cOUvYZK2o3bLu4kULymJP2T0UkJGadfL0OenDO9rSE09WSOgdWrNhGwWK81a1anmbWkK1GetgbQbbJlELQPFPkyq1DIXcuStdd6zFK9YR+l/VKuUJDyfMeW7eCpXB0NAwwo7nWDHy55TZ9P3PY+jDz4bTvzMXylUXUogtJsAEmAATYAJMINkSYIU62Z5aPjBfJdC1Yyt6+fme9NLz3R1mPGtWr0iBQmm4IGZPzUuzMdP68PEjwixpQTvFrnixQvTumwOEYv6sULiVODlsb+qroc0879Bmos0N2XfgiFBMHlOZkkUpY8YM5iTD37fH0zZpAQEB1LFdczk7eOHiFeNhATJgqfjGLTsoQ/r0NODZboT3WBEPg/dvO7ZtRsWLFKLwe/flbtSIh2nauI58APH+Wy9Q9uxZERWjuSMUJggVyJsLjlsmf/7cUi40LHoZtbdtlgXFgwUldYpQ+lB0lw4tHRRGLMFG2ur12yk8/B68NubEybO0S/uk1CPn787b5PEmgNneyeJh0f2HD6hxg5qU0+683buvzqTrD0uc1ZElS7BMwnvp0hODhU+krV63lVKlSkUd2jR1kL4ZEiLjsJEaPNhBvVnjulS4QH56INqE/vn3lLniWZfjsn/Is2ECTIAJMAEmwASSBwFWqJPHeeSjSEIEMLNYvkwJwqyufbNTpAikNKlSipmtJ3TdtCNxcOZMUvTcxUu0b/8RG+USCVCysRsz/HFhvKmvYrmSUvk4fvKMXIZubseO3epyb13pNqfBj02n8udTlVCEdQNFOWvWzPTg0UO6ZuJx7vxFKVKxfCkKzuSooIPFW68+Sx8PekVuKiWFhaUoCpUuUZTy5VFnkEVUjL+Hjx5LmYwZ0kvXHSuTUPQh91jLC7+3bUbeuDZYyjx6/FSCUt2wTnXC5lv2dVQsV4oK5c9LV65do1Fj/qEDh48T8mGzuPUb/6NR4/4RbDPKbOmdLNOWibG0ps5aRIePnaCC+fJSmxYNHUp7/Fg9P4FBthuZ2Qum05anP37sag8BNdflq9dp7MTpcpz16tqO8B61mhJtN2lQm954qS+9+XI/Gvz+QLmDese2zem9N5+nd15/To6FHXv207IVtqtNoktgHxNgAkyACTABJpAcCLBCnRzOIh9DkiRw92447dl7iBYvXUsTp8ymH0dOoA8+Gy4/cYQDwswcXJgc2bIQPh8E/+i/ptKX3/1GeMf5yNGTZJ7JRnpcGG/qgxJbpWIZuWP0bu29Y7QlTBznkeOnKW2aNFRBKN2IszdZgjMRHjTYxyOcOmVKOFKZkx5hnTt3SdhE+XK7P2ssM3hh6TOfnnzLW3+fXc+LahOyzajPmYmIiJDvnuPhTNlSxalLx1aWoqlTp6JXX+xN+fLkprMXLtLvQoF+b/B39OHnw2nanEWUIV066tezo8yb2cmGZzIxFtayFevlO/JZgoPlig70Mfvi8NAFcSHaJmHwW5m72ix7ujTq0m8rGcSFhIbRb+IBAmay27VsTFUrlUO0gwkWD3LwmkOJ4oUdVoYUKpiPnu2hstl38KhD3jiL4IKYABNgAkyACTCBRCfACnWinwJugL8RePjwIU34eyZ9/MWPNPbv6bRoxVravnMfXb1+k0oXL2I5GwZGvbt1oE5tWxA2L7t6/TotW7WeRo6ZRB8JJXzO/OWE954hF1fGm/r0Dcd27N5vNGOPUK7xyaIqlco6fA7JEPLQgxlEZMmWNRhOvJpMweoM+LkLl92uR5fNYHqvNyHb7Kyh2Lxt8rR5dPDIccorHkY816cLYWm9M3m8e/zWwH7Ut/vT8vvbmYXiXKxQQWr/VFMxK/uKyKu+YqAzclaON/Gbtuyk+UtXE959Hjigp9NxgTaifH3XbfitzJ2wuzLa1SZr2FBv1JjJdCskhGrXqCy/NS4zeWGVLlVULqO/eOkKYWd3L4pIdln4gJgAE2ACTIAJJEcCrFAnx7PKx+TTBLDUdufeA4Rlsl3aP0WD3nyBhn31gdxM66Xne8j3gq0OAIoP3gHG5mX/e+8V6t6pLVUoU5IePHxEK9dtpjETpsolqlZ5vYnzpr6iRQpS1szBdOrsebqp7YK8c4+63FtXtr1pi32eHDmyyqjrN25LNz4t/V3i8xfdU6ixJPp2qLphFd5v19uWkG3W67R38eAFD2+yZ81Kr73YizALbS9jH8Y3lmtWr0TP9u5EQwa/SW+/3l8qmpgtvq4tw88aHExx+W/vvsM0bdYiwqsArwzoQblz53BafJ5catqt2yFOZbAaBO/To7xsWazbigdSf4z7ly5duUoVy5aSm/g5LdCNBNSVI1tWuWLj2g3bzencyM4iiU+AW8AEmAATYAJMwC0CrFC7hYmFmEDcEMCN/dGTp+XM1UfvvkSNG9aiQgXyyuXQeg1WG0DpabqbN3dOql+3GkEBH/TmAPnJqsPHT9p8OkuXjQvX3foURaGaVSvKKnfuPkghIXfoxOlzlCNbNipst4u0FPLSKpQvj8yJTxpJTzxa5csUp1RBKQlK0W5tEy5X1a1Yu1kmFy1YwOa7yAnZZtkAO2vZqo20av0Wwrv7r73cx2YDODtRGcQ701u27SJspiYjLKwt2/fI2MqVy0o3LqzjJ87QhH9myWXUA/p1JTykcVVusaIFZPLRY6dJf59aRpgsvIIQFRVJhQvkk2PPlCS9+jJ4fG8cn6Tr37eLmH13/edx/6FjtGPnPsLScFmInQUFHatOUqQIotw5s9ulcpAJxDUBLo8JMAEmwAQSi4DrO4bEahXXywSSKYGQO+quz5jFxQy1/WFeuXbDZldqPR3xq9dvJey+rcfpLjYky5tHfZf4Xvh9PVp11RW55OmSU6/rE7VWq1ZB2EQ7du2nXXsOilnzSKqlxcmEOLDyaTudY4M2fTbYXGxkZCT9OnoyffvDaEueZtmY/ClTppTfKobcxClzLM8B0mA2bt5JqzSFumWLBogyTKza7OV51CvfvHUXzV+8ktKnTUv4zJqzWVpdHu7FS1dp8vT5NGXafAQdDPri8VNnqFTxomS/87aDsJsRWAUwGistIiKpT8+OVK508Rhz4kFNluBMcpn26rVbHeShLG/culPGV7V4HzoqKor+Ecd54PAxKpQ/H730XDfCTvEygwsLO9fjM1k7dx20lNp/4IjcXLCweGCG2WpLIY5kAv5KgI+bCTABJpCMCLBCnYxOJh+K7xPATC+UmqvXb9DBIydsGnxHKNvj/ppuE6cH9u4/QrPmLaWJU+Y6vCt9SswAX7p6Te4qXKRIAT2LdPNpO2fvP3xcht21vK0P5UO5KlwgP13P3MB1AAAQAElEQVS8fIVWrNkkZhoDyNnu3pD3xuTKkY1qVa9EYeHhNP6vmTYPDKAgYaM37AydKmUQZc6Uyaji/MUrNHzEeJo0dZ5Q9KOM+Jg8rZo3kO8cYwb0D6Hw7dl/2OZzSNj9Gg88ps1ZLIvCJ5TKliom/brlbZuR39vziLx46DB15kLZPwa+2Nvt2VJsgheoBNCxk6dp1ZrN9PDhQxQnzekz5+m3sf9If5MGNaVrtpC+7b89dOacuhu7Oc2Z/8aNW3I3cXweq1vn1lStcjlnojbx2MyuRZP6Mm756o02dUKZ/mvybLpw6bJcLVCrRkUpZ7bmLlhB23bspTy5ctLAF3pKTuZ0Z/4qFcrIpDmLVhCWqON71TJCWIfF2J4klHThpdo1KsFhwwSYQBImwE1nAkyACbgiwAq1KzqcxgTcJDDmr2n06VcjnJoDmkKrKArVqV1Vljpm/L/0069/0qz5y+Rs6udDfxXKp0J4v1UKmKy6NSvL+Gs3btDHQ36ksULxnjZ7MQ0ZOop++HWCmAmLpKeaNXCYWatcvpQoM4DWb9pOX3z7K/34ywS3FElv69ObDGUM/jt371KJIgUps/bZL8TFlen5TDsqUbQwnT53nt7/dJhk+K9QHL8Z/gctWbVezsZ2at/CpjpwgPzW/3bTSaEU2iS6CEBpe/OVvlSscEEKE8c0VpzvDz8bLpTzcXIW/MPPh8sHHth8rX6d6tSjS1vL0rxpMwry9jzeCgml8ZNnyfd4KTKKxk+c4bSP/j52CqoyTHCmDNSrewcKDExBsxculzvQQwb9aPjI8XTvwUPqKY7T6pNbK4UC/vfUuXT69HmjvJg8v4+fKtkqQolftmqT03ZinN1/oH57Wi+zXp2qQgEvLz+v9uMv4+W4QlsHffI97dp3UCrJA57t5rDce9feg3L/AZQTKh5offfTWKf1Ll2+HmKGKVWyKLVs2kA+aBgzcRqhP/w+boocn7+OnSyXn3du15Lw/jnxPybABJhAwhHgmpgAE0hgAqxQJzBwri55EsDN+M3bt8mZefTokXHgHVo3lbt1B4nZ0xOnz9LqdVsIs6nFCheggS9ihkz9TJSRQXiwPPzNV/vKnZYfPXxEe/YfkkryjRs3xYxjDnq5fzdq0aSukLT9FStaSKZhSSyUcbwjevX6TVshi5C39elFValUxlBealZ3nBXU5WLjQsl94dmuYqa6MonnFJLhxi076PrNW1SyWBF6760XCJ8vMtdRqVwpqVxly5qFcotZbnNaTP506dLSG6/0pV5Ckc+dMweF37snlPkLcvbz8eMnVErUOfD5ntS9cxvChm5W5XnTZpTj7XnErtVPnjxGEfTw8SOn/RP9Vn8dQQprFh6MvC5mtYsVKigexBAdOHJMlBFCeD/8uT6dqW7tapqkrXPjlrpBWH5thYRtqnUo9M4dmRAVFSnquO3SREXZri5QFIX69nhajitsooZxhbZiVr1MyWL0zmvPEV6NkBWYrDuhd40Qzic4ODP270orikLtWzehfj07yaXij0QfOHD4GN2/94BKlygm2tPReFXAqIQ9TIAJMAEmYEeAg0wg6RNghTrpn0M+gkQk8OUnb9GoHz6P0VSpWNamlditGzt7f/LBa/S2uNn/fsj7NPCFXnJ58kfvviTLy5cnl02ezJkyEXZa/u7L9wm7fL//1os0/JuPaPD7A6lc2ZI2suYA0r785G365rN36VthsPTYnO7M7219KC8oKAWlCAiklClTUqUKpcnZPywPB79PP3zNmQi9/86LkkcBC+UMn0zqI2ZRvx8yiD569xVhXqYfvv5QKr7Zs2Z2KBOzqUM/f5c+E/VBQXYQiCEiMDCQ6tSqKpkPF/XgPHz64ev009D/0etC2Ub5MRRBnrZZL8+b84g+BL7uGPQ7vS6zi53KsbP3j998SB8PGkjDv/qA3nnjObLv0+Y8eKiB8++JQg2e7rQTMmnTpDFXJ/04NxhXQ0Vf+Grw21pf+IheFQ8E8uXJKWXsrUYNasq+hTJjMp06tLTPLsM1qlagQW8NEP3uA8ln2Ncf0Gsv9SY8jJACbDEBJsAEmEDyIcBHwgQsCLBCbQGFo5hAQhBQFIWg3GJm2hPlLnXqVIR3sTHjllLMcrvb1kwZM8S4s7NVWd7Ut3nrbrn8tnKFMnJG2KrcuIxLlSoVQWmCAgnFylXZUPKdzSC7ymefliZ1anke8FDAnU2s7PN70mZzXm/Po7kMb/zgmidXDvGQJMhlduzsjpnhIoULiHOf0qVsfCQqiiJfMUBfQN+NjzqsygwKCiLwASerdI5jAkyACTABJpDQBLi+hCHACnXCcOZamECyJ4BNmbAJFHZ/XrxiHQUEBFJzi2XoyR6Enx/ghctXJQF3duiWgmwxASbABJgAE2ACTIAoyTJghTrJnjpuOBPwLQLYCfrND76mYb+Mk+8XN2tYi3LnzO5bjeTWxDuBixcuyzoquFjqLwXYYgJMgAkwASbABJhAkiUQ3XBWqKNZsI8JMIFYELgTHi4/TVSqeFHq07UDdWjbPBalcdakSqBixTJyXwCrd9iT6jFxu5kAE2ACTIAJMAEm4IxAklConTWe45kAE/AdAs883YqGDH6TXn+5D9WqWdl3GsYtSVAC+r4ACVopV8YEmAATYAJMgAkwgUQiwAp13IPnEpkAE2ACTIAJMAEmwASYABNgAkzADwiwQu0HJ9n1IXIqE2ACTIAJMAEmwASYABNgAkyACXhDgBVqb6hxnsQjwDUzASbABJgAE2ACTIAJMAEmwAR8hAAr1D5yIrgZyZMAHxUTYAJMgAkwASbABJgAE2ACyZcAK9TJ99zykTEBTwmwPBNgAkyACTABJsAEmAATYAIeEGCF2gNYLMoEmIAvEeC2MAEmwASYABNgAkyACTCBxCXACnXi8ufamQAT8BcCfJxMgAkwASbABJgAE2ACyY4AK9TJ7pTyATEBJsAEYk+AS2ACTIAJMAEmwASYABOImQAr1DEzYgkmwASYABPwbQLcOibABJgAE2ACTIAJJAoBVqgTBTtXygSYABNgAv5LgI+cCTABJsAEmAATSC4EWKFOLmeSj4MJMAEmwASYQHwQ4DKZABNgAkyACTABpwRYoXaKhhOYABNgAkyACTCBpEaA28sEmAATYAJMICEJsEKdkLS5LibABJgAE2ACTIAJRBNgHxNgAkyACSRxAqxQJ/ETyM1nAkyACTABJsAEmEDCEOBamAATYAJMwJ4AK9T2RDjMBJgAE2ACTIAJMAEm4BWBe/fu06Spc2nTlp1e5Y/TTEm4sEOHj0uOFy5dScJHwU1nAv5BgBVq/zjPfJRMgAkwASbABJgAE4h3Ams3bqdtO/ZRgQJ5472u5FaB+Xjy589Du/YeosXL1pmj2c8EmIAPEmCF2gdPCjcp6RDYvHUnrV67hW7cuBVjox88eChl123YHqMsCzABXyNw7Php2X/R3901Z85e8LXD4Pb4OIHTZ87LfrZ+438uW/rw4UM6fOwkLV66lv6ZPp+2bNtFV6/fdJnHncTLl6/REqHATJwyh2bMXUJbt++mJ0+euJOVYpM3pgrQBn3c3bwdEpM4HTxyQnJct2EbRUVFxSivC9y//0DmQ11nzl3Uo912cV7WijqrVChD+fPmcpnvwqWrtGzVRpoyYwH9/e8cWrh0DR0Qs7KetNdlBfGQiLaBC/on+t2iJWvosGB9/8EDt2rzpI9kSJ+OGtWvSfsOHpV9y60KElaIa2MCTEAjwAq1BoIdJuANgSUrNtCsBctowqRZFBER4bKIe+IPLmTnL17lUi6+E0NC7hAUnZDQsPiuKtblX756XbYVN2mxLowLiBWB3fsPy74+S/R3d82Ro6diVSdnTjoEYjtWHz16RDPnLaUffv1T9rP5S5xfJ1HXkKGj6NfRk2jRirW0WSjTk4VSPWToSJq9YLlHCqROGIrSDKFAf/3DH7Rw+RravnMvrRWK4aRp82jI0F/p/EXny25jk1evPyYXiqY+7taJGeCY5HftOSA5ThfHdOS4++Nw+469Mh/qOi4eosVUj336xs07KfzePaperYJ9khG+fTuURv7+N337w+80f/FK2iQeTG8T9S5ZsY5+H/eP5I2HJUaGOPKg3+Bvn7d/T6A0j5kwlYaNGEvT5iyS/W7xynX069jJ9MU3I+mCi6XZ3vaRxkKhxuEvXbUBDptYEeDMTCD+CLBCHX9suWQ/InD2wkVasmJ9kjhivNc27JdxtG37Hp9v79TpCwltvShmMny+scm8gdUqlaXundramKdbNzOOulvHNjZpkC1TppiRzp7kTSA2Y/XkqbP0zfDRtGb9VkqbJrVLUBfEteBnoXSH3LlDdWpWoVee60GD3nyB0P8yZchAq9ZuljPLLguxSFwgHnRCgU4VFETtn2pC773+PL3+Yh8qW6o4YUZ41JjJBEXQIivFJq9VeVZx23fsM6J37NxPkZGRRjgmD5TcmGT09PVCIdb9nrqPHz+mlYJ/ujRpqEzJopbZz1+8TN//PJaOnDhFkGvWsA7169mJBvTrSh1aNaWc2bPRtRs36bexU+SqA8tCvIyMTR/FCrNhP4+jfYeOUp5cOalPtw70wdsv0kui/1WvXIHCwsPpl98mEpR2q+Z520cyZkhP+fPkot17DgouMa+Es6qb45IoAW52kiIQkKRay41lAj5MAEvX8PTbh5vITWMCXhMoWqQg1a9bzcbUqF7RKM8+DeEC+fIY6exhAlYEtm7bTT8JReTGrdvUqH4tGvhCLysxI279pu10V8yAtmhan3p1bU/lypakQgXyUoN61YViPYDSp01LGzftoHv37xt5dA8UPt1vdvHKzoq1WygwMAUN6N+VWjZvQIUL5adSQil8ZUBPKlwgH4XdvUsLl601Z5P+2OSVBbhh3b0bLpdCp0mdWrYlNCyMDh875UZOVQRLht1ZkXTi5Bm6cu2amskLG+/73hGcSpUoSoGBgQ4lYBXC+IkzCTK5cuSgz//3BnVs34JqVK1AlSuUoRbN6tMnH7xKtapXEg8MImjqzEUuVwY4VBCPEWB49foNKl6kEL3/1gCqVaMy4fpWQfS/Z3t3orq1qlK46HNbtu92aEVs+0ipUkUpIiqSNmx2/RqEQ8UcwQQSkIC/V8UKtb/3AD7+OCFQoUxJeQMwccocwk1DbApFfrxnhSWGzm4AMTsRFnaXYLCUzKo+LE9DOlyko1yEQ8UND8J3wtX8iItpuTrk7c3Dh4/ke114n+yOaIt9uh7GMaAOPOHX48yufizh4feMaNwMI0+oVm5YWLg81jAtbAiaPDgG3LjgocatkFCvln2airP0oq1Xrt2QN3loo70Q0tFGGPs0cxjnBDJgqMfrcTgOPQ675WJGDuXqcTG5t0NDCecEN+ExySZGOs7zuQuX6OLlq+Rq6SWOGYzAQG8n+tKFS1ecvl6BGUSMHTNDPa+VizFx6co1Onv+klCYwq1EjDjwRHv0CLzT56bCQQAAEABJREFUeuL0OUJ+Pc4dGV0WrjsscMyoF++2Io+9AUOkOxtfyId0lGOfN6Yw2gc2YO6sfIwDlO/JWDXXe/3mLcqeNTO9PbAfPfP0U5QqVUpzsoP/qKZINqxb3SEtc+ZMVLZMcal8HLVbrowl0x98NlzMhP9B9ixWb9gqr981q1Wg0kIZNBesKAp1Ee1C3Pad+yj0ju2rMrHJizLdMbv2HBJ9/glVrlhGKG5VZBYszZaeGKy0YrY4MjKCtmzdFYMk0XrxIAJCyAPXU3NSjAfkwQMOuPZm6cqNdP3mTcqQPj298kJPSps2jb0IKYpCPZ9pRyWLFqYnot3/Tl/gIGOOwFjHdR/9FOPZnKb7Y9tHUc7R46cIKyAaNahJQUFBiLIxtatXkmGr11xi20dKlSgiyz558px02WICTCDWBOK8AFao4xwpF+iPBFo0rUclxA0AlqrNmr/cKwS4YcXmLIM+GUZfDf+Nhv74B7370bc0evxUueTQXCiU6F/+mEQffj6csDmKOQ1+3ETjnS6knzx9HlG0eu1WKY/31RCB5Y1Ihzl+4gyi3DJQ9PEe2Tv/+0a2E++T/e+LH+VyN6TZF4KliqhjzsIV9kkyfP3mbdmuH0ZOkGFY4/6aIeNw84XwmInTZBjlPLbYIGjl6k00eMhP9Nm3v8gl4p98+RN9+d0o2rnnALLH2kBhwDG/+/FQUe6v8tx8KM7ThL9nklnhi4yMFOmjZFvPXbjstN7hIyZIGfN7gpiNwfHhXBw5epK+/WE0vf/pMOH+Tqh3/MQZ4mHNY6dl7j90jL4e9rvkgHPywWfD6NOvRtDa9dss82AjnfmLVxMUcEuBOI7Eg4jfxvxDUGq++2mMUGx+J/R1bEYERdS+Or1f/D5uijjuR3IcvDf4e8HjD3pfuHh4hZtp5MP5//Srn2nwVz/JPjnok+9pg6YcIN3e6GMNfL8e9ht9//MY+lDwwpJNLEm1l0f4m+F/yHP26NFjmjprkWj79/TTrxPkEmOkw7gjAzlPWJw9d0nWO2zEeGR1MONFH0S/GT1hqkMaIpAP6SgHYXfMvv1HBGf0v+8lm29/+EOet4lTZtv0d5Q1zsOxijxmU75cKfro3ZcJKyDM8VZ+PMRoWLeGXN4dnCmjlQhlzJhBxoeGhElXt/buPywf4Fy8fIXOnL2oR0v38JFT0q1Wpbx07a1CBfNR6eJFpdJ9wu5aGZu89vU4C2/bsVcmVa9cnipWKE0pUqSg/QeOEh7CyQQXVsN6NWTqxm07Rfsjpd/KwkPRPQeOUOqUqaiOmH21kokp7vSZC1KkQP480jVb+Ju17b89Mqpfj6cpW5Zg6beyMLuNlQJpUqUmvE51UTx8s5LDuP9Yu+5jDL/78Xey3x49cdpGPLZ9FIX16f40ffP5u1SpfGkEHUxgikAZFyTOjfSYrNj2kUIaz4viYSKuP6ai2csEmICPEIhfhdpHDpKbwQTim4CiKNRX3CTgBmDjlh1yeZ4ndUIRg3KmK7tlSxaXy+DSp09H+w4doa+/+03O6Oll4oajV9d2FKgE0MJla8heIVmyfB2FhYcT3u0qV7q4zJY3Xy4xu1FV+nULy9RgMgVb35zqcrp7TswsDhsxjvYePCJmklJRxbKlqFb1ypQ2dSo6evI0jRo9KU7e80Kb0S69XrxXhzBMgGCtx8NdLI51zqIVchkh3m2rLW4GswQHE5bnTZw8m/buOwwxr82NWyE0VCiAOGYsJ61Xuxph59Xs2bPSzr0HCIqwXjhudKtVLieDzpT5C5euEpZVoqzyZUpIWbN1TsyWjpk4Xd781qlZWdzAlRH+KNq17yCN/WuamKly3PwON5Bj/5ouZkuvEo4dDPLmziUexNymGfOWEBQh3NDq9aC//PHnVFq2aj3Nnrtcj443F8tNfxUPgA4ePU6pgoKoSoWyYiawGClRUQRlAcqg/ayh3pjIyCia9O88On3uAlURM3SF8uejB48eyk2jZsxdSqvWbKYFS1ZTvry5CceN2S/M2k6dvZD2HzqmF2O4UMLHTZwhN0KKiIiUM2HVKpUnLKdFH/519GSXu/ZjvGHpZbBQ3CqXL0N5cuYwytY9rmQ8ZVGkcH5Klzat6M/XxfkM0auQLpgdO3lG+k+eOS8VRhnQLPTdq9evy/woR4t26WBX6NF/TaULly5TJnGMGN9YgUMUJZjvoz/G/Uvmm3pPxqpVxZjNTJkyyCrJIQ7jq0mj2nJ5t0OiFnH6lPoAMXce2/PSQCji6DuVxDkrVDCvJk1y5cu1GzcoRYog8VC0kBFv78mVO7uMOiE4S4+w8KDN27wiu1s/PHw5c/4CBWfMSMWLFSLMHpcrXYIePn5Ee/cejrGMPLlzyGXKIaF35G7RzjJs2b5HXFueULWq6lhwJucsHteXq1evy+ScObJK12ydFtzw3ntAQCAVK1rQnGTpx3EWyJdbplkd57IV6wnXfSzFz5cntxz7GTOkk/0WY9j8QC22fVQ2IgZL/ztTsVxJG8m46COpUqWilClTyhn7q3Gwk71NAznABJhAnBBghdqEkb1MIDYEsNzwmU6tZBFTps13UHJlghNr+pwlBGWjXKkSNOzL92ngi72oX89O8ol40wa15c0TyowUM6B6EZg1qV+vOmE524Kla/RouSkKdoFNny4ddXm6pREP5Q1L6Vo3ayjj2j/VVC6tQ1zunOrNokxwYqHuv6fMlTddUCrRzhef6059unegb794j3CjCiUeDxScFOF2NG6a0a5ihdQbr97d2httDTS9m7dNzHgsEg8UMohjHfz+q/TxoFeod7cO9OUnbxE2FFIUhf4Us2q4mXO7cjvB7WJ2CDej5UuXlOX26NKWnnm6FX347ktyw6KdQqneK2Z29Gw1qlWU3l27D1guO9+tzZpXFbNh5mORmYQ1b8kqateysTwWMHjh2a70wdsvyAcYh46eoJOnbJf94YZ7nFCmIyKe0HO9Oss2gsH/3nuZBr83kPCQB0tVdcVLVCHKSkmpxA0a/CljWGILmdgYzAb/NvYfORPerHFdGvrlIHq+3zP02ku96dsh71GFMqXo1Nnz9Jd4+IGbcvu6oEzcuh1Kn3/0uhgTHWnQWwPozZf7STEotrMXLqc3XulLL/bvJs/9N5+9Q9joCAKYwYJrNv/OXEiHj50QylNhGipmnN4Y2I/69+lM3w0ZRO2fakJ3xYOoUaK9eOhgzqf7N27ZKev/TLRngDg3TRvX0ZMM15mMNywCAgKoXJnisuwjR05IV7ew5BxKdUBAoByXx06e1ZOke+TISekif4AoRwZcWFDAZy9cKSX6dn+avv70HTm+X3q+B30rWGXOlIlOnj1HeIAjhYTl7lgVovH+OygeoJw4c5ZyZMtKRQvlt6kPn3BC38F4Mi/ZDblzV8plFA8vFUWRfisrS+ZgGR0acke6sGKTF/ndMVjhA7mqVcrJ5dDw1xDXDrhbxbUJbkymXp1qUsTZ5mS4tm8SD4IhVF+Thd8Tc//+A7nUHnnSpUsLx8ZcvXZDhvG3xsxfRjqx8hfII1NwjZMezdq5az/NX7paPijCdf8jcS3GNe+rT94W14hO4gFkBM1duIIw3pCliXgIg2tpTH9PIOupCQkNk59uW7pqA2F8VBHnyVxGXPURPMBDuffv3YfDhgkwAR8jEOBj7eHmuE+AJX2QQM1qFQmzVqFhYTYzl66ais14oBhgk5bn+nYWT6KDbMSxaQtuBM6cv0hYpmtObCcUAPwR37J1F53TlhjPnLNUPsnu8vRThBlus3xs/Lghf/f156h/7y7UrVNrm01nAoWSW6eG+g7ZuXOXYlONR3kXLFkj5XsKhRs3ajKgWaVKFqXWLRoSFI5lKzdqsZ47+jub9Wqr7y7qJWBpX29R7+cfvk4Vy5XSowkPOnJky0a3QkLppJiVMRKEBwrjf7vUZejoKyLK4VemZDFq3LCWTXyeXDmokfbO6HntPOsCy8WNHB6qtGzagKpqN9p6Wm4xO4WHKnly5aSjx07r0fIdQDx8wM66OJdGQjx49uw9RBcvX5GbKXVo3ZTATa8Gs1C9urWT7ybuOXCYnC237tW9PaVOnUrPRiWKF6aCedWbbbjm5cLopzo//SZez4hl5Fu275azfH16Pk3mG3/0YWyKVLp4Ubp24ybpioyeV3c7tGoi69fDVq4zGW9ZqDPERAcP2yrURzSFuf1TjWUzDh9VFWgZENbBw8eFTeKhRUnpxmRhGe6nH75KLz/fk2pWr2QocMiHc1VVUxbOJ+AYR93umBAxAztFPCyBbJcOLcWMcwp4YzQYOxDCbspwnZlsmkJ9TyiOukxs8upluHLl9WKnttzbNLbLiAcsWFGBByrYgdxVGUirXKG0fG8Zn8/C+8aIMxv8XUE5RQrmp3x5cpmT3PaHa1zQLoxB+4x3tAcX+bVZZ/t0q3ABrS2hdu+tzxEPfRQlgJ7r3ZnM131FUQgbnNWvU52yZAmmY3bv0VvV4W3cJ1/+TB98Oow+HvKD/HRb9coV6H+DXqZsWTLbFBlXfUTvn9j4zKYCDjABJuATBFih9onT4A+N8J9j7N6ljVQQdu8/RJhBjenI9XcbK1csTVjaZS+vKAqVKaV+guTyFXVJnS4DJaN759ZyZmCmmOXGsrMjx09SOTHTXd10A6bLx9ZNkyY1VatcjqxumNJqG8xcvnItttW4lf+OuMnC+79QFrHTqlWmJmL2MCAgkPAwwpy+e98h+Y4tlgXamx1iZtksmyVLJhlcu2G7XB4qA5qF9zWx9FsLGk6tahWkf6ddWWfPXaSbt28THp4U1N6Lk4Imq1jhgqZQtDePdnN57uLl6EjhO3NWfYDRoG41EXL8YTdaKM/tWzexScRy3soVyjg8wLERioPAmQtq+zCTG2AxS4qHPnVqqQ8rzmrHYq4WS+PNN816WsFC+aS3YvnohxkyQljBmTLK1yGwYgKzbyJK/s6Jh1LwVK9agbIEZ4LXxiiKQi2a1pNxZ8S5kh47q4S2QZBdtE3QmYy3LPBwKDAwBR05cVrMREcYdR0UM9ZQdBs1rCUfEkAx0hPxvvExIY98yK/Hx+RmzRxM5S1eRUA+1AXX2aeBkJYYBpv7Ya8JKNUNhTJV1kn7rdr2+PETGR0U5FoBT5s2tZTDAzrpEVZs8orsMf6OnTwjH8zlypGd8udVlz8jEx5KYYOyqKhI2mH6nBbSrEwgHnjWrEKQ37B1p4PI+s07ZFx97aGdDHhoob8hSwqLd4gR/+Cxuv9DxozpEXTLpNdkza8Y6Nf97FmzyF3YrQrq3rmNXOFTweLaYCXvTVyoeIATbpotvnb9Ju3cdVAwjrIp7nEs+pe5oNSp1AeKEVp55jT2MwEmkPgEWKFO/HPALfBFArFoExSEnmLmEkXMELPF2HkYfmfmnKZwYOYMy1GtzHFtKeeV6+qyOXNZ+GwM3kk9eeYc/fXvHKmU93imrVkkzv3Xxc0DHhbMWbiCsNz42x9G00+//mewM18AABAASURBVCnriTAtS5cR8WThXWMUnUfM3sK1MrjxzJEtC+E9O/N5WLl6M+EdWyuzZPl6m6JaNK5HqYJS0mHxoGLwVz+TfNd9y07CbKeNoClQTSjUmEHZvecgmRW6Hdpy75qmz02Zsklv1myZpWtvpdKWZj96+MhIwjJLzKZiyTuUSCPBhzxntQ2gcrs4T3ra2Qu2m0XhMDCLrCjOl+IGBdmu6EAes4mKir7B1VdP5M2V3Sxi48+lpTlTqNOKh0o2GSwCzmS8ZZFazM6XLFZIviN9SttkMCTkDl2+eo2wKzX6OVz0BSzbRpMgh3fNkQ/5EeeuAbMzZy/Ih07T5ywmbAz32Te/0PzF6nLwhBrj7rQ3IiKCxv89g85dvCRfwejSUX3txp28kEmnnc9bt23fT0ea2YRpXyHADKweH5u8ehmuXH2VRI0q6gM6s6y+gdq2nfvM0U799WtXlQ+Z8Jky88aOmJnGgxi8IgQl3WkBMSToXO4JTuZrnp4tY7p00nvx4hXpumNdvHRVimXIoOZFQL/u58/r3Uw6yogL88vwT2nEdx/LDfW6d2orV7Xg7wn+fpvLj6s+os9046G2uXz2MwEm4BsEWKH2jfPArUhmBMqVLk54z/j+wwc0ccoch6fW5sPFZ34QxuzKxi07yMpAmYPM7VuhcBxM00a1ZdyjR4+oaqWyFBycUYbj2sK7bMNHjKPPh46kv6fOpZVrNtGeA0fo/v37VKVSubiuzmV5V66qDxeyZVXfbXQmnC2rqqBe0TbMgRw+fdK5XUuyMi2a2L4Ti2XTg95+gSqUKSXOI8mNyKbMXECffzOChv08jk6esn1vFeVjlq94kYKEGVJ92SFuMnftPihvarEsEXKxNdigJkrMUmUTszWxLSu+8l++pq6qyJrF+XkyztEV9ZzGW1u0PpDVblmmub6MGdLLByhYSfDokTqrZk6PjT82LCqUVWfiDx89IZugu2VLF5Nh3T1ql67nk0JuWNjh+7Ovf5G75UNBwH4MR46epJTiwUW5UiXcKCHhRKLEw5LJ0+bRwSPHCZvwPdeni+XqGVctSqOtrLkdGmbz8Ms+z90w9bN+aTV5pMcmL/K7Mo/EtXzrf7ulyNLVG+Tu1XhwqRu82oPEq+IhKx5+wO/KZM6cicqUKk53792j3XsPGaKbtuySK5zwyg4ezBgJHnr0h0gR4npktf9AxkzqzPQ5u1dWXFVzQVuNkymTunM7ZPXrfnYnDx4hk1AGM/9YIl+/bjV6780B8mE2NhY1n4+46iN3w9V3p839L6GOk+thAkwgZgKsUMfMiCWYgFcEOrVrITfHOX7qDK1eu8VpGfqS4bYtGtMXH7/l0vTt1dGynIVL18p4zIpu37mfrooZZBkRhxZukjALjd2WCxfIR9i0CBvC/PjNRzRk8FvUtbPbM0M2rYKiaRPhZiC7tpPsTScPGfRibt5SZ56y58imRxGWw2OjGiuDd0cNQc2DJccvPd+dvvviPRr4fE9q2aQeYdfdM+cv0IjfJtIJbQWBJi6dmmKWGh59Vvq4ULxDw8KoRPEiFGy6QYSMtya79rDg+o2b3hYR7/mwQzsqCblt/TAIabe1c5QzZ1YE483k0vqAq9nIsLvhchPALMHBcb4cPjYsypdVldkD2nvUh7T3p/Xl3Lqrx+tyej53oOLhz7iJ0+VrCdUqlacX+3WT16OfxEwcXhuoY7ePgDtlxqfMnPnLabuYoc2eNSu99mIvm/fsrerFdVHfqEpPzyYe9GCVQ2RkBIUKpVqPt3f11UF5c+cwkmKT1yjEiWff/iNGCpRr7LpuNpeuqLO3EHJ3llp/LWSj9kk5zO5v2baLFCWA6tSuhqK8NilTBsmd8lHAHTGG4JpNMfGAEfWE3b1LIS44m/OcPae+3lK8aPTu6zmyZ5Ui167fkq6vWLi2lBbXdrQH4wguTFz0ETw4wt8OlJchY/TDBYTZMAEm4BsEWKH2jfPArUiGBLBEt1/PjhQQECh3JL3kZKlbYe1d2rtilhd/fF0ZvPdqjwo3lNi1GO/lPtOhJT158piwIzj+CNvLxiYMhRA7IBfKn5fefeN5uWkRFE3cSKHc8HsP4DiY1GlSybj7TtLPOXlXVWZyYenvIF9y8c42bhivi4cLWM4Iri6Kc5EUnYTldng/s32bZkLReIOw1B4zMqssHphUqlBGznTu2XeYsMRyp/Y+tavl3tE1uefDcmgoE5h1cvcm1b2S406qkPaJoosuzpOehs8axV3NjiXpfeai3V4EZskrWho+52SOjwt/bFgEB2ekfHlyyw3esOEdNphCWL8mwEX46PHThGXfULgQRj5y8x9Wm6A/Y5f0/n06U8UKpQnjJkB79/2+NkvmZnHxKrZs1UZatX4LBWfKSK+93IcyxqBobN66i4YMHUmffPUz3TO9+4p3fvGAEI09cOg4HAeDh354fQMJRYsUgCNNbPLKAlxYW7V3o9u3bkY/fP2RpXl74LOyBFxb9HeYZYQTq3SpYpQ1c2bCTu34fN+e/Yfl5wbLlChK+sM5J1ndii4kHrRC8NZN9SEm/LpB/8SqHYRXrIl5k8h9B4+KB8M3KEWKIDLvkZG/gPou+YVL7i8dR52xMfcfPKAd4sENdhd39Xc1a5ZgWc2TJxHShZUiRQq5ISP8nvYv5IHBRnIPHz4kvNqD8Yg4NkyACfgWgQDfag63hgkkLwLY8fkpMZv55MkTmjRtvuXB5S+QV8YfOnyc8IdbBuws3Fzg5sc+PTz8Hs2at0xK9+jSmhrUqyH+eOenE6fPkrNPpEQpUpzuP3qoety0Q0PCpGS+fLlJUbRCZIxqHT16SvXY2fg+MKLOnLtgs6ES4mD2HjgKx9po1djPKkEYN9Iw2EEamzMhzt6sWbdV7njurXKEDYgwU7R89Sayv5HCjZI+Cx1+T10Oaq4f761WKFdKntN94hihWKdKlYrMO4Kb5b3160riuk3b1SLsbOwsjWWiCxevtktJmGAh7YERVmlAMbGvFX14s5glQ3wB7TM58MeHKaiNtf/EzXFI6B2HKnCOV67ZLOO97TMysxMrtiwqlCspS168bC3hncqypYvLsG4hjNdMFi1Vz7Uur6fH5IaEqEwKiDFuJXvo6EmraDXOxVhVBeLOhnKM97mxYd1rL/WRSn9MpZ/XFDBwu2z3cKeq9rrKwmVrCPsS2JeFa29oWJjcyK6w3ee4YpPXvh49HCJmcI8dP0UpxMPYOjUry5l3XE/sTbGihShXjuyE688B8fdDz+/MVRSFjE9o4fWizeoGZfXqxm52Wq+vsLZR4NGTp/UoG7dl8/oyvHbDNlonjAxYWOcuXKI/J88S19xIatqgpjx+XSxzpkyUMX16wh4Wzq77cxetlEvkce3W80nXyz6aKmVKmjV/OU34ZxZhozhZlp2Fa8d+7YFMGe01DF0ktn1Ef2+8cMH8epHsMgEm4GMEWKGOxQnRrs2eleAsk7N4z0pnaR8k8FSLBvITP3fDwy1bh02zqleuIDc1GTNhGj2ye28T72Ph5mLcxBmkz57pBeGPPMqtVb0S4eZKURTq/kwbOSs+T9xU6DfIujzcfNpmLseEAgyFEXHumGLF1GV3O3buJyz/Nuc5dfoc4buf5jjdj+ODIonNb6bNXixna5GGnXmxgQtm2hC2MlDeEb/fyc1i25aNkEz/TJ0n+N2Sft06euI0zV+6Rs5wNNd2btbT3HWjokg8CJlH8xatoC3bdttkw+z3lu17ZBzemZceO0tXuGfOWSJveqtWKhvny4hbNKsn391bvmoD7dQ2PdObgdn52QuW04VLl6m4dv70NNx0fvfjmHj9tAzqwkx9nlw56eSZc7RInA9wQzwMHpRMmbGQQoRyi3fU43ujoWzZslDNahXluZj07zyplKIdMFD2Vwhl+sCRY0JBy0w1tCX7SIsrE1sW5cuqCjU2MESbymq7/8MPo4exagVhXR5+d0xJrY+s2bDdQRwK0M69Bxzi9YiYxqouF1sXStLUmQtlnx/4Ym/CKhl3ymzepC7VrlGZ2jRvREUKR88yI2+tGhUJihqupTPmLjWuUUg7feY8TRLXF/hbNKlPgYGB8BomNnmNQuw8mAnFSoFSYuY4Q/roDbnsxGRQ37BM38BMRrqwateoJK6JKWjjlp1COTwtHxI4u365KMYySe9vh7XXEeyFShUvQtiFHfF4ELxKjDfMvCIMA6V074Ej9Me4f8XfwUfi3OagVto1Hum66dCmqVS2J/4zm7Cvhx4PFw8WVq3dQrj22V/zvO2jWKFRpXI5FE//Tl9IZ+xWVeE6hs05r924QXgVSH9wJzMIK7Z95OTZ86IUogrlSkiXLSZgEHCmOziLNzI6erzI4liIH8ewQu3HJ58PPWEI4Aasb+9OhPf0rGpUFIX69OhApYoXlTc4H346jEb+MYmmCyXs19GTafjICfLmon6dalTYNDty9Ngp2rZjD6VLm5aebtvcKDpfnlzUqH4NwkwVFFYjQfOULF5YfmLn7MVL9OlXI+j7n8bSxctXtVTnDt4dLFqwAGHn4E+/+YXwmZqZ85YSNinDe8QliqkKt30JiqJQl/YtZTQ2bPno0+H09bDf6f3B39GuPQcJy+JlooVVuXwpMRseQOvF7OsX3/5KP/4yQdxICS1Xk61dswq1at6QMHv0xbe/yFmJ/7P3JtC2dlV14Jznvv/HJJogYhdjlbGXxKCiorGhxCYqkgIppVRsAZVGlB5UGgWVHiSiVbFMhlUjjmoyqhwjNUY1MREVFbuIRhoNTQDpDAgCEukz59p7f9/+vvOd7t773rv3nrXvnnutNdfa+5wzzz7n7O/e++77hf/jX+EJP/aTeO7P/Hz8kaFv/+Z74JNnB+g6fae59dZb8DVfdZeo+wUd4v2TXh+4/VePH/XDT8OL/uil+Kjb3x6f93nrf4XXkz7tUz8R/lXHt7/znQ5x5zvdMex5Dh/3sR+N+8UfYzrBP/tf/qWe0+fAGvzTf/6/4cef9T/C38jwH0H7VD3v7Xb9jZZ//W9fEH8Z+f/7pV9r9HWx/jX5B93/W+DfJvh/ddH/6Mc9Hf/sf/6X+Jmf/QU8+glPx4v+/UvgX7n1rxj74Hpd7kS36Ld84z+O19rL/sMr4L3o19rP/8L/hcc84RnxjZP4qacu1D7sw8ofUeqmntk9qxb+hoN19B3xX1X+u937gTnH5u27zvX298Vn6vX2N/XTv1e95rX4oR95li4kfzH20o8+5Xn433/x/8Ed6x9GW1pv12t1ac6hnH/V/ef0k0tfbOIDH8TP6ZuMj9d72BK8v/r1b3fbv4X73Pu/xdd+9X+j95Tp0dG/bXL/77x3XKT7PfWJen/z6+fJT/tpvf/+XLz/fu5nf6Z+ununfsnwzzI3FlgYXvi7fxDs597pM8NuG+50p3Kh5wvJv/zLd20rjdyH6QL9c+54B72PfiDiL/6CO+kbsOdzFPRvNtzh0z45flW7/18V4ob50Q8UAAAQAElEQVTq4L/CfpcvvnP8IbT/8//+//HYJzwTP/6M/yE+R/zZ90//+f8a7+f+rPn+B347lv5Qmv8rwK/+8i+Jb4w96ak/hafpG4P+Zu1zf/rn8TP/078A9Z3Qe979q+DXW73ZMGfZo1/7lV8af0X+P73lLfoc+jn4NfGzeo99+nN+tryPxWfBR+Ahus/k+e2vD3zgA/j9F70kvuHz+fpmYDyQHFKBVODCKXA+76IX7mHlHUoFLpYCH/NRt8c97/YVG++UL7rv/x3fiC/S4cZFPuz/ygt+C/630be77d/Ed33LvXDvr/9apwL+KbYv8BzcQ+v6kGS/wT+59U9c/uilfwL/tKPxtj5wP+r774dP+PiPwzt0APN/VfSqV/2pU1tBEt/3gG/F5+ui0D9l/MOXvAy//KsvxKv/9A26gL8z7v3f3W3jfP8/w/e+593gf+ftC31f5PnfIj/wft+Mj/noj9w4zz91/14ddG+nw7C/+/+KV79Gh7W3TOq/7qu/DP53hv73Zf5JrC/a3/znb4X/bfG3f/M98Tl3/HuT+kODu37pF+BbdRC//e0+PH7S+/xfeyGs68m1k9DiUQ+9Xxx2ltb1BeLn3alcbHt+/+8va/25mDt8xqfgu771Xvjoj/zIuIC2Bn+gA96H/Y2/rn33lfqmxddPLiL8V3M/7ZM/UdwKf/8On3ou92HbIrfVHvav5n7Gp3xSfKPHP+n8I/0k2BdFn/fZ/wDfc99vOvef3G+6P36t3e87vgH/UN+M0ZUE/Fr77d/7gzicf8onfgIe9D33QftDgZvWOAt/Fi1I6qL20+Lm/d9keX9FUAfH5h3eUT/NJqcHe/PbcDu9zh71A/fXNzg+Xhc178QLf+dF8F56h74hdB99I+LO+unmpvn7vFY3zd2X97999t+IcP273/se7fW3bsTb3l7+iYpr94H/6cTDHvxd8AWhf2PCrx//t2T+BsvXf91X4du+6R56vSzreZa58/v22te9Aa9/45v0erh18m+H53UtjvcVfaPz/e9/H37v91/c6K32S+ofIPOvlH/hnT97a+2hya/+ii+JKf9O3ywNZzZ4j37jPb8GD7z/ffAZn/rJeM/73qdv6L4R/mOX/lsQH/NRH4lvutfd8X0P/DbMP9f6pb7ua+6Ku/+ju8LPj7857G+6vvyVr4b/2vsD9Lniv7zd19s/yx7136vwuvf42q/Ax+qbmP6M8TdU/+NrX4eP+PDbxmf3Ix5yX70Hlz+a5tvrcdo94j946W/IfuWX/cO1347o108/FUgFbq4CeUF9c/XPW7/kCjzpcT+A5z3zifC/ld71UO7yJXeO2mf+xGMXSz/kQ26Db/6Gu+MpP/pI+K9nP/Ih98PTn/To+Avad/qc6U8q/JPTH/nBh8R6vlidL+hfsX7y4x8a+flc1/qC4ZE6OD/9yY/Ck3/4ofiiPf96r3/K7ovUZ/7YY/CoH/huPPqh3w379/zHXxU/ibUWz1DOtzHHl37x5+Fxj34gnvojj9TjehS+WxfK/onaR3/kR8T9fPxjHjyfErH/n+0nPe6h+PEnPBw/IXyMvjkRiW74R1/+xfixJzwMj3/M9+HhOhT7r6U/4bEPjr/m3ZWd2vVPRLyetXrE9903NHvakx6lC9V7wt+g2LbwbW69NdL+6QK5fCB3wXfe516hw+fWXy001+MzdeFrfX3x2fPN/+x/cIfQt93Hn3jiI2LvfMVdv6iVDJYkHvKAb8MznvxofNldvmDgdzvTCv/03ffJIDc/Ns/yr+b6j0c9Rc//I7///njMw74XT3nSI/Ed9/n6xYPzrn3hbzD5dv2X2r3+HM99xuNDT19Az3N+zvyT6qf96CPw2Ic/AH6teW/9wIO+A//V3/nb8/KIf/yJD4/1/JiDWBj2qfG0Q7XwnIZvvNfd4n7c99u/oVETa966uG6S2DPwf6/0iO+/L/ze8LAHfaf21IPxVL0n+bdB7vj3Pz1u26/dpeX2ea0uzes5a+P7v/Q+4t++cW4fPPbh39Mvu5f/d/72R+NB330fvac9Vvvie+N17vfjL9/jYuYsc/s79/Ef97Gh8bN/4gf1E/Py3tHnl/yHPeS7Yo7fY1v+W//7ewS39A1F/8q7NfzJpz9u8Y+5+Z8pOf+Vel9t6+1rP+kT/2v4G1P/+vm/ET/Z3zTv7336J+PB+ubVs5/yg3ii3rf9OvRz/rhHPyh+E2DpJ9P9WiTh++nXnN/3/Rp++o89Gj/4iO+F//haX9v7Z9mjJGFNvLeerc/xH37EA/VZ9mh97jw4Prt90d3f1tw/zR55/q/9lt4fPxR+/c3XyzgVSAUujgJ5QX1xnou8J2dUQJ91Z1zhYky/9dZb4EOlL9L/evd/nl6Pe+cLCx+gSR60vH/N0d9x98WH7+8hkz/0Q//Gqb7T7guZbX/J1xdOvgjzYfH2t7vtxp8mHXJf+1qSsFZ/9xM+Pmyf2+S/5z3vwa//5u9F2hfU4VzHgRzvo/8/5V035W/i7Ko577x/6uQ/+PXxH/cxO78Zcebb3rGAv/HkQ65fa9v21o5lTp2+SFrMH4TfG3xx5G9g+aeK8/y2eNdrddvci5Dz68IX7369k4e9N55l7kV47OdxH/xTav9Ww6++4Hd2LucLZ3+D169D77mdE2YF7X3fr2G/nmfpjeFZ96hv92M/9qNwms/offfIK/QT9z948ctw17t8IQ79nN34wE+ROPAlcIpbyCmpwOVXIC+oL/9zmI8gFUgFLpgC/oNr/mM7/qNxb3v72/G5n/WZOI//luaCPcy8O+esQC6XClwFBT790z4J/untZ33WHa7Cw7lpj8F/RNE6ftmX3vmm3Ye84VQgFdhPgbyg3k+nrLqACpDrPzkgC/f+95c/uHIB73bepSuugP/P6cc88Rl4+A89FS/4zd+NX9e7+92+/Io/6nx4R6hAPuRUYKMC/unt7W/34RvzmditgH+Kbh39U/zd1edb0c5QZDlT9auT61yfTz8VOEYF8oL6GJ/1K/SYyekb+2pV4ve+931X6FHmQ7lMCrz5LW+N/4rGv7b/hZ//2XjMw74Ht7/dbS/TQ8j7mgpcQQXyIaUCqcC+CrQzVDtTtXlkOWO1OG0qkAoUBfKCuuiQ4xVR4OSkbOm/eve7r8gjyodx2RTwhbT/sM4PPfIB8d/03PZvfdhlewh5f1OBVOBmK5C3nwrcRAXaGaqdqW7iXcmbTgUuhQLl6uNS3NWrdieXvsu3xF21x319H8+1VdnS7/rPeUF9fZXO1VOBVCAVSAVSgaJAjldLgXaGameqq/XorsqjWbpmWOKuyuO92I+jXH1c7PuY9+7IFSC3v0GQY/7klmuh1jve+a6wOaQCqUAqkAqkAqlAKtApkO4OBdoZqp2pXE6OZy3Hc5Db8/P6jFOBq6RAXlBfpWfziB4LufzGfcu1E6xWxLvf/R785bv+8xEpkg81FUgFUoFUIBVIBa6eAjf2Efns5DOUz1I+Uy3dOrl8BluqTS4VOAYFVsfwIPMxHo8CJHHLLSfxgP/8be8Im0MqkAqkAqlAKpAKpAKpwG4F2tnJZynyFBfOu28iK1KBK6dAXlBfuaf0uB4QWd/sVyuQDNzm1ltChLe+9e34q796T/g5pAKpQCqQCqQCqUAqkApsVsBnJp+dXOGzFFnOVdAZyxxJmyuFfDCpwHkosDqPRXKNHQrk+88Ogc43vdIb/623ln9L/ab/9Ofnu3iulgqkAqlAKpAKpAKpwBVUoJ2ZfIbyWeoKPsTL/pAOv/95DXK4ZqeYkRfUpxAtp1xMBVYo7xr+ELhN/eNkf/H2d+It+kn1xbzHea9SgVQgFUgFUoFUIBW4+Qr4rOQzk++Jz1A+S9lvZyv7iVTgMAWOp3p1PA81H+kxKLBalYvqk2sn+Gu3Kb/6/brX/1n+gbJjePLzMaYCqUAqkAqkAqnAwQr4D5H5rOSJPjv5DGW/nansJ1KBK6/AGR5gXlCfQbz1qeVibuBn4cCncyYFellJon0X9YPyoUYSJOOPk127Vrb4a/70TfnvqaVN9lQgFUgFUoFUIBVIBZoC/nfTPiM59pmp/TEykqbQzlY+a5GFc2L0HCUuvAJrT9gaceEfwkW+g+Vq48bew7y1VOBgBcj1Fz45ciTjItoLt++ocrXCh9x6DScnK7z3ve/Dq17z+vxJtQVKpAKpQCqQCqQCqcDRK+CfTPts5DOSz0o+M/nsZGFW9Tf+yPF8ZZ6kzQTkOjcpyCAVuOIK5AX1zif4FAX7vK+s1awRp7jhnEKWLb1arUAStn/tNtdkGRfVr3jV6/LfVCNbKpAKpAKpQCqQChyzAv430z4T+WJ6pYvnclYaz07WhlzZJC6sArNrh1m4eLf3qVmcmOQ2BfKVsk2dy5g70vtMju8QJEESvphenZyE/yG3nugn1YSb/53Qq1/7xvwVcIuRSAVSgVQgFUgFUoGjUcC/4u0zkM9CftAnJ4TPSCSxOjmBz04k4+yE2khWL00qkAosKbBaIpM7nQL9+832t55Zdhae7tYv56zT3uteMpLxxt8+BFZwDJCEm3996UQfErdeW+EWfXBAzX/J8k9e8Rq8Nv9gmdTIngqkAqlAKpAKpAJXWQH/erfPPD77+Azkx+ozkc9GPiP5rGSOpM5PQDlLcfkCG9kujAKc35M1YijoM3qaBz6dsyuwOvsSuUIqcGMUIPu3gnKb5DrnP6BxwpU+EAhfZBtcrfQT6hP4D27c5hbihB+E21vf+nb4V57++OWvwevf+Ga87S/eET+5fv/7P+D0HBmnAqlAKpAKpAKpQCpwoRXwGcY/ifaZxmcbn3F81vGZx3fcZyCfhXwmahfTPisZJHVGWg1/jAxdI9lFxSXXuZLJMRU4HgVWx/NQz/5IT/uWUeaVcdO92J7dNCv5pgDJ4QKaZHwQrFYcL6jF+YPCHxyG/4rlLasPas4HAXwQ7373e/Dmt7wN/kuX/u7ti1/2Svzhi19+yZH3P5/D3AO5B3IP5B7IPXBse8BnGJ9lfKbx2cZnHJ91qB8m+OzjM5DPQobPRiSH85LPTv7BBFk4spyvkO3CKcCd94jgzprlgtPOW17t6rN5QX31n+Mr+wjbi51sXnmoZIlXehvxB4M/LPyh4Z9Sr05Ohg+Nk2snuPWEuPUaxH0QpH8qbXwQ2W6CAnmTqUAqkAqkAqlAKnBOCvgs84E426z0AwSfdXzm8dnH56KAzkQ+G/mMFLF/EAHG7ZPFRqCBLHEZRWRPBVKBQYHV4KVzBgXmby/zuC69QBeqjLUqzRYFyM1akQRZ4A8Gf4d1Bepi2VjJVugDxB8egWvXxJ/ownoVuOUEuOXkg7i2en/ghO+DscJ7kUgN+j2Qfu6H3AO5B3IP5B64KHvAZxWjnV98lvGZ5taTcr5ZrU5wojPPST0DrU5OdP5ZdaDOOe03/FYgOQAbGskNmaRvnAIEl25skXThPDGPXZM4VIHVoROyPhW4SAq0twGy8b3YPwAAEABJREFUeQDJwGpV/g3QCtQHhjF+cFC5tQ8Wfbhcu3YLTlYnuHZyLeyJOOOaPoQS15AaXFoN8rnL13DugdwDuQeu8B7wWSWwGs8w13SmWZ2cYHVygpMGaeAzkM9II3RG0lkpfhCxWoFkALWRDK+M4eaQCqQCnQKrzk/3BiqQb0qnF5ucqtcikmsfAP6wiA8IUB8m5YLaHyrX9IHinD9UHPdYnZyUDx/VnPjCWlitxCWQOuQ+uDF7IHVOnXMP5B7IPXDIHmjnlROdXVYn0k44mcFnnpUumH0Gcs7+yYnORjojxVlJOZJojSRIRljGcGMg50zQOdxEBfIZuXnir27eTectpwKnV4Dc/LZBcvgA8C2s9AERHxSgLggLSNtVfLd+dXKC1ckJ4kNIte2D5sRchbk5+nz60q9qlVqkFke3B3LvI5/zfN3nHrhxe2B+HnE819+czz9xttF71OrkpJx5dM4hiZX/vbShs1GckVYrtEYSJFu4ZsnNubXiJFKBI1BgfPUcwYO98Q9xwxtOT/dvSj1/4+/spb7FJh1ZPJLxYUAW6w8VfXpghRZTB0BFyjvnDyLb1ckJqA+V1ckJVifb4Q+pxDWkBqlB7oHLtQfy+crnK/fA5d4Dq5Pt55PVSXeW0ZnmRLHPOGQ5+6x0IU0SK52JsFqpy1NMljMSSbiR1TpIXCwFylNT7lN9niLo+SDasDHRCtKeQYHVGebm1FTgpipATt8cWkQWjyRIxn0kWXx/cIA44QoksVoxLqz9QdM+cGyNxtlPnEinRO6D3AO5B274Hsj3Hl0M5b7LfbfvHujPLs0v1hfO5Sx0QvkgsFqBZABq5NQXBXroQM6ZLpluKnCkCqyO9HGf4WHXN5Jq9lvooOL9lsyqRQWa0mTxSIKcQYeT8iGymlxYq0wHN3EnK6VX8k8mWOmDJ7EKbVKH1CH3QO6B3ANLeyC53Bc3fg/ML7b9HJycrHSGWekMBH1uU5b1zLOCCFBnIZLBk6OFGkmNQBmR7VIrcMCzOJQOzqV+5DfyzutVdSNv7pLf1tr+4inebHjJRbhYd59c17MxZPHI0ZIEWbDSBbI/VFarE3Er+Du2ZMtRKftQrmC1YnBpU4fcA7kHcg/kHrgSeyA/167E57qOLmtnFdJnGNazzUqP8wQa1Feq5QRQI6kRwUOtRHK6Ti6xXUG6F0SBw56nUl3G4QHMwoFPZ1GB1SKb5GEKHLDppqXTCJjHyLaHAuS6bo0hCXI3Viu9FISVLq4NcgUK9pdwolxiFR/UqUPqkHsg90DugdwDN2IP5G2M+2zpbGLOZxfDvoE42/hMs/ssRDJOXWUMdxjIJXZIp3PDFZg/H2M8envcqYOK91jvSEtWR/q4L97D1oZWv3j365LcI3JdvZ4hS0QS5IiVPmjIMSaLb94gS0xOrT+gEnr7kH6pQ+qQeyD3QO6B3AO5B9b2AK6nJiQn5xmyxD67GGSJydEu8T7mkbQJjF6EMZBLbKRyuEkKxDMSw026A3mzEwX06p/EGZy3Ats2+7bced+PI1iPXBfUjOGHTzI+fDb5Sx805gyyzCXTkqkBmRqQqQGZGpCpAZkakKkBeXM18FnFIKf3o+c2nX+CB0CsN3KJXa9L5iYrsO1p2pa7yXf7qtx8XlAvPpPznTePFydNyfmUiGOodaNfvDLWZJpTKkAu69izJEEyboFk+OR26w+kOcjtc8jMk6kBmRqQqQGZGpCpAZkakKkBeTYN5ucRx+R+a/rwQ5Za+wY9LIDclFkovtFU3p4UIKhx7H0kX33MyZvHonb3+aR5vHuFY6jIC+qFZ/m8tsp5rbNwF5PaogBJkFyrMNPgJMmoI4td4siSI9ftIR9g5Pp8MjkyNSBTAzI1IFMDMjUgUwMyNSA3a3Do2WPpbBOcBlbITDrJOB9NyAzOpMDNnsxzugPntc453Z0Ls0xeUPup2LQ7NvGes4ZSTBYLNItoQzQ4GCuGOch2jgqQBMnFFc0afZJk1JPrtq/rfXK9lkyOTA3I1IBMDcjUgEwNyNSATA3Is2vQn0F6n9y89qROAYWlTjLOQUu55C6oAnrOfM/ooaEG1TRWtjBksUCzmLf1eFPpJn59hSvNHPkFtXeBcehzfMicpVpx6ofeatafTgFys9jO9Nh0CyRBJsjUgEwNyNSATA3I1IBMDcjUgLz5Gmw8vyjBDnIXO+mqxVSSl0WBeApjmN3jJW5WMoSH1LZJnmO0+Ebbm397R35BfXOegOPecjdJc31QkLuVd0UCSA1Sg9wDuQdyD+QeyD1w+fcAdjSSILmjKtOXRYF8Jm/OM3XQBfXNuYsX+FZj18YAVIONbVNBx3fuxmUycSYFSIIsONNCOTkVSAVSgVQgFUgFUoFLqABZzkEkL+G9z7scCkyeukkQ6TJs4ksWQ1qOemXTnEKBq3xBfQo5rtOUbZu05oop43W6F7nsTAGSIEfM0hmmAqlAKpAKpAKpQCpw6RUgx7MOyUv/ePIBWAGCNsbgOJhhW25WmuHpFTiKC2rvJeMQmThu08k0TqIDgza52cltHLhWlp+7AiRBbsa532AumAqkAqlAKpAKpAKpwBkVIDefXUiecfWcfjkUqM9zNWj2FHd+01QeuCh124bMle9HcUF9Ps/i5i2xMaOE+nDzxS9jI4fosr3htQdwRJYkyASZGpCpAZkakKkBmRqQqQGZGpA3T4MjOorlQ+0V0J5zSA8TEOzi8GPoyOpuoPfK1qI0UiAvqCXC+fe2Pee2vyXl1Hsm/eunQK6cCqQCqUAqkAqkAqlAKpAKXEkF4poihtnDa9zczsoyPJMCeUF9qHxtPy7OK8n6DaOFipJ3YvTWIzOJo1YgH3wqkAqkAqlAKpAKpAKpQCqwQ4HximL0PGUamTHGa5TlvGsmP94OIoddCuQF9S6FduW37MddU4d8XaOagU4nFbgcCuS9TAVSgVQgFUgFUoFUIBW4UQoM1wyDc4ZbPo81znDzV2FqXlDvehYXNlmhyjiZvkAN+UlOgXrJcfxG0Phto5LKMRVIBc5fgVwxFUgFUoFUIBVIBVKBy6xAvWZgPIYylguK6pvvXIcTLOZYlpgUKqCQfasCeUG9VZ55ctOO4vIG9HRimlOMbKlAKpAK7KlAlqUCqUAqkAqkAqlAKrC3At21RrgxrM8udBk3Zdf5ZJYUuLoX1N4fDUuPfM65ds5tiveqbUVT2yIvTV9q055Qv9MkL3sqkAqkApdVgbzfqUAqkAqkAqlAKnAjFGjXDrqWoK8p6m2yWgxcY5rF5rZHyTB531rXNQyTr5ZzdS+oz+V58rN/6EJlTtvj67NLfp1PJhVIBVKBVODGKpC3lgqkAqlAKpAKXDUFlq81xmuT5fx2FU4zZ/uKVymbF9TxbC5vkmU2Jhw2tIUmVoF6WYjD95De8d4PFirHVCAVSAVSgVSgVyD9VCAVSAVSgaNXoF0rMJQoY7mQkK/e04UP5kxDW3Z9kc2Z9dqry+QF9Zme234TVb+abctOSxSpl3ride96f3FzTAVSgVQgFUgFLrECeddTgVQgFUgFzl+Bcq1QLx7CxBA3NHoRLg9D0eCorvcVZj9Igbyg3keuhT02oWpQTbdiY1i/QcSaaxaVR2mi//itf1X8HFOBVCAVSAVSgVTgRimQt5MKpAKpwKVQIK4VdM3Q7mznimoR6zUGxbk3ax81B4zOxMXQptMGOp2pAnlB3etxzptm/LcK/Y1UP24rhoFw9IZ3vAcv+4v3VS5NKpAKpAKpQCqQCqQCcwUyTgVSgWNUwNcIvlbwNQP6q2H7hcRS23pNsjRhF7fltnZNvYr5vKA++FmtO6gaeANj3obkJBFsDBhnRaxBHW6yz3/NX+B17/qAo0QqkAqkAqlAKpAKpAKXW4G896lAKnBmBXxt4GuE4SJC1wxwEDY8RFOsHu76sJSpXDXwmsh2iAJ5QT1Xa9hMLbFGtMTURlkMWNyHw7eGak1X1BhPbP6/esVb8yfVyJYKpAKpQCqQCqQCqcCNVSBvLRW4aAr4J9O+NvD9KtcK/WjWKBzaNcZw7YGxtRLXDP6YXvZmhbNwec5xsVf4gtrPdsM+T6pr1+sGdnBcU4IyOh4x58g5o9pGhdWgLhbe23Crc57/6rfhF1/1jriwfnv+9W8rk0gFUoFUIBVIBVKBVCAVGBVI74oq4LO/L6R9LeBrgniY9RphvGYwqwsJdXsDH0EZyJascTGTcawYvbZWx0zmoBVgV/MKDbtqL2f+Cl9Qrz8h5/5UesH1m6nMQnJG9SGHTTl60AvgDe94N3751W/Fv3jJm/HTL/oz4U143u8bb8Tz/t0b8FPG770e/+R3X1fwO3+K5xq//Vo897dfg5/8LePVeM4L/yOe85vGq/Ds3zBeKftKPOvXXyG8HM96wcvxTOPX/gOeKTzjV/8EBX+MZ/yK8TI8/VeE5xsvxdOf/1I87ZeNl8h2+LcvxtOEp/b4N3+Ep27BU/7Nv0fgl2TPHX+Ip/xSIjXIPZB7IPdA7oHcA7kHcg/cvD3QznjnaOv5cdsZM3LdmdRn1MAvd2fX8F8aZ1ufb5/us67OvM8I6Az8q0Y5F/uMHNCZ2WfnZ/26ztA6Sz/7N14Z5+pn64z9nN98VTlz6+z9k7/16jiL+0z+XJ/NdUb/J0Y9t/+UzvA+y/tM/7zf19leZ/yfftGbdN7/szj7+xrA1wK+JvAFBj2gjcWaGj1Hwhohrs6zt4bF+rWqvQgvZexVfEWKjuqC+ro/Z/3u6f1hA7N6rHel2RraDFRx+hG6wAaIMCAgeAxbSLkUC3QDoCBYQo0opZQP+baCSI0m4EZSufAQjmNQPgD5GsKQlCUAA4Big6SMAITVYKcDhuaqQJuzpwW1xC7sVbRrkcwjdQRSAyA1AFIDIDUAUgMgNQBSA2BfDfY4SpEEeQCgWgGtUY7mowNJMGiCJDQUwI0KG0osAqC7BwKeI8KGFAc12fBkEbmIgPChpji6BnEi1OWXDsQ8GxGgvqDGQEnJL07hNJYu3k41dkc0kt16ztJDQefWosLneGYF8oL6EAn7jVjnFaqMher9yqxTGDZy5DRE1wA3WXV7aC8oxepBAdULo0EdauTgOILLyMY5lK8enm3NkQ4AyNojNaqLEEUBagTclaMcGcUsqDFJkATQAMCxQFKuAEO0LMRtBwACAaw3KrETug1SVQmQqQOZGpCpAZkakKkBmRqQqQGZGpA3QAPoNnZg/aQnhj0U6L5iAwh/IUZSvoAGuFEDRTUoBIFaEwYESXFQo3wIBCC4KyejMEaQxcpxB6A4egxwI5tvK4gki3U5PNQwfMBMHQDMawFQX+72igVsMWtt6pRmF3JpGpZJZNugQF5QT4ThJGoBt+0qtqrRjtToDVlR6grbWKwIDDcjSl1xjCBtDVPNQk1+dA+CmajFOEc0qQGCLFksZAm6EG4kQRIaAoS+IoZa8UmGD1uBJOJLFg0QI18dZPOLBag+giTILenRxjAAABAASURBVIByDdvqtuSgXIIT3VOP1CP3QO6B3AO5B3IP5B64kXuApG7uFIDmNOxYA8oPgOYpJnvr4xAB5SDeIIn4kkUDxMgnCciPLp/FESXPsQA3WTGArEGy+CBIyocai2/PnKwIiIUGQMNIE6URJKtL0F4McpoNtwWc1ig3doZbxnDHYZEsaZYVSzAZOYlOGVyZaXlBvfZUaoOor9FrxLxoHmvChGpBs10+qBi0bYtF56G17kUF56NUQ+mi5ECt1hUjzr0ETqK4JgH6KwjCjSwWtnIJfVUf1S8hAcUogQwRXzVGWKpEQMFIEeQIBZM6tKaaIXdKnxxvh0yfTA3I1IBMDcjUgEwNyNSATA3I1IC8vhqc9TwX89v5EJQn6D5DICnTA4qhxgLlgwgLuUR81Ri2CAZ2SQIQ3OWz+pAPNZIa3SlKAOHuoaQUAyBl1eXJR2nm7MnWlCLWPFGd0aI0ZeS0sVhAVh1uzdo3P7EKJnnF0efkPI6i6RAlMUz5o4g2P8i8oN6szSTDYXNO6AgYYx0iYFfNSOh1EzYGBZUt4VAtVh2OwwJQLdTISsioA3UotANWarQuGvJUpEAdUKUtZd1bDJMQK0sSkA9bgdCXLAxQKYI07BKAoLgYgqxAtYqxAapAQHlSXgJk6kCmBmRqQKYGZGpApgZkakCmBmRqQFYNICtA8RJI5Q1Ua19QqGMrATkkoS5QoQBBBEl5LJx8OSAZsC/HHQBrJ5QGUCxJu0CNbSFOrFyCcPNIiFZAoPSwUCNFyGKwEQBBxyC3WJPhtVoAoxsZDGNx4Na5DidgnTEhM1hU4EJeUC/e07OQ1GRDZu++qX7CT4LlpSclk2BSP256dNuX1SfchlEOawayhNo4RFBCjwTJ4GCjIULZ0kWqQyShL7rUA0AyADf5CkD5JEESUC8DQXYAgQbxo0uQFZBtqJzCOo2y54RxUSB9IDUAUgMgNQBSAyA1AFIDIDUAUgPgemugsx7ODQDimEiQAjo4rhAddVBcHUSlYlKe0HglQBaOUJMvQg5kGICbeHWIAYqD4kNNHmXEuEMDaUKQ1QiIQzRFpSuSE6OsOlQTBm5UVOw42gO0JDY3jqnOHcm51xV17qRqEz8p6gLXGx11Vd3juKA+t2dvcVcAA12dMDGgtOJPNr4odazNNdESYVVSLYYFKtHiCDVEjwEA9QWg1pCOWWOKZvHNG3AMoPqkYwEQxQKoNV5WbOHlywEINQ2KSYKcAiDQoBxmIClqAyD+NNi2ZuZAStdE6pB7IPdA7oHcA7kHcg9czz0AnTdOgy33CcqtAQQqSIKcQgQARkefg7kR8kAyALfqi4FIwV2R+BJXH1SCGgXnoCZLGYgtXZF6i+GmGhu4AGo1rgaF1iT1GgCFDDOhAQzzEBmUJl998O0MsYMeGxN9UfpVgaO8oPYWMaoGe5thzuCMUxeocQsvJYeskupeadz8GLKDV5PkWBxexEQYMMpZLUQSkPEIyAEB2EKN0BflyEZXPcKBGuUJ5gxFkCUrpwrHDVRM6KvlZRFQAtRAkHNAXI+ah6ygDNCs5iIhOZjIfZB7IPdA7oHcA7kHcg8cxx6Azj0VlA3ouSflcS4BQY5QFgCjQ7xBUkaAAUDxAECu+MaBJkAS/lIQ3QNJG8CZcDVATXx4sopAEiwO7LAMgKxSgCzkEGqyGhVGBDkorcRlrEwLwsagRLNyW69UNY0Nu8ShktVE3b6D5xj71l+luqO8oN79BB6yHWptNcPaEccwUHbIjpOrLrqM8C4OV0P0GADx8mRiBFmsHIRXh0IriM6aI9zIYiGrLqPYDgiS0ACAKK4tHQpEfNFuDIAZFZIEWSBHNAeQFCVAaH5nIR/U9guwzIOsQVmBJJgAyURqkHsg90DugdwDuQdyDxz1HtCDXzwvIs6SPlNuOC9h5EGWNaolKWqEkuotlgtqMGwI0oAaoUBdFkLwhEzwUCOpUV3WHkG4exAFOBgoOQDIYuWgeBqjxwCYlRsWbjSDMiAaybDTQZz6hBviwZmkl4NDapdXuIqsdt9VfFjn9JgO3DOlvIztHozR6GHY9R1X3WoQrQVhOcxyjh4MOXSGJSivIQXqEF9MjCCLNa8AEVWOikgCsgG5JBUxQsi3Q+iLAGosB24kRVVA1qQhHgugciOI+FIdKW8BEHc6TG4IIHA9kWsDqQGQGgCpAZAaAKkBkBoAqQGQGugAdoqzHEmQGwDxgVFeqHYRAAgIBDkC0ahRCB6gvjxCMWiPIGkHgKxA0iOihS9PFmKhRlKjumzxNKpDeVGAbOki1aFWjTw4BXhsZLOAWUTrOAxsTxa/jOgah+qO3O5ye/rYs0dyQe1dYBzydC/Xs21BLqy1xKk+6HFAeSHV+QoiBY3qkBUFyEKN1Q4mkgRkNQLQGD0GQLFSHuWa4+jbU5IkosmSBEloENTlkzVGsSRBFoAAqk/SrmDL4DWoF5/kkCM7H8WHuH1BljlkWvLcNJD8uRaZGpCpAZkakKkBmRqQqQGZGpAXQwMdVIZz5S6f1H2GYLsAiAuAsSZJkIZDW9oR1INn5DUAoDpBFoAAqk8qMABRDMhTlw+GhfKEvgg1DdFjiFgeoBoNMhHZhRtBG4GIEhDuHuTJxAi3kg8PrimZMqJvC5TrXcLmOJiAk2h34Hpjd+VlrziSC+rr/TTNN0uNqxluvYvJLlBBicoIb+RwNUTXALU6pxpADumcEN2DAEG8OhC+RyLiMsh3TEQTpw7qC8WBfVIjVSELMZAlKSOAoqYgCXIdIkstCBiqgUBS5joDWj9xRRTI5zIVSAVSgVQgFUgFLqUCN+DMB91GAASMGpMEuQ6RKuMAQl+1DrJKqJuzkQXlAFCO0BcByIcaSbm0BznuoL7cRUBpGQIQFDAs1OQphuGIGtxbDBHq6C3caMbOAJKDv55sqa4mqHkcZA4HKnDUF9TeQsZWzRYK2HYp+5klKGPHBxFDR87chRcAfRt0nYboGhyat+3mlIxGcRoBWURjdQmoe6gGKATIYADIytcoT6N8OYAGGl1sDorVZSILj4UHFAgsUMAGFmqYJ4eckH0BoHnbgd1t2/qZA1KD66dBapva5h7IPZB7IPdA7oGyB7BP05kQW7BBS5IgGyC/AuIEReqsAILSwIaYC0BWAwCWrpj2DQKosV37IuBGBiNXtvTBB4iSJqIpCE8WoL4wtuAc0oNysuqQV3oEEaK1YU4j5lZz1Ht2DEfP67uGzXHQwOYsW6eN5exxsMd1Qe1n29j7uT2ouKw6TBmc4Ieo2/jkwALyS6RRHWrVFE8BQbij1crCTVYZe2g5Uoy6CFMAFARHeQIBOAZBFsgpXI3FimLlZECQIxQAoHoBSZAdUHyI2way1JHVQtZocVqQ0iSROlzHPUDmHiNTAzI1IFMDMjUgUwPygmkA3R9jdr+geBvIHfPAOMuSBFkBigPQxaS5ESSVJgAhfHvFh+KIFNpClqSNQsItRnH2ITvEcgjCvQ7FhZpoKComRriRo4/qd4xLhMpUI+KAfsAklxoHrH7ZS4/rgvpcn626U6opS5eg7uNCeQyaoP1A5/XFotVVoVEdmjGmRUTXADUl7JExArKkfcA+5DIGArIkoQ6A6gWUH1wZFDklNmIAtgIpDoIsBiiNwpGjhfwAqIICkiD3AFRjLNRCXIKDpqlFanHkeyBfC/memHsg90DugSPYAyT1cTcDFBtLuQUO4gLgsGdIguwAKgdAnEES8SWLBkCuWMWEm0b7NvBQIV80SMUQZBlWc+RrBEloAECQAtRkNSIiFi/G5ldbjVMBMpjwodlQK4xGdYVDH0u7xOAOzlCfzn4K5AX1Pjot7K8FamGlDVVBxzCbU7h+hF4Yk82vJMUhGstYTPVbIFs6SDklKx8BjdEdEPoigKizY5cKCcAA4JxAEgQEjfIxANGI+iWelB8AZMpQHAAE5nBuAqCVTGhNLTFBJsjUgEwNyNSAvKga5P0iUwMyNSBTAzI1IDdpoGMfp4DiEQo0Fw1QvISarwYkR0C+ADdqUA4VhL8Akh4K4MbgSDoQZOWrg/pCcYIPl3IRA0iCQxgeyGKDHtziEIR7HVBKxcGNoE1g9CKMQZx6uGvDxsRQuVixSA5T0qkK5AW1hNi+V2q2GpV3vZLVdAmUF4CZmgxD0JQxOAA5CTC0gadqGksgegzyZQGQsgYQviIAGjsO4YsDQRaUGkAExIBk+HIAECW0LYBbIZUrHCkLwVbABqgCAeVJeTuxAtmwXg/NTxCpQWqQeyD3wLnugXxvzffV3AO5B27CHiCpt7I52jnQdp7bEEO8AK23BFJ5A9XaF9AAyO1zUCNEBkjCX5AFoUaQBQABY4gByNeAyIQPQJY0A9iHXJYBsAVQ0kS0EoRbE+GTNe+ousVoVDcNFKcvRWslpWhw5Nc+UINTE6PZnBlrjsFbHcODHB+jn3ZjZM7iLa80sqNXbyUI1m1tjh4C5OhD/hB1juioBURG1wC1SNAsED5gSxLRbOWqi9aoHjyISHkAAdswRHwRQHDhwI2kqAI5pgrERyxLljwpq6zHgGOh1W22MQkgMGBwRpLiEqlAKpAKpALHrUA++lQgFbgaCoyHPgI64wU6t1HYcZYkqRIBDVqpcbLogdrEkaqvKCzRakWD/ipO4WtsSgSiESAJQs2DfHkgFRglgCJ5GitHMxRlK1PoIFCpYkoCbmTNOyjZcexTyk/DaaR0nWfvPOD1jfNY63KscWQX1PVJ8XNs1HBvszCHbQuyX6UG1aDVoLWaCBNDJMjRh/wSaVSPAhCiiwuidFmohaEpkGxE+GSNbeUS+gqftY4gDUAjoNEdwZkRqm8uAHFG5UnFHWINqInDDOS0lpzFUDzHvCZjkNIpkTrkHsg9kHvgMu2BvK+5X3MPHLIHoLPOHDvmQ/k16EgKaC3lyAWrnPNQziBrDYqFYhBqlBEIkBpQIZ+kIioBQL4GGQYQrfisPoojI0cd8qAWU6tfDKuhsqWTow9nh3BwUFqNq4FrUVvl2HM1tUS11EZLZQyZY+vHeUG98Cxvf/63ZxeWG6jJfjdbl6oGaxu2nyC/1GlURzRCdHgAa5eFWpgYEDUxiFcnCcrCo/wwAEix6ogmR7F64aHYqAZKEPWLmhDQIB4G5AcAhyRll6EEAAIBTJvmIYHUQPsj90Hug9wDuQdyD9zEPZDvw/lZfAH3AOZN9xGC3itIgtyENo9yBNWpGAXNEP5C5AAQah4I0nBID4K6XJKg3BjkQ45j0iNKk69efOXdHdAOixdj5zsFDYWKEdHGhSJUSdihYnCCxry8sPuOs8W6aZszXdGRuHlBvfcTvXnbECyrVDMPCl3GyIXLNgvodjoBhR5RmnIl0ii/kqqRJwrQ4K4cqw/55gnI1RgxoECdINw0mhcohtQoyAVsUWJytEqocwBJkBWolk7HYGcdqhOpkSATZGpApgZkakCmBmRqQKYGZGpAnlKDnHfcZysQaNCvU9RmAAAQAElEQVRewAJIVloWQsTFQv4AFI4cbaytWCmQlQdFV8iXB1KjATVZkqBceJQfRgMpVr3wGpsPNedcIxfh24FcguhazRVOo/qY5bS2j1iq2HOF6kZ2frrbFMgL6k6dvbbNXkVt0VpcDfpNGxxHpr4gsNSUY+Pll0mUITQAZQjD8Bk+XAvqC0D14SafrHyNI0+A7Ut5uSaA6pDKUlFAQ+XFRC+h+KgjSAEzmKPKBaXkABB33YDJDQEZA6kBkBoAqQGQGgCpAZAaAKkBcBM0OKrbvJ5nvXrUG2+CejZnUJKkJG8AVATEIE6WJNQrCKCiGSUpzpBRmgVADcc4mKiHWuVloEoK7ohG2KcHgwA0D2p2m69wvfd1ULX6WFSDauA89mzDnM31e5RsnnwFM0d6Qe1tIKjP95epzc9zzVbT17EtxJ4d/brnRcwL2GYCY5Fc8V0sAgQCMToAFBOljAAEd8O+IR8qIPRFVciHATVZkgoFhQDVG+QqplFrIBsAAYEkyA0AAUN5bABJpc4AaO4unPU2cj5I6ZxIHXIP5B7IPZB7IPfAMe+Bsz126CyxC2fcX9D8jUC9fdWQ8hcQ51bVQTmDrHWQFdwhLgBzmqGYpB1Ek08S6tAIFAeAI4GAXCAGoqSJaGEIKjDgpHx3kgppt0CxncKU0XFBiWtJofqxpEF99XT4jFHD4Mif9rWMCSPWC2c64QiiI72gvj7PLGMjaW0KQx+DcWNXrhpo3ugOHqKNk4DqlwqN6ojGkqIDD4K7AQ0DbZ/BkAQMyEJNPkmQgkKA6j0UAmIJskCOiQIQ6FFrSEJ9BnMdIF+YzN8nXl9YSzCRuuQeyD2QeyD3QO6B3AO5By7bHtjn7NfVUH5Aj5OUN8BPfY+Sg/JiARBoGFyCrIAs1GhoEA8D1BdAygpyUBphnyQIN43yayBDOARrzo784Ow3Wr5oR0BJIlrvm6hxqS0jqkF1aglKG5KoaZmOQ7azKpAX1AcrWDdgNftNH4tHr87siMHtXgXmSI+tXn7pIuwYcuOlQYylFCm4iySoWN1GMRSPbngYmvIkQQojCREd5AJwRcC1HSAfBArkOC4BMLfOCSRBHgKtxIQkk26pQ+qQeyD3QO6B3AO5B3IPXOY9QJ1n9oeKy4MFgSUMmwEoaYKcAYoDgIzAEUEoBEAyoAFjIxwrBXmAxzFQRJAMugzyAXEC7AvqcA2oLyCGiBGNrHxEGhRrjDLbAGMchmk4jYaiJWcoHZylquQWFDjyC2pvGEG912YW9qnq14pqKhmGbYszwm6ohIy6+DLKQZlS4jICqC8Y1EYOGTHyFWuEAY/FAeSThDpK42CI8hUENUYRxQJ2STYHQxNHUvkKJSgAGsVjDQCcAmQ4hWpJcTNA8RQACOyGitbmzrjdiwBZA6QGQGoApAZAagCkBkBqAKQGQGoAnJcGu85rkQf2u7npWY8kyAVA3ASAwgrKzqCkGI1OEWSBHAxNnGPSOYBw06i4BjIMaHBSoABEiQeUuBiGIdT6XITByqs98oh6RFNePdwYWHKMQMPgyFevIUuViK6z+YPTiIlt2YEMwoMxsEfnHPkF9ebn+yzbgm2jcsP64tWVLKMclCmOWVyo1ReOvOgkww5DjQur0bFMyRMkAfUyyFF3TFKGgEZ3KA6A+goWpHxBDgBiaJUjCbKDCigAHgXlsBMA+lLAocDzg+4DqfUSIFMHMjUgUwMyNSBTAzI1IFMDMjUgb4AG0G2cG+p5kbKClpUDQI9jJ1AmlNFTCHKEApMYG2GOpIwAgHDTKA6BEhP6ajELB3HRzduBmnM1tisGiBhDI4dM4WpcWI+Cekl6JFiMx3VEEqqpDg5vp595+G2d84zrvlxeUDeJD94ldUI1bZk1O8l3weAODrTLURo7l6IMGXWSICmvdvuCGQPQqI7aqJgkZIAY5NvKFJqKCGh0R5A1BvWlDA2CpJ0CyEfXao4kyA1QOTsAfSRf85CQLKlF7oPcA7kHcg/kHsg9kHsg98DWPQDp02Ea+ThFkMtQwgWYNqLxJOUaouBGDYJ4JQC5HignQEAuEEMNZEiKIYYWLsUhAOUDKI1UTiiRR6Ll5QEoYzOItoVzvqbtLmLID85i2Rp5YPna/CtEnO8F9aUVZnlHLLP9g6wV1UwzHdm56F4B4+ulKxhcjpWEWgyypZPTGI5FqYP6QsQE1KFGOaRGRlAHBeKUQhgNRPmSQQFlK0Qw0ChFniOgBwgEMG19jXySIBNkakCmBmRqQKYGZGpApgZkakCmBmRqQO6vgQ6VmADzRhGC1mx1JOU2AASEMkK5EQBEU0NAOfXgMDoROySjCtGoUbHrCH85Nqhh7OQ0hmrdoVYyZWycaPXCTacWTkn0tewD1MZql3ItJTuUyZ/2zZlp3dWOjvqCeu2p9Z4w1hLbiDqhmr6S/ebkNNMivwBKqozB2zU0P4xJOy4W59AgCZJ2K+Q7thEjU8bKKVAn4kucOhQAMRCwbUZJkmIK+hzET4BSU0ZVsoEg1yGyFSxbENgLyJYKpAKpQCqQCqQCqUAqcCUU2PP8p7MltoCk0kuAeAGAsgF7UP0UAAg1ylSohiREFAxO4SKlgQMPFJeAnDICcoUhghtJkLRbId+xjIliNKrDMBlghC6NMAbGGMPE7YJIahiowRG5R3e5sUfpsZTkBfXwTC/vjGV2mLTTYWz1WsZqw3SBXHWxHg257uFSKxgwAwVAGdAaSbmGTHT55gR5tVqe4gjkRpkCGuLVIReIgUCz1XWeJEgBI6KOgKgKBarBEqCcwI3YvcR0Wa0kgkxLpgZkakCmBmRqQKYGZGpApgZkakBeJg10DuQeAHSSNCi7DmcCeuzYCAAEAhrYQ3NIMQREFwxOJWVUApLwVy0qhgDEa0C4UHNsBKM4OkEyvHFQrO7YhqBcQV1O7Q4YmTJUug/YOIjtAhzeNs/enDn8Vi73jLygnjx/p90YdV41kyUVUFtZZqFz5OSq13j0xqnsXWD2AnRIEmvNnGh1GIhRXuUxNCojiFeHApRGmR7T0LUkVT4Ha6FM643aaJXQWjhPQGsm9AykDsh9AKQGQGoApAZAagCkBkBqANwoDc7zbDesBWy9++gbVboAraUOJUfAjRp6lNC1JFXOQmiMHmEMCqk8AjGoHrNGqoZrJKIeqKYWVINoJYgxhiA1TALFpbOuVKJuZPMHpxF72tPO23P5S1aWF9RrT5g2iHpPOzR6bt2vFdXM82wbmsoYMqV3gVy9vgrd6h2JLyHD0JzhYiNYEwDJgDyMjRAZUBqKKuQFYQsECTfKFZQjmwXktgEAgR5OBoBGR6iBJMgFQNz1xtLtLnHJgdTzkUgdcg/kHsg9kHsg90DugfPeA9AZ43pj630GdPMdKF+YkoDjWEee0iRBVoBAAAgToQbnRcjTqFQ4GsQrwtgIsqDnRCIAgEAgxjFAaSYALaEBXSt8EHYNBQQ1LvSBHpyFIsTstYogYkC2UYG8oB61mHqn2it1UjXTBaGN2SU615kCRIsXSvFiHIaY44Faa2BRAqJvXoM0Z0wygHkDgLPG4JkPAJFEa66iKEF50haQCYBAIIYW7LBt8o6yQ5Y8ltp8nEBqAKQGQGoApAZAagCkBkBqABynBjpI+kx5yIPXFJd72giCFEBgAEobKDmqQc0rCg9u5o2RMSsQpCF30gmoo7biehTUK11NIbRMjW3MGfaFidsFSg19oAdnSO10TjFl55pXpCAvqBefyLpjqmkls7DRM1urqpkl9brpEp1b6kbCL5gSeTRKhRZAQAMDQyiHBeJRW6yjgVSu4yNtrqKaqCiVZcSQUKyOhrKAxkJQiYDqSXkTAAo3YmOinwQCCeByagDk/QZSAyA1AFIDIDUAUgMgNQBSA2CXBv1ZcIO/gcbIU/4MUCxMbx+YUlRcoQQDogC0tQfHBPqmanGk7ZQf5wAEKqpXDYZWiBg9TPghQCyC0tgHhSoji8GmPMY2lDZqIAanZdJKgbyglgjLfXnDLLPLK2zar+wTnM/tCLl6HdYCBfN5poJjjLUQEcREom+mSIJkT1ffnOBcAFA0Q8dEjeKwwKQQ86a6ScE0pnI7odshVZUAmTqQ11ODXJtMDcjUgEwNyNSATA3I1IC8SRpAt7sDUH47MG1UOIECPT4YkC8wAI0jSkARQgkwbyRBGmsZKCFgaAzPo6AOIzgPDgxAy2lA1wo/EF1IcKAnzgZ6UlODzaWbM3Xq0Zq8oN711C/snQVqtkpX0bl9EfsNzz5j34RhH/ALqYswaUOCKF9dlvI9WRl5k04SZAFArDdxymMCQOwCKI6AxsBkjvghBlrJXhbZUoFUYKcCWZAKpAKpQCqQChyDAjpS7nV+HOrkDGfQzq+LULYA8qYoBEV2CBKzRpAjZkmFhAoEDE0MqC8EgGYwNIbnUUuHX4ZgittGU9Xn+kIlw2LKOAkK1Y2L2UWym5Qu8oJ66yY4yw7q5nZuf3PsNz77TPM7Uu74olIwnztQVMaALEqjjCcbIyuydNMkQRYAxHITrxosAoUGoKoNoPjNWJu5eDtUWQKpTe6DS7oHcu/m+1fugdwDuQdyD5xqD0C6daD87dBRAVDVAgiUhJylz9NIYqERZI+FEhBQTQGiiUFBGWuAsGit5hR6+npOib67vMacFldWhsLQJ8HA7uecZe5+t3CZq/KCep9nb2EPLVALK3VVndsXUi8AIzhqNGTGbsIojF9gRo1kxpwCaLmC6jhroDUHXsCImpYYrVMkQY4AiO3NeUFzsDe0oqagYpg2pVs6beqSeyD3wI3eA3l7uedyD+QeyD1w0faAzo0+M64/MTXh5C4Mk/XgNnaCnGNTMaHiCgxNLAzEKE89XPRtJHVzMMbsmBu4jiLK15DrHW4M+sTgT8obu0i2ZNqmQF5QNyU22rqTqunLFqg+XX1XGQqrkbfWqRfEQHLwOmdK+sU2MvaMWXlQHqjVDcgWwI0aYiE5ttOskmN3miTIZYyVh3hU8QJ0G7ohJKRNapH7IPdA7oG990C+Z+TnRu6B3ANHsAegx7gIHNxIgtyETctRCUHzNBkFiCYWI0ZvIKOqDS2PknaIvq0RiEKUxj4o1DiyuXaMFi/bxYqBHJzlycnmr3zvtwfqRqqmn7NA9enOr5XVdInBpV4YRhDUaMiM3USDWLnDa1khNH8ESlPNSI8BRVIVDXIhqkJsW3ggsbWRBHk2AAQmQLZUIBVIBVKBq6pAPq5UIBVIBQ5SYHpOJAnybNh981SJoNvRjaEAgCio2YwYPUR9VyC39LEmPA0uhew8X+I6Om8opIoNucudjR6cRizaxaqBHJzFuUkWBfIn1EWHPca6oarpJyxQfbrza6WN0WV6l3qhDDHlGTLTbtKorFy/IGVGItYZmUg4bBjylGdAdgTcqCGgIW6gs+vVKj59ny9PEmSCTA3I1IBMDcjUgEwNyJujAZm3S6YGZGpA3iwNoHPhCJxLo1ap0OOa3EDEzI+JwgAAB75JREFUNV1NrUSxZUSNmgmLvvV1iLSXDgettZoWVzujOZ1Ui6qhrCGDbXUY21A+UhinLmaRbV2BvKBe12QLUzdWNX3hAtWnO7+r7NyuIFxqNxsReKAGQ2baZ6RCv0hltEKrnEaNjYJJqgXFlhHrZahtUqAgbrizk5ni1+K6TppUIBVIBVKBVCAVOE8Fcq1U4AgVWDprdtz8nBqxZGolcltvVG+xdI6dFmDaWhLjzJHC2EyOUXimjAig+QxgU2OfmAR9YuIvVg3k4EzmZLCsQF5QL+uyha0brJq+cIHq053vSkNUNfIWO+PlwzFn1xgZeSYaFLrXMN4r5KuL9TiHaPc5HbEGL6D7gArKjmjsBktA5VugAq+fkEapBXIf5D7IPZB7IPfAke6B/AzMz8Dz2AMAtMwS4q0FWEp1HOUXTCpjMieUCkuM1pQfyOLHqMHTh1QrHwgVDJwch4Zcd6rOsL8RbBk7Ros328WqgRyczQtkZqJAXlBP5Ng3qButmn7WAtWnZ36ttjFm2T6kXlAIoDTKGDLTbrKhy4jyCzrQ0Yg1lQyL5dbScxtz5uQ0nkbYY8b51iBbKpAKpAKpQCqQCqQC56lArnWwAjf/PLjHPdhUsvHR9hNKUTAafN6OQ2+h66hEkLaVasaU0WLVURjCJYciDRnsqsXYhikjhXH6YhbZtiuQF9Tb9dmSrRuumr5wgerTM7+r7txZUYROM3Y8I47BrhHBfHDCmPGi/EIPKKVQo7u9OcxvwLx0MV4kteCN4Sm9EqlAKpAKpAKpQCqQChyrAhfhcUPnsZuG/sBLYONdwba2NBHjUkr7ZoLAvCm5nEDQTqM1ijJavMGy5ydBn1jzFysHcnDW5iWxXYG8oN6uz45s3XjV9MWmjJ7b7LvSUIWNIXdTd5rzlxtV3SB32luit7WiUn4TmEBpp6Db2Q1sb14ogb2kTJ1Sp9wDuQdyD+QeyD2Qe+B498D5P/fY1XaLPVTI6c/Lw9luuAkVDGTzh2RxGm1bGM1gRSU2GSphyEAzCrCzeYqxVjiQg7NWksRuBfKCerdGOyrqBqxmXryBnpfVuKvu3JpcNNSLyZgkqciQ2dxdYGyocEoY3jRUplC3Jmett8wmuzYhiVQgFUgFUoFUIBVIBVKBVOAGKLDpfNr46V1obFgNPgvHAVj+tNJRg5NGixes00aXohY2Omqzyz41CfrEmr+xckgMztrcJPZTIC+o99NpR1XdiNXMizfQ87Iau9pQaNOgcFtnfUHaQj7cqKGHwvXeF8z9rrpL+Y1lb2gJ6v5sA5RPEEgdgNQASA2A1ABIDYDUAEgNgNQASA2ALRpQue3QbO4PLadiICz6pkWCXLJ9XfXnZUFTK4wIattAJRvkQrMLsFfz1ElhC4bE4LRM2lMokBfUpxBteUrdkNXMa0wbc35z7GqjVtg1arjNuIx6wRmTOipqkLu7t+Le7p41qeinbvD3vjjX/KwFUoPUIPdA7oHcA7kHcg/kHsg9UPYAdD7cCRzalhbdY41+WldO3cGCjtzmUklDpnQHRol2ja40FuuGxOAsll0E8rLch7ygPtdnqm7Mas5n6dlis3DXbbC+gNfqKKaHwv16P2nJ32+VrEoFUoFUIBVIBVKBVCAVSAVujgJLZ9ie2/Ne9VPsz6Zx0zl8VjcJOYkUrBHiTtmHpQbnlAvltF6BekHdU+mfTYG6QW2M2WKmjBm9I/SMBpU211bhPp31Bd0sFKNvVLAE0Yf1pUWSQ+idOqQOuQdyD+QeyD2QeyD3QO6Bm78HcFjb9JRNVqFOe1NM0tsCKtkgF1ppBPZukyX6WZOEgz6Z/lkVuJwX1Gd91Nd9vjeqoRuyMeT23ZTRc/v5ntWgGc21Vbhvdzn1Yp0D4tA3KtgHKsueCqQCqUAqkAqkAqlAKpAKXBoF9jnjumbygKjT8hImRbsDqqRBLrTqCBzUJsv0MyeJSdBXpX9GBfKC+owCbp9eNm7U2A1nOpg2puy+kWc2aE5zmxV1aC9TqZf0ZiyuSbEJSLhE7oPcA7kHcg/kHsg9kHsg98Bl2ANYb9RhbjvW5+zFUFU9FEK3NQIHt7bc4kQnI2HHiCCH66BAXlBfB1HXl6ybuJr1POLlhDM1L250izg0OmoPd2cJdW+XAPHIlgqkAqlAKpAKpAKpQCqQClxoBZZOsoU797tNrWjIjN2EMTKHeltnD8nBOXT5rD9AgbygPkCss5V6Qwvqcd1pO1vQVMMsdUDYVuhs5w63be6AVfcp9ZLUDdxY5K2lAqlAKpAKpAKpQCqQCqQChyiwz8n2wBqqfgk6G2MNOFXrl19bYJJswVpVEtdBgbygvg6ibl/SG3x7hbP7VblyH2xYzbSxzxJZcz4K5CqpQCqQCqQCqUAqkAqkAldHAZ+ljcVHtDGxWL2N3H+l/Su33V7m9lcgL6j31+ocK+tGtzE2rOyUsSF9IO2VenTTe7r5XTrd41UgH3kqkAqkAqlAKpAKpAKpQFWgnZN7W1PF9An7hT3L6FWMjWs4aUTB4ESUw41RIC+ob4zOC7fiDW8oZWPIXepONSzlT8e1Fee2rjand8V1WppU4CYqkDedCqQCqUAqkAqkAqnA/grsOt/O88PK80SLh4IzOW01240LOWlEgR0jghxusAL/BQAA//8yWlsKAAAABklEQVQDANVD30nclDG4AAAAAElFTkSuQmCC","backgroundColor":"default","textColor":"default","textAlignment":"left","caption":""},"content":[],"children":[]},{"id":"73106e87-05d6-4b69-8784-be7225afe34d","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"eb78fae6-a1f6-46b8-bf40-775b8c81a8d4","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"5775e97c-84f9-435b-ab3b-bd7d71919db7","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"🎨 Designed to Delight","styles":{}}],"children":[]},{"id":"bf20b3b9-3dd7-4dc1-bcd6-115094268582","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Tabula isn't just smart — it's stunning. Choose between ","styles":{}},{"type":"text","text":"Light and Dark themes","styles":{"bold":true}},{"type":"text","text":", enjoy smooth animations, and experience a minimalist interface that lets your content shine.","styles":{}}],"children":[]},{"id":"671ceade-b71b-4ed0-b479-55e5a13b6ad0","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"[Image Placeholder: Light and dark theme comparison]","styles":{"bold":true}}],"children":[]},{"id":"05634667-9790-4ee5-b3f7-aed14e569f0c","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"🚀 Quick Start — No Setup Needed","styles":{}}],"children":[]},{"id":"1ba6b0ff-21f2-48a6-b665-db8fbfbe58e7","type":"numberedListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Open","styles":{"bold":true}},{"type":"text","text":" Tabula Notes in your browser","styles":{}}],"children":[]},{"id":"09d86b35-743a-49c0-a80b-adbee0708f8b","type":"numberedListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Start writing","styles":{"bold":true}},{"type":"text","text":" — no account required","styles":{}}],"children":[]},{"id":"f2ee2fed-cdb9-49a6-a3bf-d5eba505beeb","type":"numberedListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Connect Google Drive","styles":{"bold":true}},{"type":"text","text":" for automatic sync","styles":{}}],"children":[]},{"id":"5caa90f7-9784-4aec-b46e-bce522aa6c9c","type":"numberedListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Enjoy","styles":{"bold":true}},{"type":"text","text":" your new note-taking flow","styles":{}}],"children":[]},{"id":"4598f183-8cbf-4ea9-a601-8d841ca33c43","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"[Image Placeholder: Welcome screen with \\"Get Started\\" button]","styles":{"bold":true}}],"children":[]},{"id":"f4a3c87d-8141-464e-814b-dbda90038310","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"🛠️ Power Features for Productivity","styles":{}}],"children":[]},{"id":"1a20d39c-8a28-4b3e-aafa-44af10ad7282","type":"table","props":{"textColor":"default"},"content":{"type":"tableContent","columnWidths":[null,null],"headerRows":1,"rows":[{"cells":[{"type":"tableCell","content":[{"type":"text","text":"Feature","styles":{}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}},{"type":"tableCell","content":[{"type":"text","text":"What It Does","styles":{}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}}]},{"cells":[{"type":"tableCell","content":[{"type":"text","text":"Auto-Save","styles":{"bold":true}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}},{"type":"tableCell","content":[{"type":"text","text":"Saves every keystroke automatically","styles":{}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}}]},{"cells":[{"type":"tableCell","content":[{"type":"text","text":"Export","styles":{"bold":true}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}},{"type":"tableCell","content":[{"type":"text","text":"Download notes as ","styles":{}},{"type":"text","text":".txt","styles":{"code":true}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}}]},{"cells":[{"type":"tableCell","content":[{"type":"text","text":"Offline Mode","styles":{"bold":true}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}},{"type":"tableCell","content":[{"type":"text","text":"Works perfectly without internet","styles":{}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}}]},{"cells":[{"type":"tableCell","content":[{"type":"text","text":"Note Management","styles":{"bold":true}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}},{"type":"tableCell","content":[{"type":"text","text":"Create, rename, or delete notes easily","styles":{}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}}]},{"cells":[{"type":"tableCell","content":[{"type":"text","text":"Sync Progress","styles":{"bold":true}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}},{"type":"tableCell","content":[{"type":"text","text":"Visual indicators show your sync status","styles":{}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}}]}]},"children":[]},{"id":"115696e6-7483-4e0f-8057-3afa35c2ee66","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]}]`;

// Helper function to generate the next available "Untitled Note" name
const getNextUntitledNoteName = (existingNotes: Note[]): string => {
  const untitledPattern = /^Untitled Note(?: (\d+))?$/;
  const untitledNotes = existingNotes
    .map((note) => {
      const match = note.name.match(untitledPattern);
      if (match) {
        // If there's a number, use it; if it's just "Untitled Note", treat it as 1
        return match[1] ? parseInt(match[1], 10) : 1;
      }
      return null;
    })
    .filter((num): num is number => num !== null);

  // Find the next available number
  let nextNumber = 1;
  if (untitledNotes.length > 0) {
    // Remove duplicates and sort
    const uniqueNumbers = [...new Set(untitledNotes)].sort((a, b) => a - b);
    // Find the first gap or next number
    for (let i = 0; i < uniqueNumbers.length; i++) {
      if (uniqueNumbers[i] !== i + 1) {
        nextNumber = i + 1;
        break;
      }
      nextNumber = i + 2;
    }
  }

  return `Untitled Note ${nextNumber}`;
};

// This function runs on the client and tries to get the initial state
// synchronously from localStorage. This avoids a flicker or loading state.
const getInitialState = () => {
  if (typeof window === "undefined") {
    return {
      activeNoteId: null,
      notes: [],
      theme: "dark",
      characterCount: 0,
    };
  }
  try {
    const theme = localStorage.getItem("tabula-theme") || "dark";

    // For now, return empty state - we'll load from IndexedDB in useEffect
    // This prevents hydration mismatches
    return {
      activeNoteId: null,
      notes: [],
      theme,
      characterCount: 0,
    };
  } catch (e) {
    console.error("Error loading initial state:", e);
    return {
      activeNoteId: null,
      notes: [],
      theme: "dark",
      characterCount: 0,
    };
  }
};

const GOOGLE_CLIENT_ID =
  "284239172338-8h05pivsirhrc2joc1d21vqgurvpeg63.apps.googleusercontent.com";

export default function Home() {
  const [isClient, setIsClient] = React.useState(false);

  // Use a ref to store initial state to avoid re-running getInitialState
  const initialStateRef = React.useRef(getInitialState());

  const [notes, setNotes] = React.useState<Note[]>(
    initialStateRef.current.notes
  );
  const [activeNoteId, setActiveNoteId] = React.useState<string | null>(
    initialStateRef.current.activeNoteId
  );
  const [theme, setTheme] = React.useState(initialStateRef.current.theme);
  const [characterCount, setCharacterCount] = React.useState(
    initialStateRef.current.characterCount
  );

  const [isImageDialogOpen, setIsImageDialogOpen] = React.useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = React.useState<string | null>(
    null
  );

  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState("");

  const renameInputRef = React.useRef<HTMLInputElement>(null);
  const editorRef = React.useRef<BlockNoteEditorRef>(null);
  const { toast } = useToast();

  const [isGapiLoaded, setIsGapiLoaded] = React.useState(false);
  const [isDriveReady, setIsDriveReady] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [isGoogleSDKInitialized, setIsGoogleSDKInitialized] =
    React.useState(false);

  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const prevActiveNoteIdRef = React.useRef<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isFullSyncing, setIsFullSyncing] = React.useState(false); // For UI lock during full sync
  const [lastSyncTime, setLastSyncTime] = React.useState<number | null>(null);
  const [lastFullSyncTime, setLastFullSyncTime] = React.useState<number | null>(
    null
  ); // Track last full sync separately
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [isOnline, setIsOnline] = React.useState(true);
  const [pendingSyncs, setPendingSyncs] = React.useState<number>(0);
  const [retryCount, setRetryCount] = React.useState(0);
  const [syncProgress, setSyncProgress] = React.useState<SyncProgressItem[]>(
    []
  );

  // IndexedDB initialization state
  const [isIndexedDBReady, setIsIndexedDBReady] = React.useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = React.useState(true);
  const maxRetries = 3;

  // Separate handler for sign-in to maintain user gesture chain
  const handleSignIn = React.useCallback(async () => {
    console.log("🔐 [Sign In] User initiated sign in");

    if (!isGapiLoaded) {
      console.log("❌ [Sign In] Google API not loaded yet");
      toast({
        title: "Google API not loaded yet.",
        description: "Please wait a moment and try again.",
        variant: "destructive",
      });
      return;
    }

    if (isLoggedIn) {
      console.log("ℹ️ [Sign In] Already logged in");
      toast({
        title: "Already signed in",
        description: "You're already connected to Google Drive.",
      });
      return;
    }

    try {
      console.log(
        "🚀 [Sign In] Reinitializing GIS client and calling requestToken"
      );

      // Reinitialize the GIS client to ensure tokenClient is properly set up
      await GoogleDrive.initGis(GOOGLE_CLIENT_ID, (tokenResponse) => {
        console.log("✅ [Auth] OAuth callback received, token acquired");
        GoogleDrive.setToken(tokenResponse);
        GoogleDrive.saveTokenToStorage(tokenResponse);
        setIsLoggedIn(true);
        setIsDriveReady(true);
        toast({
          title: "Signed in to Google Drive",
          description: "Click 'Sync' button to fetch your notes from Drive.",
          duration: 5000,
        });
      });

      // Call requestToken synchronously from user interaction to avoid popup blocker
      GoogleDrive.requestToken();
    } catch (error) {
      console.error("❌ [Sign In] Failed to open sign-in popup:", error);
      toast({
        title: "Sign-in failed",
        description:
          "Could not open sign-in window. Please check your popup blocker.",
        variant: "destructive",
      });
    }
  }, [isGapiLoaded, isLoggedIn, toast]);

  const handleCloudSync = React.useCallback(
    async (showToast = true, isAutoSync = false, uploadOnly = false) => {
      console.log("🔄 [Sync] Starting cloud sync...", {
        showToast,
        isAutoSync,
        uploadOnly,
        isGapiLoaded,
        isLoggedIn,
        isOnline,
        isSyncing,
        timestamp: new Date().toISOString(),
      });

      // Debug: Check authentication status
      const token = window.gapi?.client?.getToken?.() || window._gapiToken;
      console.log("🔍 [Sync] Authentication debug:", {
        hasGapi: !!window.gapi,
        hasClient: !!window.gapi?.client,
        hasToken: !!token,
        tokenType: typeof token,
        isGapiLoaded,
        isLoggedIn,
      });

      if (!isGapiLoaded) {
        console.log("❌ [Sync] Google API not loaded yet");
        if (showToast) {
          toast({
            title: "Google API not loaded yet.",
            variant: "destructive",
          });
        }
        return;
      }

      if (!isLoggedIn) {
        console.log("❌ [Sync] Not logged in");
        if (showToast) {
          toast({
            title: "Please sign in first",
            description: "Sign in to Google Drive to sync your notes.",
            variant: "destructive",
          });
        }
        return;
      }

      // Check if offline
      if (!isOnline) {
        console.log("❌ [Sync] Offline, queuing sync");
        if (showToast) {
          toast({
            title: "Offline",
            description: "Changes will sync when connection is restored.",
            variant: "destructive",
          });
        }
        setPendingSyncs((prev) => prev + 1);
        return;
      }

      // Prevent multiple simultaneous syncs
      if (isSyncing) {
        console.log("⏸️ [Sync] Already syncing, skipping");
        return;
      }

      console.log("🔒 [Sync] Acquiring sync lock");
      setIsSyncing(true);
      setSyncError(null);

      // CRITICAL: Save current editor content before any sync operation
      console.log("💾 [Sync] Saving current editor content before sync...");
      const notesWithCurrentContent = saveCurrentEditorContent();

      // Set full sync state for UI lock (only for full sync, not upload-only)
      if (!uploadOnly) {
        setIsFullSyncing(true);
        console.log("🔒 [Sync] UI locked for full sync operation");

        // Initialize progress tracking for full sync
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
          // Upload-only sync: Just upload current content, no fetch/merge
          console.log(
            "📤 [Sync] Upload-only mode: uploading current content..."
          );
          await GoogleDrive.uploadNotesToDrive(notesWithCurrentContent);
          console.log("✅ [Sync] Upload-only sync completed successfully!");

          if (showToast && !isAutoSync) {
            toast({
              title: "Upload successful!",
              description: "Your changes have been saved to Google Drive.",
            });
          }
        } else {
          // Full sync: Use simple sync for now
          console.log("🔄 [Sync] Starting simple sync...");

          try {
            // Create progress callback for sync
            const onProgress = (
              noteId: string,
              noteName: string,
              status: "syncing" | "complete" | "error"
            ) => {
              setSyncProgress((prev) => {
                const existingIndex = prev.findIndex(
                  (item) => item.noteId === noteId
                );
                if (existingIndex >= 0) {
                  // Update existing note
                  return prev.map((item, index) =>
                    index === existingIndex
                      ? { ...item, noteName, status: status as SyncStatus }
                      : item
                  );
                } else {
                  // Add new note (from Google Drive)
                  return [
                    ...prev,
                    { noteId, noteName, status: status as SyncStatus },
                  ];
                }
              });
            };

            const syncResult = await GoogleDrive.simpleSync(onProgress);

            console.log("✅ [Sync] Full sync completed:", {
              notesCount: syncResult.notes.length,
              currentNotesCount: notes.length,
            });

            // Safety check: Don't overwrite with fewer notes unless we're sure
            if (syncResult.notes.length > 0 || notes.length === 0) {
              // Update local state with synced notes
              setNotes(syncResult.notes);

              // Set active note (try to restore from localStorage first)
              const lastActiveNoteId = localStorage.getItem(
                "tabula-last-active-note"
              );
              const activeNote =
                syncResult.notes.find((n) => n.id === lastActiveNoteId) ||
                syncResult.notes[0];
              if (activeNote) {
                setActiveNoteId(activeNote.id);
                localStorage.setItem("tabula-last-active-note", activeNote.id);
              }
            } else {
              console.warn(
                "⚠️ [Sync] Sync returned empty notes but current notes exist. Keeping current notes.",
                {
                  syncResultCount: syncResult.notes.length,
                  currentNotesCount: notes.length,
                }
              );
            }

            // Update last full sync time
            const fullSyncTime = Date.now();
            setLastFullSyncTime(fullSyncTime);
            localStorage.setItem(
              "tabula-last-full-sync",
              fullSyncTime.toString()
            );

            // Mark today as synced for daily sync tracking
            const today = new Date().toDateString();
            localStorage.setItem("tabula-last-daily-sync", today);
            setNeedsDailySync(false);

            // Auto-close modal after 2 seconds and show success toast
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
          } catch (error) {
            const errorInfo = handleErrorWithToast(error, "full sync", toast);
            throw error; // Re-throw to be caught by outer try-catch
          }
        }

        // Update sync status
        setLastSyncTime(Date.now());
        setSyncError(null);
        setPendingSyncs(0); // Clear pending syncs on successful sync
        setRetryCount(0); // Reset retry count on successful sync

        console.log("✅ [Sync] Sync completed successfully!", {
          uploadOnly,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error("❌ [Sync] Sync error occurred:", e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        setSyncError(errorMessage);

        // Retry logic for transient errors
        if (retryCount < maxRetries && isAutoSync) {
          const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.log(
            `🔄 [Sync] Retrying sync in ${retryDelay}ms (attempt ${
              retryCount + 1
            }/${maxRetries})`
          );

          setTimeout(() => {
            setRetryCount((prev) => prev + 1);
            handleCloudSync(false, true, uploadOnly); // Retry silently with same uploadOnly setting
          }, retryDelay);
        } else {
          // Max retries reached or manual sync
          setRetryCount(0);
          console.log("❌ [Sync] Sync failed permanently:", {
            errorMessage,
            retryCount,
            maxRetries,
            isAutoSync,
            uploadOnly,
          });
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
        setIsFullSyncing(false); // Always release UI lock
        setSyncProgress([]); // Clear progress on completion or error
        console.log("🔓 [Sync] Sync lock released");
      }
    },
    [
      isGapiLoaded,
      isLoggedIn,
      isSyncing,
      isOnline,
      retryCount,
      maxRetries,
      toast,
      notes,
    ]
  );

  // Track if initial sync has been performed
  const initialSyncDoneRef = React.useRef(false);

  // Set client state and theme immediately
  React.useEffect(() => {
    setIsClient(true);
    const state = initialStateRef.current;
    document.documentElement.classList.toggle("dark", state.theme === "dark");

    // Load last full sync time from localStorage
    const storedLastFullSync = localStorage.getItem("tabula-last-full-sync");
    if (storedLastFullSync) {
      setLastFullSyncTime(parseInt(storedLastFullSync, 10));
    }
  }, []);

  // Initialize Google Drive API - deferred until IndexedDB is ready
  // This allows the UI to show faster by not blocking on Google Drive initialization
  React.useEffect(() => {
    if (!isIndexedDBReady) return; // Wait for IndexedDB to be ready

    const initDrive = async () => {
      // Expose debug functions to window for console access
      (window as any).debugGoogleDrive = {
        testAPI: GoogleDrive.debugTestDriveAPI,
        basicAPI: GoogleDrive.debugBasicAPI,
        listFiles: GoogleDrive.debugListDriveFiles,
        clearCache: GoogleDrive.clearDriveCache,
        createTestNote: GoogleDrive.createTestNote,
        createSimpleTestNote: GoogleDrive.createSimpleTestNote,
        createTestNoteWithContent: GoogleDrive.createTestNoteWithContent,
        uploadFlow: GoogleDrive.debugUploadFlow,
        simpleSync: GoogleDrive.simpleSync,
      };

      // Initialize Google Drive API
      try {
        await GoogleDrive.loadGapi();

        // Check for existing token before setting isGapiLoaded
        const storedToken = await GoogleDrive.getTokenFromStorage();

        // Set isGapiLoaded first, then update other states
        setIsGapiLoaded(true);

        if (storedToken) {
          // Stored token is valid
          GoogleDrive.setToken(storedToken);
          setIsLoggedIn(true);
          setIsDriveReady(true);
        } else {
          // Stored token expired or doesn't exist
          // Check if Chrome identity API still has a valid token
          console.log(
            "🔍 [Init] Stored token expired/missing, checking Chrome identity API..."
          );
          const chromeToken = await GoogleDrive.checkChromeIdentityToken();

          if (chromeToken) {
            // Chrome still has a valid token - restore session
            console.log(
              "✅ [Init] Restored session from Chrome identity cache"
            );
            GoogleDrive.setToken(chromeToken);
            await GoogleDrive.saveTokenToStorage(chromeToken); // Update stored token
            setIsLoggedIn(true);
            setIsDriveReady(true);
          }
          // If no token found, user is truly signed out
        }

        await GoogleDrive.initGis(GOOGLE_CLIENT_ID, (tokenResponse) => {
          console.log("✅ [Auth] OAuth callback received, token acquired");
          GoogleDrive.setToken(tokenResponse);
          GoogleDrive.saveTokenToStorage(tokenResponse);
          setIsLoggedIn(true);
          setIsDriveReady(true);
          toast({
            title: "Signed in to Google Drive",
            description: "Click 'Sync' button to fetch your notes from Drive.",
            duration: 5000,
          });

          // Removed: Automatic sync after sign-in
          // User will manually click sync button when ready
        });

        // Mark Google SDK as fully initialized
        setIsGoogleSDKInitialized(true);
      } catch (error) {
        console.error("Failed to initialize Google Drive", error);
        toast({
          title: "Could not connect to Google Drive",
          variant: "destructive",
        });
        // Still mark as initialized even if there's an error
        setIsGoogleSDKInitialized(true);
      }
    };

    initDrive();
  }, [toast, isIndexedDBReady]); // Wait for IndexedDB to be ready

  // Periodic token refresh to maintain sign-in persistence
  React.useEffect(() => {
    if (!isLoggedIn || !isGoogleSDKInitialized) return;

    const TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000; // Check every 30 minutes
    const TOKEN_EXPIRY_BUFFER = 10 * 60 * 1000; // Refresh if expiring in next 10 minutes

    const refreshTokenIfNeeded = async () => {
      try {
        const storedToken = await GoogleDrive.getTokenFromStorage();

        if (storedToken) {
          // Check if token is about to expire
          // getTokenFromStorage returns StoredTokenData which has expires_at
          const tokenData = storedToken as unknown as StoredTokenData;
          if (!tokenData.expires_at) {
            // If no expires_at, assume token is still valid and skip refresh
            return;
          }
          const timeUntilExpiry = tokenData.expires_at - Date.now();

          if (timeUntilExpiry <= TOKEN_EXPIRY_BUFFER) {
            console.log(
              "🔄 [Token Refresh] Token expiring soon, refreshing from Chrome identity API..."
            );
            const chromeToken = await GoogleDrive.checkChromeIdentityToken();

            if (chromeToken) {
              await GoogleDrive.saveTokenToStorage(chromeToken);
              GoogleDrive.setToken(chromeToken);
              console.log("✅ [Token Refresh] Token refreshed successfully");
            } else {
              console.log(
                "⚠️ [Token Refresh] Could not refresh token, user may need to sign in again"
              );
            }
          }
        } else {
          // No stored token, check if Chrome has one
          const chromeToken = await GoogleDrive.checkChromeIdentityToken();
          if (chromeToken) {
            await GoogleDrive.saveTokenToStorage(chromeToken);
            GoogleDrive.setToken(chromeToken);
            setIsLoggedIn(true);
            console.log(
              "✅ [Token Refresh] Restored token from Chrome identity API"
            );
          }
        }
      } catch (error) {
        console.error("❌ [Token Refresh] Error refreshing token:", error);
      }
    };

    // Initial check
    refreshTokenIfNeeded();

    // Set up periodic refresh
    const intervalId = setInterval(
      refreshTokenIfNeeded,
      TOKEN_REFRESH_INTERVAL
    );

    return () => {
      clearInterval(intervalId);
    };
  }, [isLoggedIn, isGoogleSDKInitialized]);

  // Initialize IndexedDB and load notes
  React.useEffect(() => {
    if (!isClient) return;

    const initIndexedDB = async () => {
      try {
        console.log("🗄️ [IndexedDB] Initializing database...");
        await IndexedDB.initDB();
        setIsIndexedDBReady(true);
        console.log("✅ [IndexedDB] Database initialized");

        // Load notes from IndexedDB
        const loadedNotes = await IndexedDB.getAllNotes();
        console.log("📚 [IndexedDB] Loaded notes:", loadedNotes.length);

        if (loadedNotes.length === 0) {
          // Create welcome note if no notes exist
          const welcomeNote: IndexedDBNote = {
            id: `note-${Date.now()}`,
            name: "Introduction",
            content: DEFAULT_NOTE_CONTENT,
            createdAt: Date.now(),
            lastUpdatedAt: Date.now(),
          };

          await IndexedDB.saveNote(welcomeNote);
          setNotes([welcomeNote]);
          setActiveNoteId(welcomeNote.id);
          console.log("✅ [IndexedDB] Created welcome note");
        } else {
          // Load existing notes
          setNotes(loadedNotes);

          // Set active note (try to restore from localStorage first)
          const lastActiveNoteId = localStorage.getItem(
            "tabula-last-active-note"
          );
          const activeNote =
            loadedNotes.find((n) => n.id === lastActiveNoteId) ||
            loadedNotes[0];
          setActiveNoteId(activeNote.id);

          console.log(
            "✅ [IndexedDB] Restored notes and active note:",
            activeNote.id
          );
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
    };

    initIndexedDB();
  }, [isClient, toast]);

  // Removed: Initial sync on page load
  // Users will manually sync when they want to fetch updates from Drive
  // This prevents overwriting content if user starts typing immediately after page load

  // Memoize character count calculation
  const characterCountMemo = React.useMemo(() => {
    if (!isClient || !activeNoteId) return 0;

    const activeNote = notes.find((n) => n.id === activeNoteId);
    if (!activeNote) return 0;

    try {
      const blocks = JSON.parse(activeNote.content);
      const textContent = extractTextFromBlocks(blocks);
      return textContent.length;
    } catch (error) {
      // Fallback to HTML parsing for legacy content
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = activeNote.content;
      return tempDiv.innerText.length;
    }
  }, [activeNoteId, isClient, notes]);

  // Load note content when activeNoteId changes
  React.useEffect(() => {
    if (!isClient || !activeNoteId) return;

    setCharacterCount(characterCountMemo);

    // Update the previous active note ID
    prevActiveNoteIdRef.current = activeNoteId;
    localStorage.setItem("tabula-last-active-note", activeNoteId);
  }, [activeNoteId, isClient, characterCountMemo]);

  const toggleTheme = React.useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("tabula-theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    toast({
      title: `Switched to ${
        newTheme.charAt(0).toUpperCase() + newTheme.slice(1)
      } Mode`,
    });
  }, [theme, toast]);

  // Convert HTML content to BlockNote format (memoized)
  const convertHtmlToBlockNote = React.useCallback(
    (htmlContent: string): string => {
      if (!htmlContent || htmlContent.trim() === "") {
        return JSON.stringify([
          {
            id: "1",
            type: "paragraph",
            props: {},
            content: [],
            children: [],
          },
        ]);
      }

      try {
        // Try to parse as existing BlockNote content first
        JSON.parse(htmlContent);
        return htmlContent;
      } catch {
        // If not valid JSON, convert HTML to BlockNote format
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = htmlContent;
        const textContent = tempDiv.innerText || tempDiv.textContent || "";

        return JSON.stringify([
          {
            id: "1",
            type: "paragraph",
            props: {},
            content: textContent
              ? [{ type: "text", text: textContent, styles: {} }]
              : [],
            children: [],
          },
        ]);
      }
    },
    []
  ); // Stable function reference

  const handleContentChange = React.useCallback(
    (content: string) => {
      console.log("🔄 [Content Change] Received content change:", {
        contentLength: content.length,
        contentPreview: content.substring(0, 100) + "...",
        activeNoteId,
        timestamp: new Date().toISOString(),
      });

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // For BlockNote, content is JSON string of blocks
      // We need to calculate character count from the blocks
      try {
        const blocks = JSON.parse(content);
        const textContent = extractTextFromBlocks(blocks);
        setCharacterCount(textContent.length);
        console.log(
          "📊 [Content Change] Character count updated:",
          textContent.length
        );
      } catch (error) {
        // Fallback to 0 if parsing fails
        setCharacterCount(0);
        console.error("❌ [Content Change] Failed to parse content:", error);
        console.error(
          "❌ [Content Change] Content that failed to parse:",
          content.substring(0, 200) + "..."
        );
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (!activeNoteId || !isIndexedDBReady) {
          console.log(
            "⚠️ [Content Change] No active note ID or IndexedDB not ready, skipping save"
          );
          return;
        }
        try {
          // Find the current note
          const currentNote = notes.find((n) => n.id === activeNoteId);
          if (!currentNote) {
            console.log(
              "⚠️ [Content Change] Current note not found, skipping save"
            );
            return;
          }

          // Update the note with new content
          const updatedNote: IndexedDBNote = {
            ...currentNote,
            content: content,
            lastUpdatedAt: Date.now(),
          };

          console.log("💾 [Content Change] Updating note in IndexedDB:", {
            activeNoteId,
            contentLength: content.length,
            contentPreview: content.substring(0, 200) + "...",
          });

          // Save to IndexedDB
          await IndexedDB.saveNote(updatedNote);

          // Don't update local state during auto-save to prevent editor re-render
          // The notes state will be updated when switching notes or during manual operations
          // This prevents cursor position from being affected by the debounced save

          // Save active note ID to localStorage for persistence
          localStorage.setItem("tabula-last-active-note", activeNoteId);

          console.log(
            "✅ [Content Change] Note saved to IndexedDB successfully"
          );

          // Note: Auto-sync on content change has been removed
          // Users should manually sync or wait for daily sync reminder
        } catch (error) {
          console.error(
            "❌ [Content Change] Failed to save note to IndexedDB:",
            error
          );
          toast({
            variant: "destructive",
            title: "Save Failed",
            description: "Could not save your note to local storage.",
          });
        }
      }, 500); // Debounce time in ms (0.5 seconds)
    },
    [activeNoteId, isIndexedDBReady, notes, toast]
  );

  // BlockNote handles formatting internally, so we don't need these functions

  const handleExport = React.useCallback(() => {
    const activeNote = notes.find((n) => n.id === activeNoteId);
    if (!activeNote) return;

    try {
      let textContent = "";

      // Try to parse as BlockNote content first
      try {
        const blocks = JSON.parse(activeNote.content);
        textContent = extractTextFromBlocks(blocks).replace(/\s+/g, "\n");
      } catch {
        // Fallback to HTML parsing for legacy content
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = activeNote.content;
        textContent = tempDiv.innerText;
      }

      const blob = new Blob([textContent], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const activeNoteName = activeNote.name || "note";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `${activeNoteName.replace(/\s/g, "_")}-${timestamp}.txt`;
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

  const handleCreateNewNote = React.useCallback(async () => {
    if (!isIndexedDBReady) {
      console.log(
        "⚠️ [Create Note] IndexedDB not ready, skipping note creation"
      );
      return;
    }

    try {
      const newNote: IndexedDBNote = {
        id: `note-${Date.now()}`,
        name: getNextUntitledNoteName(notes),
        content: DEFAULT_NOTE_CONTENT,
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      console.log("📝 [Create Note] Creating new note:", newNote.id);

      // Save to IndexedDB
      await IndexedDB.saveNote(newNote);

      // Update local state
      const updatedNotes = [newNote, ...notes];
      setNotes(updatedNotes);
      setActiveNoteId(newNote.id);

      // Save active note ID to localStorage for persistence
      localStorage.setItem("tabula-last-active-note", newNote.id);

      console.log("✅ [Create Note] New note created successfully");

      // Note: Auto-sync on note creation has been removed
      // Users should manually sync or wait for daily sync reminder

      toast({
        title: "New Note Created",
        description: "Ready for your thoughts!",
      });
    } catch (error) {
      console.error("❌ [Create Note] Failed to create note:", error);
      toast({
        variant: "destructive",
        title: "Create Failed",
        description: "Could not create a new note.",
      });
    }
  }, [isIndexedDBReady, toast, notes]);

  const handleDeleteNote = React.useCallback(
    async (noteIdToDelete: string) => {
      if (!isIndexedDBReady) {
        console.log("⚠️ [Delete] IndexedDB not ready, skipping note deletion");
        return;
      }

      console.log("🗑️ [Delete] Starting note deletion:", noteIdToDelete);

      // Check if this is the last note
      const isLastNote = notes.length === 1;

      try {
        // Delete from IndexedDB
        await IndexedDB.deleteNote(noteIdToDelete);

        // Update local state
        const updatedNotes = notes.filter((n) => n.id !== noteIdToDelete);
        setNotes(updatedNotes);

        // Handle active note switching
        if (activeNoteId === noteIdToDelete) {
          if (updatedNotes.length > 0) {
            const sortedNotes = [...updatedNotes].sort(
              (a, b) => b.lastUpdatedAt - a.lastUpdatedAt
            );
            setActiveNoteId(sortedNotes[0].id);
            localStorage.setItem("tabula-last-active-note", sortedNotes[0].id);
          } else {
            // Always create a new note when deleting the last note
            // This ensures there's always at least one note available
            console.log("🔄 [Delete] Last note deleted, creating new note...");

            // Create new note directly instead of using handleCreateNewNote
            const newNote: IndexedDBNote = {
              id: `note-${Date.now()}`,
              name: getNextUntitledNoteName(updatedNotes),
              content: DEFAULT_NOTE_CONTENT,
              createdAt: Date.now(),
              lastUpdatedAt: Date.now(),
            };

            // Save to IndexedDB
            await IndexedDB.saveNote(newNote);

            // Update local state with the new note (replacing the empty array)
            setNotes([newNote]);
            setActiveNoteId(newNote.id);
            localStorage.setItem("tabula-last-active-note", newNote.id);

            console.log(
              "✅ [Delete] New note created successfully:",
              newNote.id
            );

            // If user is logged in, upload the new note to Google Drive immediately
            if (isLoggedIn) {
              try {
                console.log(
                  "📤 [Delete] Uploading new note to Google Drive..."
                );
                await GoogleDrive.uploadNotesToDrive([newNote]);
                console.log(
                  "✅ [Delete] New note uploaded to Google Drive successfully"
                );
              } catch (error) {
                console.error(
                  "❌ [Delete] Failed to upload new note to Google Drive:",
                  error
                );
                // Don't show error toast here as the note was created successfully locally
              }
            }
          }
        }

        // Clean up orphaned images asynchronously
        ImageStorage.cleanupOrphanedImages().then((cleanedCount) => {
          if (cleanedCount > 0) {
            console.log(
              `🧹 [Delete] Cleaned up ${cleanedCount} orphaned images`
            );
          }
        });

        // Delete from Google Drive immediately without triggering sync
        if (isLoggedIn) {
          try {
            console.log(
              "🗑️ [Delete] Deleting note from Google Drive:",
              noteIdToDelete
            );
            await GoogleDrive.deleteNoteFromDrive(noteIdToDelete);
            console.log(
              "✅ [Delete] Note deleted from Google Drive successfully"
            );

            if (isLastNote) {
              toast({
                title: "Note Deleted & New Note Created",
                description:
                  "Last note removed from Google Drive. A new note has been created and synced.",
              });
            } else {
              toast({
                title: "Note Deleted",
                description:
                  "Note removed from local storage and Google Drive.",
              });
            }
          } catch (error) {
            console.error(
              "❌ [Delete] Failed to delete from Google Drive:",
              error
            );
            toast({
              title: "Note Deleted Locally",
              description:
                "Note removed locally, but failed to delete from Google Drive.",
              variant: "destructive",
            });
          }
        } else {
          if (isLastNote) {
            toast({
              title: "Note Deleted & New Note Created",
              description:
                "Last note removed locally. A new note has been created.",
            });
          } else {
            toast({
              title: "Note Deleted",
              description: "Note removed from local storage.",
            });
          }
        }

        console.log("✅ [Delete] Note deleted successfully from IndexedDB");
      } catch (error) {
        console.error(
          "❌ [Delete] Failed to delete note from IndexedDB:",
          error
        );
        toast({
          variant: "destructive",
          title: "Delete Failed",
          description: "Could not delete the note from local storage.",
        });
      }
    },
    [isIndexedDBReady, notes, activeNoteId, isLoggedIn, toast]
  );

  const handleRenameNote = React.useCallback(
    async (noteId: string, newName: string) => {
      if (!isIndexedDBReady) {
        console.log("⚠️ [Rename] IndexedDB not ready, skipping note rename");
        return;
      }

      const now = Date.now();

      console.log("📝 [Rename] Note rename requested:", {
        noteId,
        oldName: notes.find((n) => n.id === noteId)?.name,
        newName,
        lastUpdatedAt: now,
        timestamp: new Date(now).toISOString(),
      });

      try {
        // Find the current note
        const currentNote = notes.find((n) => n.id === noteId);
        if (!currentNote) {
          console.log("⚠️ [Rename] Note not found, skipping rename");
          return;
        }

        // Update the note with new name
        const updatedNote: IndexedDBNote = {
          ...currentNote,
          name: newName,
          lastUpdatedAt: now,
        };

        console.log("📝 [Rename] Updating note in IndexedDB:", {
          noteId,
          newName,
          lastUpdatedAt: now,
        });

        // Save to IndexedDB
        await IndexedDB.saveNote(updatedNote);

        // Update local state
        const updatedNotes = notes.map((n) =>
          n.id === noteId ? updatedNote : n
        );
        setNotes(updatedNotes);

        console.log("✅ [Rename] Note renamed successfully in IndexedDB");

        // Immediately sync only the renamed note to Google Drive (optimized)
        if (isLoggedIn && !isSyncing) {
          console.log(
            "🔄 [Rename] Immediately syncing renamed note to Google Drive..."
          );
          try {
            await GoogleDrive.uploadSingleNoteToDrive(updatedNote);
            console.log(
              "✅ [Rename] Note renamed and synced to Google Drive successfully"
            );
            toast({
              title: "Note Renamed & Synced",
              description:
                "Your note has been renamed and synced to Google Drive.",
            });
          } catch (error) {
            console.error(
              "❌ [Rename] Failed to sync renamed note to Google Drive:",
              error
            );
            toast({
              title: "Note Renamed Locally",
              description:
                "Rename successful, but sync to Google Drive failed.",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Note Renamed Successfully",
            description: "Note renamed in local storage.",
          });
        }
      } catch (error) {
        console.error("❌ [Rename] Failed to rename note in IndexedDB:", error);
        toast({
          variant: "destructive",
          title: "Rename Failed",
          description: "Could not rename the note in local storage.",
        });
      }
    },
    [isIndexedDBReady, notes, isLoggedIn, isSyncing, toast]
  );

  const handleStartRename = React.useCallback(() => {
    const note = notes.find((n) => n.id === activeNoteId);
    if (note) {
      setIsRenaming(true);
      setRenameValue(note.name);
      setTimeout(() => renameInputRef.current?.select(), 0);
    }
  }, [notes, activeNoteId]);

  const handleRenameSubmit = React.useCallback(() => {
    if (activeNoteId && renameValue.trim()) {
      handleRenameNote(activeNoteId, renameValue.trim());
    }
    setIsRenaming(false);
  }, [activeNoteId, renameValue, handleRenameNote]);

  // BlockNote handles all keyboard and click interactions internally

  const handleSignOut = () => {
    GoogleDrive.signOut();
    setIsLoggedIn(false);
    setIsDriveReady(false);
    setLastSyncTime(null); // Clear sync status
    setSyncError(null); // Clear any sync errors
    setPendingSyncs(0); // Clear pending syncs
    initialSyncDoneRef.current = false; // Reset initial sync flag
    toast({ title: "Signed out from Google Drive." });
  };

  // Function to test Google Drive sync with test data
  const handleTestSync = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Please sign in first",
        description: "You need to be signed in to test Google Drive sync.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({ title: "Testing Google Drive sync with test data..." });

      // Create a test note
      const testNote = GoogleDrive.createTestNote();

      // Save the test note to Google Drive
      await GoogleDrive.saveNotesToDrive([testNote]);

      toast({
        title: "Test sync successful!",
        description: "Test data has been saved to Google Drive.",
      });
    } catch (error) {
      console.error("Test sync failed:", error);
      toast({
        title: "Test sync failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Function to test Google Drive sync with simple test data
  const handleSimpleTestSync = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Please sign in first",
        description: "You need to be signed in to test Google Drive sync.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("🧪 [Simple Test] Starting simple test sync...");
      toast({ title: "Testing with simple data..." });

      // Create a simple test note
      const simpleTestNote = GoogleDrive.createSimpleTestNote();

      console.log("🧪 [Simple Test] Simple test note created:", simpleTestNote);

      // Save the simple test note to Google Drive
      await GoogleDrive.saveNotesToDrive([simpleTestNote]);

      console.log("🧪 [Simple Test] Simple test sync completed successfully");

      toast({
        title: "Simple test successful!",
        description: "Simple test data has been saved to Google Drive.",
      });
    } catch (error) {
      console.error("🧪 [Simple Test] Simple test sync failed:", error);
      toast({
        title: "Simple test failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Function to save current editor content immediately
  const saveCurrentEditorContent = (): Note[] => {
    console.log("🔍 [Save Content] Starting save current editor content:", {
      activeNoteId,
      hasEditorRef: !!editorRef.current,
      timestamp: new Date().toISOString(),
    });

    if (!activeNoteId || !editorRef.current) {
      console.log("⚠️ [Save Content] No active note or editor ref");
      return notes; // Return current notes if no active note
    }

    try {
      const editor = editorRef.current.getEditor();
      if (!editor) {
        console.log("⚠️ [Save Content] No editor instance");
        return notes; // Return current notes if no editor
      }

      // Get current content from editor
      const currentContent = JSON.stringify(editor.document);
      console.log("💾 [Save Content] Saving current editor content:", {
        activeNoteId,
        contentLength: currentContent.length,
        contentPreview: currentContent.substring(0, 100) + "...",
        editorDocument: editor.document,
        documentLength: editor.document.length,
      });

      // Update notes array immediately
      const updatedNotes = notes.map((n) =>
        n.id === activeNoteId
          ? { ...n, content: currentContent, lastUpdatedAt: Date.now() }
          : n
      );

      setNotes(updatedNotes);
      localStorage.setItem("tabula-notes", JSON.stringify(updatedNotes));

      console.log(
        "✅ [Save Content] Current editor content saved successfully:",
        {
          updatedNotesCount: updatedNotes.length,
          updatedNote: updatedNotes.find((n) => n.id === activeNoteId),
        }
      );
      return updatedNotes;
    } catch (error) {
      console.error(
        "❌ [Save Content] Failed to save current editor content:",
        error
      );
      return notes; // Return current notes on error
    }
  };

  // Function to force sync current notes to Google Drive
  const handleForceSync = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Please sign in first",
        description: "You need to be signed in to sync to Google Drive.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("🔄 [Force Sync] Starting force sync with current notes:", {
        notesCount: notes.length,
        notes: notes.map((n) => ({
          id: n.id,
          name: n.name,
          contentLength: n.content.length,
        })),
      });

      toast({ title: "Force syncing current notes to Google Drive..." });

      // CRITICAL: Save current editor content before uploading
      console.log(
        "💾 [Force Sync] Saving current editor content before upload..."
      );
      const notesWithCurrentContent = saveCurrentEditorContent();

      console.log("🔄 [Force Sync] Uploading notes with current content:", {
        notesCount: notesWithCurrentContent.length,
        notes: notesWithCurrentContent.map((n) => ({
          id: n.id,
          name: n.name,
          contentLength: n.content.length,
          hasContent: n.content && n.content.length > 0,
        })),
      });

      // Save notes with current content to Google Drive
      await GoogleDrive.uploadNotesToDrive(notesWithCurrentContent);

      toast({
        title: "Force sync successful!",
        description: `Synced ${notesWithCurrentContent.length} notes to Google Drive.`,
      });
    } catch (error) {
      console.error("Force sync failed:", error);
      toast({
        title: "Force sync failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Function to test storage system
  const handleStorageTest = async () => {
    try {
      console.log("🧪 [Storage Test] Starting storage system test...");
      toast({ title: "Testing storage system..." });

      await StorageTest.runAllTests();

      toast({
        title: "Storage test completed!",
        description: "Check the console for detailed results.",
      });
    } catch (error) {
      console.error("Storage test failed:", error);
      toast({
        title: "Storage test failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Function to debug Google Drive files
  const handleDebugDriveFiles = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Please sign in first",
        description: "You need to be signed in to debug Google Drive files.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("🔍 [Debug] Starting Google Drive file debug...");
      await GoogleDrive.debugListDriveFiles();

      toast({
        title: "Drive debug completed!",
        description: "Check the console for file listing results.",
      });
    } catch (error) {
      console.error("❌ [Debug] Drive debug failed:", error);
      toast({
        title: "Drive debug failed",
        description: "Check the console for error details.",
        variant: "destructive",
      });
    }
  };

  // Function to clear Google Drive cache
  const handleClearDriveCache = () => {
    try {
      console.log("🗑️ [Debug] Clearing Google Drive cache...");
      GoogleDrive.clearDriveCache();

      toast({
        title: "Drive cache cleared!",
        description: "Next sync will be fresh.",
      });
    } catch (error) {
      console.error("❌ [Debug] Cache clear failed:", error);
      toast({
        title: "Cache clear failed",
        description: "Check the console for error details.",
        variant: "destructive",
      });
    }
  };

  // Function to test Google Drive API
  const handleTestDriveAPI = async () => {
    try {
      console.log("🧪 [Test API] Testing Google Drive API...");
      toast({ title: "Testing Google Drive API..." });

      await GoogleDrive.debugTestDriveAPI();

      toast({
        title: "API test completed!",
        description: "Check the console for detailed results.",
      });
    } catch (error) {
      console.error("API test failed:", error);
      toast({
        title: "API test failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Function to debug current notes state
  const handleDebugNotesState = () => {
    console.log("🔍 [Debug Notes] Current notes state:", {
      notesCount: notes.length,
      activeNoteId: activeNoteId,
      notes: notes.map((note, index) => ({
        index,
        id: note.id,
        name: note.name,
        contentLength: note.content.length,
        hasContent: note.content && note.content.length > 0,
        contentPreview: note.content
          ? note.content.substring(0, 100) + "..."
          : "NO CONTENT",
        createdAt: note.createdAt,
        lastUpdatedAt: note.lastUpdatedAt,
      })),
    });

    toast({
      title: "Notes state logged!",
      description: `Found ${notes.length} notes. Check console for details.`,
    });
  };

  // const handleBodyClick = () => {
  //   if (editorRef.current) {
  //     try {
  //       editorRef.current.focus();
  //     } catch (error) {
  //       console.error("Failed to focus editor:", error);
  //     }
  //   }
  // };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // BlockNote handles most shortcuts internally
      // We can add custom shortcuts here if needed
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleExport]);

  // Cleanup timeouts on unmount and when dependencies change
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [activeNoteId]); // Cleanup when active note changes

  // Offline detection and auto-sync when connection is restored
  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (pendingSyncs > 0 && isLoggedIn && !isSyncing) {
        toast({
          title: "Connection restored",
          description: "You can now sync your changes manually.",
        });
        // Note: Auto-sync on connection restore has been removed
        // Users should manually sync when ready
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Set initial online status
    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [pendingSyncs, isLoggedIn, isSyncing, handleCloudSync, toast]);

  // Removed: Automatic sync on page visibility change
  // Users will manually sync when they want to fetch updates from Drive
  // This prevents overwriting content if user starts typing immediately after returning to tab

  // 24-hour sync reminder system (optimized with longer interval)
  React.useEffect(() => {
    if (!isLoggedIn || !lastFullSyncTime) return;

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes (optimized from 1 minute)

    const checkSyncReminder = () => {
      const timeSinceLastSync = Date.now() - lastFullSyncTime;

      if (timeSinceLastSync > TWENTY_FOUR_HOURS) {
        // Show reminder notification
        const lastReminderShown = localStorage.getItem(
          "tabula-last-reminder-shown"
        );
        const lastReminderTime = lastReminderShown
          ? parseInt(lastReminderShown, 10)
          : 0;
        const timeSinceLastReminder = Date.now() - lastReminderTime;

        // Only show reminder once every 6 hours to avoid spam
        if (timeSinceLastReminder > 6 * 60 * 60 * 1000) {
          if (process.env.NODE_ENV === "development") {
            console.log("⏰ [Sync Reminder] Showing 24-hour sync reminder");
          }
          toast({
            title: "Sync Recommended",
            description:
              "It's been over 24 hours since your last sync. Click the sync button to get updates from Drive.",
            duration: 10000,
          });
          localStorage.setItem(
            "tabula-last-reminder-shown",
            Date.now().toString()
          );
        }
      }
    };

    // Check immediately
    checkSyncReminder();

    // Then check every 5 minutes (reduced frequency for better performance)
    const intervalId = setInterval(checkSyncReminder, CHECK_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [isLoggedIn, lastFullSyncTime, toast]);

  // Daily sync status tracking - checks if sync is needed but doesn't auto-trigger
  // StatusIndicator will show "Sync now" prompt if sync is needed
  const [needsDailySync, setNeedsDailySync] = React.useState(false);

  React.useEffect(() => {
    // Check if sync is needed (after midnight, hasn't synced today)
    const checkSyncNeeded = () => {
      const now = new Date();
      const today = now.toDateString(); // e.g., "Mon Jan 01 2024"
      const lastSyncDate = localStorage.getItem("tabula-last-daily-sync");
      const hasSyncedToday = lastSyncDate === today;
      const syncNeeded = !hasSyncedToday;

      setNeedsDailySync(syncNeeded);

      if (syncNeeded) {
        console.log(
          "📅 [Daily Sync] Sync needed today - showing Sync now prompt",
          {
            currentTime: now.toISOString(),
            today,
            lastSyncDate,
          }
        );
      }
    };

    // Check immediately
    checkSyncNeeded();

    // Check every minute to update status after midnight
    const intervalId = setInterval(checkSyncNeeded, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const activeNote = notes.find((n) => n.id === activeNoteId);
  // Memoize date formatting
  const formatDate = React.useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${
      months[date.getMonth()]
    } ${date.getDate()}, ${date.getFullYear()}`;
  }, []); // Stable function - no dependencies

  const getNextSyncTime = () => {
    const now = new Date();
    const today = now.toDateString();
    const lastSyncDate = localStorage.getItem("tabula-last-daily-sync");

    // If we haven't synced today and it's after midnight, next sync is "Today at 12:00 AM"
    if (lastSyncDate !== today && now.getHours() >= 0) {
      return "Today at 12:00 AM";
    }

    // If we've already synced today, next sync is tomorrow at midnight
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `Tomorrow at 12:00 AM (${
      months[tomorrow.getMonth()]
    } ${tomorrow.getDate()})`;
  };

  if (!isClient || isLoadingNotes) {
    return (
      <main className="relative min-h-screen text-foreground font-body transition-colors duration-300 bg-[rgba(242,242,233,1)] dark:bg-[hsl(0,0%,15%)]">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">
              {!isClient ? "Loading..." : "Initializing storage..."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <main className="relative min-h-screen text-foreground font-body transition-colors duration-300 bg-[rgba(242,242,233,1)] dark:bg-[hsl(0,0%,15%)]">
        {/* Full Sync Loading Overlay */}
        {isFullSyncing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-[rgba(242,242,233,0.9)] dark:bg-[rgba(21,21,21,0.9)]">
            <div className="flex flex-col items-center gap-6 rounded-xl p-8 shadow-2xl max-w-lg w-full mx-4 border-[1.5px] bg-[rgba(242,242,233,0.98)] dark:bg-[rgba(36,36,36,0.98)] border-[rgba(224,224,208,0.5)] dark:border-[rgba(58,58,58,0.7)]">
              <div className="text-center w-full">
                <div className="flex flex-col items-center gap-3 mb-6">
                  <Loader2 className="w-12 h-12 animate-spin text-[rgba(80,80,70,0.8)] dark:text-gray-400" />
                  <h3 className="text-xl font-semibold text-[rgba(60,60,50,0.9)] dark:text-gray-200">
                    Syncing with Google Drive
                  </h3>
                  <p className="text-sm text-[rgba(100,100,90,0.8)] dark:text-gray-300">
                    Please wait while we fetch and merge your notes...
                  </p>
                </div>

                {/* Progress List */}
                {syncProgress.length > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-lg p-4 mb-4 border-[1.5px] bg-[rgba(240,240,224,0.6)] dark:bg-[rgba(40,40,40,0.6)] border-[rgba(208,208,192,0.4)] dark:border-[rgba(58,58,58,0.5)]">
                    <div className="space-y-2">
                      {syncProgress.map((item) => (
                        <div
                          key={item.noteId}
                          className={cn(
                            "flex items-center gap-3 py-2 px-2 rounded-md transition-colors hover:bg-opacity-50",
                            item.status === "complete"
                              ? "bg-[rgba(200,240,200,0.3)] dark:bg-[rgba(34,197,94,0.2)]"
                              : item.status === "error"
                              ? "bg-[rgba(240,200,200,0.3)] dark:bg-[rgba(239,68,68,0.2)]"
                              : "bg-[rgba(255,255,255,0.2)] dark:bg-[rgba(255,255,255,0.1)]"
                          )}
                        >
                          <div className="flex-shrink-0">
                            {item.status === "complete" ? (
                              <CheckCircle className="w-5 h-5 text-[rgba(34,197,94,0.9)] dark:text-green-400" />
                            ) : item.status === "error" ? (
                              <AlertCircle className="w-5 h-5 text-[rgba(239,68,68,0.9)] dark:text-red-400" />
                            ) : (
                              <Loader2 className="w-5 h-5 animate-spin text-[rgba(80,80,70,0.8)] dark:text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-[rgba(60,60,50,0.9)] dark:text-gray-200">
                              {item.noteName}
                            </p>
                            <p className="text-xs capitalize text-[rgba(100,100,90,0.7)] dark:text-gray-400">
                              {item.status === "syncing" && "Syncing..."}
                              {item.status === "complete" && "Complete"}
                              {item.status === "error" && "Error"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 p-4 rounded-lg border-[1.5px] bg-[rgba(248,244,232,0.7)] dark:bg-[rgba(42,42,42,0.7)] border-[rgba(216,208,184,0.5)] dark:border-[rgba(58,58,58,0.6)]">
                  <p className="text-xs font-medium mb-2 text-[rgba(120,100,80,0.95)] dark:text-gray-300">
                    ℹ️ Note: Images will not sync
                  </p>
                  <p className="text-xs mt-1 text-[rgba(100,90,80,0.85)] dark:text-gray-400">
                    Visit{" "}
                    <a
                      href="https://tabulanotes.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline transition-colors hover:opacity-80 text-[rgba(140,120,100,0.9)] dark:text-gray-300"
                    >
                      tabulanotes.com
                    </a>{" "}
                    for feature requests and feedback
                  </p>
                </div>
                <p className="text-xs mt-4 text-[rgba(100,100,90,0.7)] dark:text-gray-400">
                  Do not close this window
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="fixed top-0 left-0 right-0 h-12 flex justify-between items-center z-50 px-4 bg-[rgba(242,242,233,1)] dark:bg-[hsl(0,0%,15%)] transition-colors duration-300">
          <div className="flex-1"></div>
          <div className="flex-1 flex justify-center items-center group">
            {isClient && activeNote && (
              <>
                {isRenaming ? (
                  <Input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
                    className="w-auto h-8 text-lg font-semibold text-center bg-transparent border-primary"
                    style={{
                      minWidth: "100px",
                      maxWidth: "50vw",
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <h1
                      onClick={handleStartRename}
                      className="text-lg font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {activeNote.name}
                    </h1>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleStartRename}
                      className="h-6 w-6 opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex-1 flex justify-end items-center gap-2">
            {/* Status Indicator */}
            <LazyStatusIndicator
              isLoggedIn={isLoggedIn}
              isSyncing={isSyncing}
              isFullSyncing={isFullSyncing}
              syncError={syncError}
              isOnline={isOnline}
              pendingSyncs={pendingSyncs}
              lastSyncTime={lastSyncTime}
              lastFullSyncTime={lastFullSyncTime}
              isGoogleSDKInitialized={isGoogleSDKInitialized}
              needsDailySync={needsDailySync}
              onSyncClick={handleCloudSync}
              onSignInClick={handleSignIn}
              onSignOutClick={handleSignOut}
              tooltipContent={
                <div className="text-sm space-y-1">
                  {!isLoggedIn ? (
                    "Connect to Google Drive to sync your notes"
                  ) : isFullSyncing ? (
                    "Syncing your notes with Google Drive..."
                  ) : isSyncing ? (
                    "Uploading changes to Google Drive..."
                  ) : syncError ? (
                    "There was an error syncing. Click to retry."
                  ) : (
                    <>
                      <div>Your notes are synced with Google Drive</div>
                      {lastFullSyncTime && (
                        <div className="text-xs text-muted-foreground">
                          Last sync: {formatDate(lastFullSyncTime)}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Next auto-sync: {getNextSyncTime()}
                      </div>
                    </>
                  )}
                </div>
              }
            />

            {isClient && activeNote && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="end"
                  className="max-w-sm p-3"
                >
                  <div className="text-xs space-y-3">
                    <div>
                      <div className="font-semibold text-sm mb-2">
                        Note Information
                      </div>
                      <div className="text-muted-foreground flex flex-col gap-1">
                        <span>Characters: {characterCount}</span>
                        <span>Created: {formatDate(activeNote.createdAt)}</span>
                        <span>
                          Updated: {formatDate(activeNote.lastUpdatedAt)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-sm mb-2">
                        Quick Shortcuts
                      </div>
                      <div className="space-y-1 text-muted-foreground">
                        <div>
                          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                            Ctrl/Cmd + B
                          </kbd>{" "}
                          Bold
                        </div>
                        <div>
                          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                            Ctrl/Cmd + I
                          </kbd>{" "}
                          Italic
                        </div>
                        <div>
                          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                            Ctrl/Cmd + Shift + 1/2/3
                          </kbd>{" "}
                          Headings
                        </div>
                        <div>
                          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                            Ctrl/Cmd + Shift + 8/7
                          </kbd>{" "}
                          Lists
                        </div>
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div
          className="w-full h-full min-h-screen pt-4 pb-4"
          // onClick={handleBodyClick}
        >
          {isClient && activeNote && (
            <div className="w-full h-full  p-10 outline-none text-lg leading-relaxed">
              <div className="blocknote-editor-wrapper">
                <div className="blocknote-editor-inner">
                  <BlockNoteEditor
                    ref={editorRef}
                    initialContent={(() => {
                      const content = convertHtmlToBlockNote(
                        activeNote.content
                      );
                      console.log("📝 [Page] Passing content to editor:", {
                        noteId: activeNote.id,
                        contentLength: content.length,
                        hasImages: content.includes('"type":"image"'),
                        contentPreview: content.substring(0, 200) + "...",
                      });
                      return content;
                    })()}
                    onChange={handleContentChange}
                    autoFocus={!isFullSyncing} // Don't auto-focus during full sync
                    theme={theme as "light" | "dark"}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {isClient && (
          <LazyToolbar
            {...{
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
              handleCloudSync: () => handleCloudSync(true, false, false), // Manual sync button always does full sync
              handleSignOut,
            }}
          />
        )}

        {isClient && (
          <LazyImageDialog
            isOpen={isImageDialogOpen}
            onOpenChange={setIsImageDialogOpen}
            src={selectedImageSrc}
            toast={toast}
          />
        )}

        <Toaster />
      </main>
    </TooltipProvider>
  );
}
