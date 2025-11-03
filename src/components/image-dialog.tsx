"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Copy, Image as ImageIcon } from "lucide-react";
import type { useToast } from "@/hooks/use-toast";

type ImageDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  src: string | null;
  toast: ReturnType<typeof useToast>["toast"];
};

const ImageDialog = React.memo(function ImageDialog({
  isOpen,
  onOpenChange,
  src,
  toast,
}: ImageDialogProps) {
  const handleDownload = () => {
    if (!src) return;
    const link = document.createElement("a");
    link.href = src;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileType = src.split(";")[0].split("/")[1] || "png";
    link.download = `image-${timestamp}.${fileType}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Image downloaded" });
  };

  const handleCopy = async () => {
    if (!src) return;
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      toast({ title: "Image copied to clipboard" });
    } catch (error) {
      console.error("Failed to copy image:", error);
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Could not copy image to clipboard.",
      });
    }
  };

  if (!src) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            <span>Image Preview</span>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex justify-center items-center bg-muted/50 rounded-lg p-4">
          <img
            src={src}
            alt="Pasted content"
            className="max-w-full max-h-[70vh] object-contain rounded"
          />
        </div>
        <DialogFooter className="mt-4">
          <Button onClick={handleCopy} variant="outline">
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default ImageDialog;
