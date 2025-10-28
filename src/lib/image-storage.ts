/**
 * Image Storage Utilities for Tabula Notes
 * Handles SHA-256 hashing, BLOB storage, and Object URL management
 * Images are stored locally in IndexedDB only (no cloud sync)
 */

import { IndexedDB, type ImageRecord } from "./indexeddb";

export interface ImageUrlCache {
  [hash: string]: string; // hash -> Object URL
}

class ImageStorageManager {
  private urlCache: ImageUrlCache = {};
  private readonly MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];

  /**
   * Generate SHA-256 hash of a blob
   */
  async generateImageHash(blob: Blob): Promise<string> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hashHex;
    } catch (error) {
      console.error("❌ [ImageStorage] Failed to generate hash:", error);
      throw new Error("Failed to generate image hash");
    }
  }

  /**
   * Validate image file
   */
  private validateImage(file: File): void {
    if (!this.ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(
        `Unsupported image type: ${
          file.type
        }. Allowed types: ${this.ALLOWED_MIME_TYPES.join(", ")}`
      );
    }

    if (file.size > this.MAX_IMAGE_SIZE) {
      throw new Error(
        `Image too large: ${file.size} bytes. Maximum size: ${this.MAX_IMAGE_SIZE} bytes`
      );
    }
  }

  /**
   * Store image blob and return hash reference
   */
  async storeImageBlob(file: File): Promise<string> {
    try {
      console.log("🖼️ [ImageStorage] Storing image:", {
        name: file.name,
        type: file.type,
        size: file.size,
      });

      // Validate image
      this.validateImage(file);

      // Convert File to Blob
      const blob = new Blob([file], { type: file.type });

      // Generate hash
      const hash = await this.generateImageHash(blob);
      console.log("🔑 [ImageStorage] Generated hash:", hash);

      // Check if image already exists (deduplication)
      const existingImage = await IndexedDB.getImage(hash);
      if (existingImage) {
        console.log("♻️ [ImageStorage] Image already exists, reusing:", hash);
        return hash;
      }

      // Create image record
      const imageRecord: ImageRecord = {
        id: hash,
        blob,
        mimeType: file.type,
        size: file.size,
        createdAt: Date.now(),
        syncStatus: "pending",
      };

      // Store in IndexedDB
      await IndexedDB.saveImage(imageRecord);
      console.log("✅ [ImageStorage] Image stored successfully:", hash);

      return hash;
    } catch (error) {
      console.error("❌ [ImageStorage] Failed to store image:", error);
      throw error;
    }
  }

  /**
   * Get Object URL for display (with caching)
   */
  async getImageUrl(hash: string): Promise<string> {
    try {
      // Check cache first
      if (this.urlCache[hash]) {
        return this.urlCache[hash];
      }

      // Get image from IndexedDB
      const imageRecord = await IndexedDB.getImage(hash);
      if (!imageRecord) {
        throw new Error(`Image not found: ${hash}`);
      }

      // Create Object URL
      const url = URL.createObjectURL(imageRecord.blob);

      // Cache the URL
      this.urlCache[hash] = url;

      console.log("🔗 [ImageStorage] Created Object URL for:", hash);
      return url;
    } catch (error) {
      console.error("❌ [ImageStorage] Failed to get image URL:", error);
      throw error;
    }
  }

  /**
   * Get multiple image URLs at once
   */
  async getImageUrls(hashes: string[]): Promise<{ [hash: string]: string }> {
    const urlMap: { [hash: string]: string } = {};

    // Process in parallel
    const promises = hashes.map(async (hash) => {
      try {
        const url = await this.getImageUrl(hash);
        urlMap[hash] = url;
      } catch (error) {
        console.error(
          `❌ [ImageStorage] Failed to get URL for ${hash}:`,
          error
        );
        // Continue with other images
      }
    });

    await Promise.all(promises);
    return urlMap;
  }

  /**
   * Extract image hash references from note content
   */
  extractImageRefs(content: string): string[] {
    try {
      const blocks = JSON.parse(content);
      const imageRefs: string[] = [];

      const extractFromBlocks = (blocks: any[]): void => {
        for (const block of blocks) {
          // Check if block is an image
          if (block.type === "image" && block.props?.url) {
            const url = block.props.url;
            // Check if it's an IndexedDB reference
            if (url.startsWith("indexeddb://")) {
              const hash = url.replace("indexeddb://", "");
              imageRefs.push(hash);
            }
          }

          // Recursively check children
          if (block.children && Array.isArray(block.children)) {
            extractFromBlocks(block.children);
          }
        }
      };

      if (Array.isArray(blocks)) {
        extractFromBlocks(blocks);
      }

      console.log("🔍 [ImageStorage] Extracted image refs:", imageRefs);
      return imageRefs;
    } catch (error) {
      console.error("❌ [ImageStorage] Failed to extract image refs:", error);
      return [];
    }
  }

  /**
   * Replace base64 URLs with hash references in content
   */
  async replaceBase64WithRefs(content: string): Promise<string> {
    try {
      const blocks = JSON.parse(content);

      const replaceInBlocks = async (blocks: any[]): Promise<void> => {
        for (const block of blocks) {
          if (block.type === "image" && block.props?.url) {
            const url = block.props.url;

            // Check if it's a base64 data URL
            if (url.startsWith("data:image/")) {
              try {
                // Convert data URL to blob
                const response = await fetch(url);
                const blob = await response.blob();

                // Store in IndexedDB and get hash
                const hash = await this.storeImageBlob(
                  new File([blob], "image", { type: blob.type })
                );

                // Replace with hash reference
                block.props.url = `indexeddb://${hash}`;
                console.log(
                  "🔄 [ImageStorage] Replaced base64 with hash:",
                  hash
                );
              } catch (error) {
                console.error(
                  "❌ [ImageStorage] Failed to convert base64 to hash:",
                  error
                );
              }
            }
          }

          // Recursively process children
          if (block.children && Array.isArray(block.children)) {
            await replaceInBlocks(block.children);
          }
        }
      };

      if (Array.isArray(blocks)) {
        await replaceInBlocks(blocks);
      }

      return JSON.stringify(blocks);
    } catch (error) {
      console.error(
        "❌ [ImageStorage] Failed to replace base64 with refs:",
        error
      );
      return content;
    }
  }

  /**
   * Replace hash references with Object URLs in content for display
   */
  async replaceRefsWithUrls(content: string): Promise<string> {
    try {
      const blocks = JSON.parse(content);

      const replaceInBlocks = async (blocks: any[]): Promise<void> => {
        for (const block of blocks) {
          if (block.type === "image" && block.props?.url) {
            const url = block.props.url;

            // Check if it's an IndexedDB reference
            if (url.startsWith("indexeddb://")) {
              try {
                const hash = url.replace("indexeddb://", "");
                const objectUrl = await this.getImageUrl(hash);
                block.props.url = objectUrl;
                console.log(
                  "🔄 [ImageStorage] Replaced hash with Object URL:",
                  hash
                );
              } catch (error) {
                console.error(
                  "❌ [ImageStorage] Failed to get Object URL for hash:",
                  error
                );
              }
            }
          }

          // Recursively process children
          if (block.children && Array.isArray(block.children)) {
            await replaceInBlocks(block.children);
          }
        }
      };

      if (Array.isArray(blocks)) {
        await replaceInBlocks(blocks);
      }

      return JSON.stringify(blocks);
    } catch (error) {
      console.error(
        "❌ [ImageStorage] Failed to replace refs with URLs:",
        error
      );
      return content;
    }
  }

  /**
   * Replace Object URLs with hash references in content for saving
   * This is the reverse of replaceRefsWithUrls - converts display URLs back to storage references
   */
  async replaceUrlsWithRefs(content: string): Promise<string> {
    try {
      const blocks = JSON.parse(content);

      const replaceInBlocks = async (blocks: any[]): Promise<void> => {
        for (const block of blocks) {
          if (block.type === "image" && block.props?.url) {
            const url = block.props.url;

            // Check if it's an Object URL (blob:)
            if (url.startsWith("blob:")) {
              try {
                // Find the hash for this Object URL
                const hash = this.findHashForObjectUrl(url);
                if (hash) {
                  block.props.url = `indexeddb://${hash}`;
                  console.log(
                    "🔄 [ImageStorage] Replaced Object URL with hash:",
                    hash
                  );
                } else {
                  // Fallback: try to store the image from the Object URL
                  console.warn(
                    "⚠️ [ImageStorage] Could not find hash for Object URL, attempting to store:",
                    url
                  );
                  try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const newHash = await this.storeImageBlob(
                      new File([blob], "image", { type: blob.type })
                    );
                    block.props.url = `indexeddb://${newHash}`;
                    console.log(
                      "✅ [ImageStorage] Successfully stored Object URL as new hash:",
                      newHash
                    );
                  } catch (storeError) {
                    console.error(
                      "❌ [ImageStorage] Failed to store Object URL:",
                      storeError
                    );
                    // Keep the Object URL as fallback
                  }
                }
              } catch (error) {
                console.error(
                  "❌ [ImageStorage] Failed to convert Object URL to hash:",
                  error
                );
              }
            }
          }

          // Recursively process children
          if (block.children && Array.isArray(block.children)) {
            await replaceInBlocks(block.children);
          }
        }
      };

      if (Array.isArray(blocks)) {
        await replaceInBlocks(blocks);
      }

      return JSON.stringify(blocks);
    } catch (error) {
      console.error(
        "❌ [ImageStorage] Failed to replace URLs with refs:",
        error
      );
      return content;
    }
  }

  /**
   * Find the hash for a given Object URL
   * This is used to convert Object URLs back to hash references
   */
  private findHashForObjectUrl(objectUrl: string): string | null {
    // Check our URL cache first
    for (const [hash, url] of Object.entries(this.urlCache)) {
      if (url === objectUrl) {
        return hash;
      }
    }
    return null;
  }

  /**
   * Revoke Object URLs to free memory
   */
  revokeImageUrls(urls: string[]): void {
    urls.forEach((url) => {
      if (url && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
        console.log("🗑️ [ImageStorage] Revoked Object URL:", url);
      }
    });
  }

  /**
   * Revoke all cached Object URLs
   */
  revokeAllImageUrls(): void {
    const urls = Object.values(this.urlCache);
    this.revokeImageUrls(urls);
    this.urlCache = {};
    console.log("🗑️ [ImageStorage] Revoked all cached Object URLs");
  }

  /**
   * Find orphaned images (not referenced by any note)
   */
  async findOrphanedImages(): Promise<string[]> {
    try {
      // Get all image IDs
      const allImageIds = await IndexedDB.getAllImageIds();

      // Get all notes
      const notes = await IndexedDB.getAllNotes();

      // Collect all referenced image hashes
      const referencedHashes = new Set<string>();
      notes.forEach((note) => {
        const imageRefs = this.extractImageRefs(note.content);
        imageRefs.forEach((hash) => referencedHashes.add(hash));
      });

      // Find orphaned images
      const orphanedImages = allImageIds.filter(
        (id) => !referencedHashes.has(id)
      );

      console.log(
        "🔍 [ImageStorage] Found orphaned images:",
        orphanedImages.length
      );
      return orphanedImages;
    } catch (error) {
      console.error("❌ [ImageStorage] Failed to find orphaned images:", error);
      return [];
    }
  }

  /**
   * Clean up orphaned images
   */
  async cleanupOrphanedImages(): Promise<number> {
    try {
      const orphanedImages = await this.findOrphanedImages();

      // Delete orphaned images
      const deletePromises = orphanedImages.map((hash) =>
        IndexedDB.deleteImage(hash)
      );
      await Promise.all(deletePromises);

      // Revoke their Object URLs if cached
      const urlsToRevoke = orphanedImages
        .map((hash) => this.urlCache[hash])
        .filter((url) => url);
      this.revokeImageUrls(urlsToRevoke);

      // Remove from cache
      orphanedImages.forEach((hash) => delete this.urlCache[hash]);

      console.log(
        "✅ [ImageStorage] Cleaned up orphaned images:",
        orphanedImages.length
      );
      return orphanedImages.length;
    } catch (error) {
      console.error(
        "❌ [ImageStorage] Failed to cleanup orphaned images:",
        error
      );
      return 0;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalImages: number;
    totalSize: number;
    pendingSync: number;
    cachedUrls: number;
  }> {
    try {
      const allImageIds = await IndexedDB.getAllImageIds();
      const images = await IndexedDB.getImagesByIds(allImageIds);
      const pendingImages = await IndexedDB.getPendingImages();

      return {
        totalImages: images.length,
        totalSize: images.reduce((sum, img) => sum + img.size, 0),
        pendingSync: pendingImages.length,
        cachedUrls: Object.keys(this.urlCache).length,
      };
    } catch (error) {
      console.error("❌ [ImageStorage] Failed to get storage stats:", error);
      return {
        totalImages: 0,
        totalSize: 0,
        pendingSync: 0,
        cachedUrls: 0,
      };
    }
  }

  /**
   * Clean up resources (call on app unmount)
   */
  cleanup(): void {
    this.revokeAllImageUrls();
    console.log("🧹 [ImageStorage] Cleanup completed");
  }
}

// Export singleton instance
export const ImageStorage = new ImageStorageManager();
