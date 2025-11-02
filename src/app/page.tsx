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
import BlockNoteEditor, {
  type BlockNoteEditorRef,
} from "./BlockNoteEditor/blocknote";

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
const DEFAULT_NOTE_CONTENT = `[{"id":"cdbf94f7-d474-4892-bada-427544324b6e","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":1,"isToggleable":false},"content":[{"type":"text","text":"📒 Meet ","styles":{}},{"type":"text","text":"Tabula Notes","styles":{"bold":true}}],"children":[]},{"id":"b55b8dee-dd4f-4712-a9bd-f86f08c0ff5f","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Ever wished your notes could ","styles":{}},{"type":"text","text":"just work","styles":{"italic":true}},{"type":"text","text":" — beautiful, organized, synced, and always at your fingertips? That's exactly what ","styles":{}},{"type":"text","text":"Tabula Notes","styles":{"bold":true}},{"type":"text","text":" is built for.","styles":{}}],"children":[]},{"id":"bcd643e2-60cc-4526-b315-afc43b46bed2","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"1d684380-d56c-4b7c-879d-4abb153e69f9","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"📝 Write Freely with a Modern Rich Text Editor","styles":{}}],"children":[]},{"id":"483a652c-55c7-4ee0-ad5a-cb8259dd009d","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Tabula Notes comes with a ","styles":{}},{"type":"text","text":"block-based editor","styles":{"bold":true}},{"type":"text","text":" that feels fast, fluid, and natural. Format your thoughts with bold, italics, headings, checklists, and more — all just a shortcut away. You can even see your ","styles":{}},{"type":"text","text":"real-time character count","styles":{"bold":true}},{"type":"text","text":", helping you stay focused and concise.","styles":{}}],"children":[]},{"id":"320c2c77-63a1-4e24-8cc9-cac3533a7928","type":"image","props":{"url":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABV4AAAFwCAYAAABAVGDeAAAQAElEQVR4AeydB+AcRfXH3/d+v/SEEHrvAtKk994RBEQBARXsBUVBUVFUxIagf+wFsAAi0jtKDwRB6b33EkoCqaST/OfNltt+u1f37r6/7NuZefPmzcxn526z7/b2Ks/e88oiChlwDXANcA1wDXANcA1wDXANcA1wDXANcA1wDfT0GuC1P+MfXANcA1wDbV4DFeEfCZAACZAACZAACZAACbSdADskARIgARIgARIgARIggd4mwMBrbx9fzo4ESCAvAdqRAAmQAAmQAAmQAAmQAAmQAAmQAAn0PoE2zpCB1zbCZlckQAIkQAIkQAIkQAIkQAIkQAIkECTAPAmQAAmQQO8SYOC1d48tZ0YCJEACJEACJEACRQnQngRIgARIgARIgARIgARIoEkEGHhtEki6IQESaAUB+iQBEiABEiABEiABEiABEiABEiABEuh9Ar05QwZee/O4clYkQAIkQAIkQAIkQAIkQAIkQAL1EmA7EiABEiABEmgCAQZemwCRLkiABEiABEiABEiglQTomwRIgARIgARIgARIgARIoPsIMPDafceMIyaBThNg/yRAAiRAAiRAAiRAAiRAAiRAAiRAAr1PgDNskAADrw0CZHMSIAESIAESIAESIAESIAESIIF2EGAfJEACJEACJNBdBBh47a7jxdGSAAmQAAmQAAmUhQDHQQIkQAIkQAIkQAIkQAIkQAIZBBh4zYDDKhLoJgIcKwmQAAmQAAmQAAmQAAmQAAmQAAmQQO8T4Ay7hwADr91zrDhSEiABEiABEiABEiABEiABEigbAY6HBEiABEiABEgghQADrylgqCYBEiABEiABEuhGAhwzCZAACZAACZAACZAACZAACZSDAAOv5TgOHEWvEuC8SIAESIAESIAESIAESIAESIAESIAEep8AZ0gCCQQYeE2AQhUJkAAJkAAJkAAJkAAJkAAJdDMBjp0ESIAESIAESKDzBBh47fwx4AhIgARIgARIoNcJcH4kQAIkQAIkQAIkQAIkQAIk0HcEGHjtu0POCYuQAQmQAAmQAAmQAAmQAAmQAAmQAAmQQO8T4AxJoLMEGHjtLH/2TgIkQAIkQAIkQAIkQAIk0C8EOE8SIAESIAESIIG+IsDAa18dbk6WBEiABEiABKoEmCMBEiABEiABEiABEiABEiABEmgdAQZeW8eWnosRoDUJkAAJkAAJkAAJkAAJkAAJkAAJkEDvE+AMSaBvCDDw2jeHmhMlARIgARIgARIgARIgARKIE6CGBEiABEiABEiABFpDgIHX1nClVxIgARIgARKojwBbkQAJkAAJkAAJkAAJkAAJkAAJ9AQBBl574jC2bhL0TAIkQAIkQAIkQAIkQAIkQAIkQAIk0PsEOEMSIIHmE2DgtflM6ZEESIAESIAESIAESIAESKAxAmxNAiRAAiRAAiRAAl1PgIHXrj+EnAAJkAAJkEDrCbAHEiABEiABEiABEiABEiABEiABEihGgIHXYrzKYc1RkAAJkAAJkAAJkAAJkAAJkAAJkAAJ9D4BzpAESKCrCTDw2tWHj4MnARIgARIgARIgARIggfYRYE8kQAIkQAIkQAIkQAL5CTDwmp8VLUmABEiABMpFgKMhARIgARIgARIgARIgARIgARIggdISYOC1aYeGjkiABEiABEiABEiABEiABEiABEiABHqfAGdIAiRAAvkIMPCajxOtSIAESIAESIAESIAESKCcBDgqEiABEiABEiABEiCBUhJg4LWUh4WDIgESIIHuJcCRkwAJkAAJkAAJkAAJkAAJkAAJkAAJiPR64JXHmARIgARIgARIgARIgARIgARIgARIoPcJcIYkQAIkUDoCDLyW7pBwQCRAAiRAAiRAAiRAAt1PgDMgARIgARIgARIgARLodwIMvPb7CuD8SYAE+oMAZ0kCJEACJEACJEACJEACJEACJEACJNBWAh0JvLZ1huyMBEiABEiABEiABEiABEiABEiABEigIwTYKQmQAAn0MwEGXvv56HPuJEACJEACJEACJNBfBDhbEiABEiABEiABEiABEmgbAQZe24Y6T0eLjNEiSf23yNRQZBEZkEHPrAG+pvl65hrgGuAa4BrgGuAa4BrgGuAa4BrgGuAaKLgGUiJHYvSOmPASt1IQqAZeSzEcDoIESIAESIAESIAESIAESIAESIAESKClBOicBEiABEigLQQYeG0LZnZCAiRAAiRAAiRAAiSQRoB6EiABEiABEiABEiABEuhFAgy8tvSoLpLQv5pfjxYxJmZnBuU8dSCcN2puJEACLSfADkiABEiABEiABEiABEiABEiABEigvASSYkZGpzElR0w0ymRSH+EQiFY5gafyTrXF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EmCZBEiABEiABEiABEigOwjEY2iL/O+he9E2Lw3PyGidzVGbvJNJ3+cwSW/cgZquCrzW4pMN3611k6ovV+ElNrW7qglzhQnssfsuokElbXjYxz4ts+fM0WxMrv3XDbLU8muKPsv1+edf8Ov1zlYtzJgxSxYuXKjZmJz557NFn60ZqzAKDZaNGbuYyYl87BOflzlz5tp8cDd9+nT5zOeOCaramj/+uGMEAwPyyEOPyhe//LVY3zrvoz75BdHgdayyw4ott9jUv2N3/PhqMCs6LH22pn4V/7VXX5Pd9z5Asp6D+tjjT8je+31YNDCpz9095MMfjLqTJZcY5+ta/YiI6264xfa1z5Pk/wAAEABJREFU6847apoq+71/LznkEGes3zrxB/Lb35+ZaqvH9Ljjvy2XXHS5tTn2y18UfQ6pLbRpd/CHDrQ9vfj8S/L1b37P5qO7+x94SH70k19E1Q2X9QOHP/zudFEZPWZ0w/7WWGM12dq9i/V3fzhT9IOKNKfPPfeCnHHWX2213sW80krOnb9WUaKd95iWR5540r4Wmjm0Iw472LL31kAzfRf1dc9999smO2yztVQqPfVfETsv7kiABEiABEiABEiABOIENNJSROIeekej171B6Y2ZmWCrHmCdjJf64VdVGknTmypv8008RfvTpvbY1Vc74YMRLnmU4lpX44XjvaJt4BZsnrtGCIwYPlyuueJCGb3YGLl1/AT5yOGfkP/+727Ru1TVrwagzr/gYjnq00eL3tk1ZOhQWX311bTKys47bm+Dkm9PnixHH3N8KPj4+ptvymk//7V85avfsDa2QWQ3evRo+emPnKDSww8+YoKvn5PbJvzHfhVcvw6u+Y8e+Tl57oWXZM01V4+0bk9xrz13kz/8xglunXfehbLKmhvI548+Vs768zk2XXOdTeTqq/8tRx/9mfYMqEAv+gzdPc34tYn3A1Saj8pGG64v/3faj61a7wh936bbyXe+e7LoV+31B9hefe11e1y+8KXjZJMtdpLJb06SUSYgd9Vl/xT9Gr9tGNhtvtkm4gXUv3fST0SDrxNff0P0kREBs4azL786UR5/9HEZNOty++22runv16efKuuut65dy1899puyyx4fkEsuu9I+LmPatOmid12ffc75stFm28tvfvMn60+fW3zcsUfbfDt322+3jRx8sBMoPvPMv8r3T/qx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","backgroundColor":"default","textColor":"default","textAlignment":"left","caption":""},"content":[],"children":[]},{"id":"31afb5f0-be79-43a5-a983-b35467f76405","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"e6237273-a243-47f3-b348-ff0c2bdfe5e6","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"0c8fff1e-a1f9-43bb-9a9d-427bffcc4347","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"🖼️ Add Images Instantly","styles":{}}],"children":[]},{"id":"f9be95f9-50ab-4363-b45a-653fac923dd3","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Bring your notes to life! Simply ","styles":{}},{"type":"text","text":"drag and drop images","styles":{"bold":true}},{"type":"text","text":", paste them from your clipboard, or upload in popular formats (JPEG, PNG, GIF, WebP, SVG). Tabula handles ","styles":{}},{"type":"text","text":"smart storage and deduplication","styles":{"bold":true}},{"type":"text","text":", so you never waste space.","styles":{}}],"children":[]},{"id":"0e74dddb-ea5e-40ea-906a-31b1f9779794","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"17918fad-eabf-4464-99c7-a6876009f789","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"☁️ Sync Seamlessly with Google Drive","styles":{}}],"children":[]},{"id":"5e4a9efd-cb8d-48f7-a8fc-9b5d696785ca","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"No more losing work or juggling backups. Tabula automatically ","styles":{}},{"type":"text","text":"syncs with Google Drive","styles":{"bold":true}},{"type":"text","text":", giving you:","styles":{}}],"children":[]},{"id":"28e7bc11-7837-451f-b207-0192bfa1587a","type":"bulletListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Offline-first editing","styles":{"bold":true}}],"children":[]},{"id":"e8007fad-5891-4f7a-8b23-2134934850a5","type":"bulletListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Automatic daily backups","styles":{"bold":true}}],"children":[]},{"id":"5a8cf4d3-d950-447b-80a5-a8b74b0e32a8","type":"bulletListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Smart conflict handling","styles":{"bold":true}}],"children":[]},{"id":"4843c91f-f156-4d12-a57d-813a3c0400f4","type":"bulletListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Manual sync whenever you want","styles":{"bold":true}}],"children":[]},{"id":"6eea9c07-9df2-426e-8cad-c3d9736fe5d8","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Your notes stay secure and up-to-date — wherever you are.","styles":{}}],"children":[]},{"id":"b89bcd87-ec49-44ff-aa9f-6d24ccc21beb","type":"image","props":{"url":"data:image/png;base64,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","backgroundColor":"default","textColor":"default","textAlignment":"left","caption":""},"content":[],"children":[]},{"id":"73106e87-05d6-4b69-8784-be7225afe34d","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"eb78fae6-a1f6-46b8-bf40-775b8c81a8d4","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]},{"id":"5775e97c-84f9-435b-ab3b-bd7d71919db7","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"🎨 Designed to Delight","styles":{}}],"children":[]},{"id":"bf20b3b9-3dd7-4dc1-bcd6-115094268582","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Tabula isn't just smart — it's stunning. Choose between ","styles":{}},{"type":"text","text":"Light and Dark themes","styles":{"bold":true}},{"type":"text","text":", enjoy smooth animations, and experience a minimalist interface that lets your content shine.","styles":{}}],"children":[]},{"id":"671ceade-b71b-4ed0-b479-55e5a13b6ad0","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"[Image Placeholder: Light and dark theme comparison]","styles":{"bold":true}}],"children":[]},{"id":"05634667-9790-4ee5-b3f7-aed14e569f0c","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"🚀 Quick Start — No Setup Needed","styles":{}}],"children":[]},{"id":"1ba6b0ff-21f2-48a6-b665-db8fbfbe58e7","type":"numberedListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Open","styles":{"bold":true}},{"type":"text","text":" Tabula Notes in your browser","styles":{}}],"children":[]},{"id":"09d86b35-743a-49c0-a80b-adbee0708f8b","type":"numberedListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Start writing","styles":{"bold":true}},{"type":"text","text":" — no account required","styles":{}}],"children":[]},{"id":"f2ee2fed-cdb9-49a6-a3bf-d5eba505beeb","type":"numberedListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Connect Google Drive","styles":{"bold":true}},{"type":"text","text":" for automatic sync","styles":{}}],"children":[]},{"id":"5caa90f7-9784-4aec-b46e-bce522aa6c9c","type":"numberedListItem","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Enjoy","styles":{"bold":true}},{"type":"text","text":" your new note-taking flow","styles":{}}],"children":[]},{"id":"4598f183-8cbf-4ea9-a601-8d841ca33c43","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"[Image Placeholder: Welcome screen with \\"Get Started\\" button]","styles":{"bold":true}}],"children":[]},{"id":"f4a3c87d-8141-464e-814b-dbda90038310","type":"heading","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","level":2,"isToggleable":false},"content":[{"type":"text","text":"🛠️ Power Features for Productivity","styles":{}}],"children":[]},{"id":"1a20d39c-8a28-4b3e-aafa-44af10ad7282","type":"table","props":{"textColor":"default"},"content":{"type":"tableContent","columnWidths":[null,null],"headerRows":1,"rows":[{"cells":[{"type":"tableCell","content":[{"type":"text","text":"Feature","styles":{}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}},{"type":"tableCell","content":[{"type":"text","text":"What It Does","styles":{}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}}]},{"cells":[{"type":"tableCell","content":[{"type":"text","text":"Auto-Save","styles":{"bold":true}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}},{"type":"tableCell","content":[{"type":"text","text":"Saves every keystroke automatically","styles":{}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}}]},{"cells":[{"type":"tableCell","content":[{"type":"text","text":"Export","styles":{"bold":true}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}},{"type":"tableCell","content":[{"type":"text","text":"Download notes as ","styles":{}},{"type":"text","text":".txt","styles":{"code":true}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}}]},{"cells":[{"type":"tableCell","content":[{"type":"text","text":"Offline Mode","styles":{"bold":true}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}},{"type":"tableCell","content":[{"type":"text","text":"Works perfectly without internet","styles":{}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}}]},{"cells":[{"type":"tableCell","content":[{"type":"text","text":"Note Management","styles":{"bold":true}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}},{"type":"tableCell","content":[{"type":"text","text":"Create, rename, or delete notes easily","styles":{}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}}]},{"cells":[{"type":"tableCell","content":[{"type":"text","text":"Sync Progress","styles":{"bold":true}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}},{"type":"tableCell","content":[{"type":"text","text":"Visual indicators show your sync status","styles":{}}],"props":{"colspan":1,"rowspan":1,"backgroundColor":"default","textColor":"default","textAlignment":"left"}}]}]},"children":[]},{"id":"115696e6-7483-4e0f-8057-3afa35c2ee66","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[],"children":[]}]`;

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
      theme: "light",
      characterCount: 0,
    };
  }
  try {
    const theme = localStorage.getItem("tabula-theme") || "light";

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
      theme: "light",
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
            });

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

            // Update last full sync time
            const fullSyncTime = Date.now();
            setLastFullSyncTime(fullSyncTime);
            localStorage.setItem(
              "tabula-last-full-sync",
              fullSyncTime.toString()
            );

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

  React.useEffect(() => {
    // This effect runs once on mount to set the initial client state
    setIsClient(true);
    const state = initialStateRef.current;
    document.documentElement.classList.toggle("dark", state.theme === "dark");

    // Load last full sync time from localStorage
    const storedLastFullSync = localStorage.getItem("tabula-last-full-sync");
    if (storedLastFullSync) {
      setLastFullSyncTime(parseInt(storedLastFullSync, 10));
    }

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
    const initDrive = async () => {
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
  }, [toast]);

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

        // Immediately sync rename to Google Drive without debounce
        if (isLoggedIn && !isSyncing) {
          console.log(
            "🔄 [Rename] Immediately syncing renamed note to Google Drive..."
          );
          try {
            await GoogleDrive.uploadNotesToDrive(updatedNotes);
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

  // Daily auto-sync system - syncs once per day after midnight when app loads
  React.useEffect(() => {
    if (!isLoggedIn || !isGapiLoaded) return;

    const performDailyAutoSync = async () => {
      const now = new Date();
      const today = now.toDateString(); // e.g., "Mon Jan 01 2024"
      const lastSyncDate = localStorage.getItem("tabula-last-daily-sync");

      // Check if we haven't synced today (date changes at midnight automatically)
      const hasSyncedToday = lastSyncDate === today;

      if (!hasSyncedToday) {
        console.log("🔄 [Daily Auto-Sync] Starting automatic daily sync...", {
          currentTime: now.toISOString(),
          today,
          lastSyncDate,
          hasSyncedToday,
        });

        try {
          // Trigger full sync using existing sync flow (shows modal, disables UI)
          await handleCloudSync(false, true, false); // showToast=false, isAutoSync=true, uploadOnly=false

          // Mark today as synced
          localStorage.setItem("tabula-last-daily-sync", today);

          console.log("✅ [Daily Auto-Sync] Daily sync completed successfully");
        } catch (error) {
          console.error("❌ [Daily Auto-Sync] Daily sync failed:", error);
          // Error handling is already managed by handleCloudSync
        }
      } else {
        console.log("⏭️ [Daily Auto-Sync] Skipping daily sync", {
          hasSyncedToday,
          today,
          lastSyncDate,
        });
      }
    };

    // Run once when component mounts and dependencies are ready
    performDailyAutoSync();
  }, [isLoggedIn, isGapiLoaded, handleCloudSync]);

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
      <main className="relative min-h-screen bg-background text-foreground font-body transition-colors duration-300">
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
      <main className="relative min-h-screen bg-background text-foreground font-body transition-colors duration-300">
        {/* Full Sync Loading Overlay */}
        {isFullSyncing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 shadow-lg border max-w-lg w-full mx-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="text-center w-full">
                <h3 className="text-lg font-semibold mb-2">
                  Syncing with Google Drive
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Please wait while we fetch and merge your notes...
                </p>

                {/* Progress List */}
                {syncProgress.length > 0 && (
                  <div className="max-h-64 overflow-y-auto border rounded-lg p-4 bg-muted/30">
                    <div className="space-y-2">
                      {syncProgress.map((item) => (
                        <div
                          key={item.noteId}
                          className="flex items-center gap-3 py-2"
                        >
                          <div className="flex-shrink-0">
                            {item.status === "complete" ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : item.status === "error" ? (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            ) : (
                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.noteName}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
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

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    ℹ️ Note: Images will not sync
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Visit{" "}
                    <a
                      href="https://tabulanotes.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                    >
                      tabulanotes.com
                    </a>{" "}
                    for feature requests and feedback
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Do not close this window
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="fixed top-0 left-0 right-0 h-12 flex justify-between items-center z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
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
